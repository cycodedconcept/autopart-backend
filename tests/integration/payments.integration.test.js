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

describe('Payments API integration', () => {
  let app;

  beforeEach(() => {
    const commerceStore = createInMemoryCommerceStore();

    app = createApp({
      usersRepository: createInMemoryUsersRepository(),
      productsRepository: createInMemoryProductsRepository(),
      buyerAddressesRepository: createInMemoryBuyerAddressesRepository({ store: commerceStore }),
      cartsRepository: createInMemoryCartsRepository({ store: commerceStore }),
      ordersRepository: createInMemoryOrdersRepository({ store: commerceStore }),
      paymentsRepository: createInMemoryPaymentsRepository({ store: commerceStore }),
      paystackClient: createFakePaystackClient()
    });
  });

  it('initializes a bank transfer payment for a pending order', async () => {
    const token = await registerBuyer(app);
    const orderId = await createPendingOrder(app, token, 'bank_transfer');

    const response = await request(app)
      .post('/api/v1/payments/initialize')
      .set('Authorization', `Bearer ${token}`)
      .send({
        orderId,
        callbackUrl: 'https://example.com/payments/callback'
      });

    expect(response.status).to.equal(200);
    expect(response.body.success).to.equal(true);
    expect(response.body.data.authorizationUrl).to.include('https://checkout.paystack.com/');
    expect(response.body.data.channels).to.deep.equal(['bank_transfer']);
    expect(response.body.data.order.id).to.equal(orderId);
    expect(response.body.data.payment.provider).to.equal('paystack');
    expect(response.body.data.payment.status).to.equal('pending');
  });

  it('verifies a payment callback and confirms the order', async () => {
    const token = await registerBuyer(app);
    const orderId = await createPendingOrder(app, token, 'paystack');

    const initializeResponse = await request(app)
      .post('/api/v1/payments/initialize')
      .set('Authorization', `Bearer ${token}`)
      .send({
        orderId
      })
      .expect(200);

    const reference = initializeResponse.body.data.payment.reference;
    const callbackResponse = await request(app)
      .get('/api/v1/payments/callback')
      .query({
        reference
      });

    expect(callbackResponse.status).to.equal(200);
    expect(callbackResponse.body.success).to.equal(true);
    expect(callbackResponse.body.data.verified).to.equal(true);
    expect(callbackResponse.body.data.order.status).to.equal('confirmed');
    expect(callbackResponse.body.data.order.paymentStatus).to.equal('paid');
    expect(callbackResponse.body.data.payment.reference).to.equal(reference);
  });

  it('verifies a webhook and confirms a ussd order', async () => {
    const token = await registerBuyer(app, {
      email: 'ussd-buyer@example.com'
    });
    const orderId = await createPendingOrder(app, token, 'ussd');

    const initializeResponse = await request(app)
      .post('/api/v1/payments/initialize')
      .set('Authorization', `Bearer ${token}`)
      .send({
        orderId
      })
      .expect(200);

    const reference = initializeResponse.body.data.payment.reference;
    const webhookResponse = await request(app)
      .post('/api/v1/payments/webhook')
      .set('x-paystack-signature', 'valid-signature')
      .send({
        event: 'charge.success',
        data: {
          reference
        }
      });

    expect(webhookResponse.status).to.equal(200);
    expect(webhookResponse.body.success).to.equal(true);
    expect(webhookResponse.body.data.acknowledged).to.equal(true);
    expect(webhookResponse.body.data.handled).to.equal(true);
    expect(webhookResponse.body.data.order.status).to.equal('confirmed');
    expect(webhookResponse.body.data.order.paymentMethod).to.equal('ussd');
    expect(webhookResponse.body.data.payment.status).to.equal('paid');
  });
});
