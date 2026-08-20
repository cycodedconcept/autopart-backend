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

async function registerBuyer(app) {
  const response = await request(app)
    .post('/api/v1/auth/register')
    .send({
      fullName: 'Bola Adeniran',
      email: 'bola@example.com',
      password: 'Password123'
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

  const createOrderResponse = await request(app)
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

  return createOrderResponse.body.data.id;
}

async function confirmOrderPayment(app, token, orderId) {
  const initializeResponse = await request(app)
    .post('/api/v1/payments/initialize')
    .set('Authorization', `Bearer ${token}`)
    .send({
      orderId
    })
    .expect(200);

  const reference = initializeResponse.body.data.payment.reference;

  await request(app)
    .get('/api/v1/payments/callback')
    .set('Authorization', `Bearer ${token}`)
    .query({
      reference
    })
    .expect(200);
}

function appendStatusHistory(store, orderId, status, note, createdAt) {
  const order = store.orders.find((entry) => entry.id === Number(orderId));

  order.status = status;
  order.updatedAt = createdAt;
  store.orderStatusHistory.push({
    id: store.counters.orderStatusHistoryId,
    orderId: Number(orderId),
    status,
    note,
    createdAt,
    updatedAt: createdAt
  });
  store.counters.orderStatusHistoryId += 1;
}

function minutesFromNow(minutes) {
  return new Date(Date.now() + (minutes * 60 * 1000)).toISOString();
}

describe('Orders API integration', () => {
  let app;
  let commerceStore;

  beforeEach(() => {
    commerceStore = createInMemoryCommerceStore();
    const productsRepository = createInMemoryProductsRepository();

    app = createApp({
      usersRepository: createInMemoryUsersRepository(),
      productsRepository,
      buyerAddressesRepository: createInMemoryBuyerAddressesRepository({ store: commerceStore }),
      cartsRepository: createInMemoryCartsRepository({ productsRepository, store: commerceStore }),
      ordersRepository: createInMemoryOrdersRepository({ productsRepository, store: commerceStore }),
      paymentsRepository: createInMemoryPaymentsRepository({ productsRepository, store: commerceStore }),
      paystackClient: createFakePaystackClient()
    });
  });

  it('creates an order from cart items and clears the cart', async () => {
    const token = await registerBuyer(app);

    const orderId = await createPendingOrder(app, token);
    const createOrderResponse = await request(app)
      .get(`/api/v1/orders/${orderId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(createOrderResponse.status).to.equal(200);
    expect(createOrderResponse.body.success).to.equal(true);
    expect(createOrderResponse.body.data.status).to.equal('pending_payment');
    expect(createOrderResponse.body.data.paymentStatus).to.equal('pending');
    expect(createOrderResponse.body.data.deliveryFeeKobo).to.equal(205000);
    expect(createOrderResponse.body.data.totalKobo).to.equal(3905000);
    expect(createOrderResponse.body.data.items).to.have.length(1);
    expect(createOrderResponse.body.data.deliveryAddress.city).to.equal('Ikeja');
    expect(createOrderResponse.body.data.statusHistory).to.have.length(1);

    const cartResponse = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${token}`);

    expect(cartResponse.status).to.equal(200);
    expect(cartResponse.body.data.items).to.deep.equal([]);
  });

  it('rejects checkout when the cart is empty', async () => {
    const token = await registerBuyer(app);
    const response = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        paymentMethod: 'paystack',
        deliveryAddress: {
          label: 'Workshop',
          street: '12 Adeola Odeku Street',
          city: 'Ikeja',
          state: 'Lagos',
          phone: '08012345678'
        }
      });

    expect(response.status).to.equal(400);
    expect(response.body.success).to.equal(false);
    expect(response.body.error.code).to.equal('CART_EMPTY');
  });

  it('lists buyer orders with pagination', async () => {
    const token = await registerBuyer(app);
    const orderId = await createPendingOrder(app, token);

    const response = await request(app)
      .get('/api/v1/orders')
      .set('Authorization', `Bearer ${token}`)
      .query({
        page: 1,
        limit: 10
      });

    expect(response.status).to.equal(200);
    expect(response.body.success).to.equal(true);
    expect(response.body.data.orders).to.have.length(1);
    expect(response.body.data.orders[0].id).to.equal(orderId);
    expect(response.body.data.pagination.total).to.equal(1);
  });

  it('returns a buyer order detail with status history after payment confirmation', async () => {
    const token = await registerBuyer(app);
    const orderId = await createPendingOrder(app, token, 'paystack');

    await confirmOrderPayment(app, token, orderId);

    const response = await request(app)
      .get(`/api/v1/orders/${orderId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).to.equal(200);
    expect(response.body.success).to.equal(true);
    expect(response.body.data.id).to.equal(orderId);
    expect(response.body.data.status).to.equal('confirmed');
    expect(response.body.data.items).to.have.length(1);
    expect(response.body.data.statusHistory.map((entry) => entry.status)).to.deep.equal([
      'pending_payment',
      'confirmed'
    ]);
  });

  it('returns the current buyer order status and full history', async () => {
    const token = await registerBuyer(app);
    const orderId = await createPendingOrder(app, token, 'paystack');

    await confirmOrderPayment(app, token, orderId);
    appendStatusHistory(
      commerceStore,
      orderId,
      'picked_up',
      'Package collected from seller.',
      minutesFromNow(30)
    );
    appendStatusHistory(
      commerceStore,
      orderId,
      'in_transit',
      'Package is on the way.',
      minutesFromNow(75)
    );

    const response = await request(app)
      .get(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).to.equal(200);
    expect(response.body.success).to.equal(true);
    expect(response.body.data.orderId).to.equal(orderId);
    expect(response.body.data.currentStatus.status).to.equal('in_transit');
    expect(response.body.data.history.map((entry) => entry.status)).to.deep.equal([
      'pending_payment',
      'confirmed',
      'picked_up',
      'in_transit'
    ]);
  });

  it('returns a JSON receipt for a buyer order', async () => {
    const token = await registerBuyer(app);
    const orderId = await createPendingOrder(app, token, 'bank_transfer');

    const response = await request(app)
      .get(`/api/v1/orders/${orderId}/receipt`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).to.equal(200);
    expect(response.body.success).to.equal(true);
    expect(response.body.data.receiptNumber).to.equal(`RCPT-${orderId}`);
    expect(response.body.data.orderId).to.equal(orderId);
    expect(response.body.data.items).to.have.length(1);
  });

  it('returns an HTML receipt when requested', async () => {
    const token = await registerBuyer(app);
    const orderId = await createPendingOrder(app, token, 'ussd');

    const response = await request(app)
      .get(`/api/v1/orders/${orderId}/receipt`)
      .set('Authorization', `Bearer ${token}`)
      .query({
        format: 'html'
      });

    expect(response.status).to.equal(200);
    expect(response.headers['content-type']).to.contain('text/html');
    expect(response.text).to.contain('AutoParts Marketplace Receipt');
    expect(response.text).to.contain(`Receipt RCPT-${orderId}`);
  });
});
