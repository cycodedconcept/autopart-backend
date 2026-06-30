require('../setup/mocha');

const chai = require('chai');
const request = require('supertest');
const { createApp } = require('../../src/app');
const { createInMemoryBuyerAddressesRepository } = require('./support/in-memory-buyer-addresses-repository');
const { createInMemoryCartsRepository } = require('./support/in-memory-carts-repository');
const { createInMemoryCommerceStore } = require('./support/in-memory-commerce-store');
const { createInMemoryOrdersRepository } = require('./support/in-memory-orders-repository');
const { createInMemoryProductsRepository } = require('./support/in-memory-products-repository');
const { createInMemoryUsersRepository } = require('./support/in-memory-users-repository');

const { expect } = chai;

async function registerBuyer(app) {
  const response = await request(app)
    .post('/api/v1/auth/register')
    .send({
      fullName: 'Chinwe Ude',
      email: 'chinwe@example.com',
      password: 'Password123'
    });

  return response.body.data.token;
}

describe('Cart API integration', () => {
  let app;

  beforeEach(() => {
    const commerceStore = createInMemoryCommerceStore();

    app = createApp({
      usersRepository: createInMemoryUsersRepository(),
      productsRepository: createInMemoryProductsRepository(),
      buyerAddressesRepository: createInMemoryBuyerAddressesRepository({ store: commerceStore }),
      cartsRepository: createInMemoryCartsRepository({ store: commerceStore }),
      ordersRepository: createInMemoryOrdersRepository({ store: commerceStore })
    });
  });

  it('returns an empty cart for an authenticated buyer', async () => {
    const token = await registerBuyer(app);
    const response = await request(app)
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).to.equal(200);
    expect(response.body.success).to.equal(true);
    expect(response.body.data.items).to.deep.equal([]);
    expect(response.body.data.summary.totalKobo).to.equal(0);
  });

  it('adds a product to the buyer cart', async () => {
    const token = await registerBuyer(app);
    const response = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId: 4001,
        quantity: 2
      });

    expect(response.status).to.equal(200);
    expect(response.body.success).to.equal(true);
    expect(response.body.data.items).to.have.length(1);
    expect(response.body.data.items[0].product.title).to.equal('Front Brake Pad Set for Toyota Camry');
    expect(response.body.data.summary).to.deep.equal({
      itemCount: 2,
      subtotalKobo: 3700000,
      deliveryFeeKobo: 0,
      totalKobo: 3700000
    });
  });

  it('updates a cart item quantity', async () => {
    const token = await registerBuyer(app);
    const addResponse = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId: 4001,
        quantity: 1
      });

    const response = await request(app)
      .patch(`/api/v1/cart/items/${addResponse.body.data.items[0].id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        quantity: 3
      });

    expect(response.status).to.equal(200);
    expect(response.body.data.items[0].quantity).to.equal(3);
    expect(response.body.data.summary.totalKobo).to.equal(5550000);
  });

  it('removes a cart item', async () => {
    const token = await registerBuyer(app);
    const addResponse = await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId: 4001,
        quantity: 1
      });

    const response = await request(app)
      .delete(`/api/v1/cart/items/${addResponse.body.data.items[0].id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).to.equal(200);
    expect(response.body.data.items).to.deep.equal([]);
    expect(response.body.data.summary.totalKobo).to.equal(0);
  });
});
