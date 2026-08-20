require('../setup/mocha');

const chai = require('chai');
const request = require('supertest');
const { createApp } = require('../../src/app');
const { createInMemoryBuyerAddressesRepository } = require('./support/in-memory-buyer-addresses-repository');
const { createInMemoryCartsRepository } = require('./support/in-memory-carts-repository');
const { createInMemoryCommerceStore } = require('./support/in-memory-commerce-store');
const { createFakePaystackClient } = require('./support/fake-paystack-client');
const { createInMemoryOrdersRepository } = require('./support/in-memory-orders-repository');
const { createInMemoryPaymentsRepository } = require('./support/in-memory-payments-repository');
const { createInMemoryProductsRepository } = require('./support/in-memory-products-repository');
const { createInMemoryUsersRepository } = require('./support/in-memory-users-repository');

const { expect } = chai;

async function registerBuyer(app, payload = {}) {
  const response = await request(app)
    .post('/api/v1/auth/register')
    .send({
      fullName: 'Bola Adeniran',
      email: 'bola@example.com',
      password: 'Password123',
      ...payload
    });

  return response.body.data.token;
}

async function createPendingOrder(app, token, paymentMethod = 'paystack') {
  await request(app)
    .post('/api/v1/cart/items')
    .set('Authorization', `Bearer ${token}`)
    .send({
      productId: 4001,
      quantity: 2
    })
    .expect(200);

  const orderResponse = await request(app)
    .post('/api/v1/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({
      paymentMethod,
      deliveryAddress: {
        label: 'Workshop',
        street: '12 Adeola Odeku Street',
        city: 'Ikeja',
        state: 'Lagos',
        phone: '08012345678'
      }
    })
    .expect(201);

  return orderResponse.body.data.id;
}

async function initializePayment(app, token, orderId, payload = {}) {
  const response = await request(app)
    .post('/api/v1/payments/initialize')
    .set('Authorization', `Bearer ${token}`)
    .send({
      orderId,
      ...payload
    })
    .expect(200);

  return response.body.data;
}

async function postPaystackWebhook(app, payload, signature = 'valid-signature') {
  return request(app)
    .post('/webhooks/paystack')
    .set('x-paystack-signature', signature)
    .send(payload);
}

async function waitFor(assertion, { attempts = 20, delayMs = 10 } = {}) {
  let lastError;

  for (let index = 0; index < attempts; index += 1) {
    try {
      return await assertion();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => {
        setTimeout(resolve, delayMs);
      });
    }
  }

  throw lastError;
}

describe('Payments API integration', () => {
  let app;
  let commerceStore;
  let paystackClient;

  beforeEach(() => {
    commerceStore = createInMemoryCommerceStore();
    const productsRepository = createInMemoryProductsRepository();
    paystackClient = createFakePaystackClient();

    app = createApp({
      usersRepository: createInMemoryUsersRepository(),
      productsRepository,
      buyerAddressesRepository: createInMemoryBuyerAddressesRepository({ store: commerceStore }),
      cartsRepository: createInMemoryCartsRepository({ productsRepository, store: commerceStore }),
      ordersRepository: createInMemoryOrdersRepository({ productsRepository, store: commerceStore }),
      paymentsRepository: createInMemoryPaymentsRepository({ productsRepository, store: commerceStore }),
      paystackClient
    });
  });

  it('initializes a bank transfer payment for a pending order', async () => {
    const token = await registerBuyer(app);
    const orderId = await createPendingOrder(app, token, 'bank_transfer');

    const payment = await initializePayment(app, token, orderId, {
      callbackUrl: 'https://example.com/payments/callback'
    });

    expect(payment.authorizationUrl).to.include('https://checkout.paystack.com/');
    expect(payment.channels).to.deep.equal(['bank_transfer']);
    expect(payment.order.id).to.equal(orderId);
    expect(payment.payment.provider).to.equal('paystack');
    expect(payment.payment.status).to.equal('pending');
  });

  it('verifies a redirect fallback and confirms the order', async () => {
    const token = await registerBuyer(app);
    const orderId = await createPendingOrder(app, token, 'paystack');
    const initializedPayment = await initializePayment(app, token, orderId);

    const response = await request(app)
      .get(`/api/v1/payments/verify/${initializedPayment.payment.reference}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.success).to.equal(true);
    expect(response.body.data.verified).to.equal(true);
    expect(response.body.data.order.status).to.equal('confirmed');
    expect(response.body.data.order.paymentStatus).to.equal('paid');
  });

  it('fulfills a valid charge.success webhook exactly once', async () => {
    const token = await registerBuyer(app, {
      email: 'ussd-buyer@example.com'
    });
    const orderId = await createPendingOrder(app, token, 'ussd');
    const initializedPayment = await initializePayment(app, token, orderId);
    const reference = initializedPayment.payment.reference;

    const firstResponse = await postPaystackWebhook(app, {
      event: 'charge.success',
      data: {
        id: 9001,
        reference
      }
    });
    const secondResponse = await postPaystackWebhook(app, {
      event: 'charge.success',
      data: {
        id: 9001,
        reference
      }
    });

    expect(firstResponse.status).to.equal(200);
    expect(secondResponse.status).to.equal(200);

    await waitFor(() => {
      const order = commerceStore.orders.find((entry) => entry.id === orderId);
      const webhookEvent = commerceStore.paymentWebhookEvents[0];
      const confirmedEntries = commerceStore.orderStatusHistory.filter((entry) => (
        entry.orderId === orderId && entry.status === 'confirmed'
      ));

      expect(order.paymentStatus).to.equal('paid');
      expect(order.status).to.equal('confirmed');
      expect(webhookEvent.processingStatus).to.equal('processed');
      expect(webhookEvent.attemptCount).to.equal(2);
      expect(confirmedEntries).to.have.length(1);
    });
  });

  it('rejects tampered webhook signatures without fulfilling the order', async () => {
    const token = await registerBuyer(app);
    const orderId = await createPendingOrder(app, token, 'paystack');
    const initializedPayment = await initializePayment(app, token, orderId);

    const response = await postPaystackWebhook(app, {
      event: 'charge.success',
      data: {
        reference: initializedPayment.payment.reference
      }
    }, 'bad-signature');

    expect(response.status).to.equal(401);

    const order = commerceStore.orders.find((entry) => entry.id === orderId);

    expect(order.paymentStatus).to.equal('pending');
    expect(order.status).to.equal('pending_payment');
    expect(commerceStore.paymentWebhookEvents).to.have.length(0);
  });

  it('flags amount mismatches instead of fulfilling the order', async () => {
    const token = await registerBuyer(app);
    const orderId = await createPendingOrder(app, token, 'paystack');
    const initializedPayment = await initializePayment(app, token, orderId);
    const reference = initializedPayment.payment.reference;

    paystackClient.setTransaction(reference, {
      amount: 1000
    });

    const response = await postPaystackWebhook(app, {
      event: 'charge.success',
      data: {
        id: 9002,
        reference
      }
    });

    expect(response.status).to.equal(200);

    await waitFor(() => {
      const order = commerceStore.orders.find((entry) => entry.id === orderId);
      const payment = commerceStore.payments.find((entry) => entry.reference === reference);

      expect(order.paymentStatus).to.equal('flagged');
      expect(order.status).to.equal('pending_payment');
      expect(payment.status).to.equal('flagged');
    });
  });

  it('treats the webhook as a no-op when redirect verification already settled the payment', async () => {
    const token = await registerBuyer(app);
    const orderId = await createPendingOrder(app, token, 'paystack');
    const initializedPayment = await initializePayment(app, token, orderId);
    const reference = initializedPayment.payment.reference;

    await request(app)
      .get(`/api/v1/payments/verify/${reference}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const response = await postPaystackWebhook(app, {
      event: 'charge.success',
      data: {
        id: 9003,
        reference
      }
    });

    expect(response.status).to.equal(200);

    await waitFor(() => {
      const confirmedEntries = commerceStore.orderStatusHistory.filter((entry) => (
        entry.orderId === orderId && entry.status === 'confirmed'
      ));
      const webhookEvent = commerceStore.paymentWebhookEvents[0];

      expect(confirmedEntries).to.have.length(1);
      expect(webhookEvent.processingStatus).to.equal('processed');
      expect(commerceStore.orders.find((entry) => entry.id === orderId).paymentStatus).to.equal('paid');
    });
  });

  it('acknowledges unknown webhook events without crashing or mutating the order', async () => {
    const token = await registerBuyer(app);
    const orderId = await createPendingOrder(app, token, 'paystack');
    const initializedPayment = await initializePayment(app, token, orderId);

    const response = await postPaystackWebhook(app, {
      event: 'transfer.success',
      data: {
        id: 9004,
        reference: initializedPayment.payment.reference
      }
    });

    expect(response.status).to.equal(200);

    await waitFor(() => {
      const order = commerceStore.orders.find((entry) => entry.id === orderId);
      const webhookEvent = commerceStore.paymentWebhookEvents[0];

      expect(order.paymentStatus).to.equal('pending');
      expect(order.status).to.equal('pending_payment');
      expect(webhookEvent.processingStatus).to.equal('ignored');
    });
  });
});
