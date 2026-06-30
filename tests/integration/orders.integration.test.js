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
      fullName: 'Bola Adeniran',
      email: 'bola@example.com',
      password: 'Password123'
    });

  return response.body.data.token;
}

describe('Orders API integration', () => {
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

  it('creates an order from cart items and clears the cart', async () => {
    const token = await registerBuyer(app);

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
        paymentMethod: 'paystack',
        deliveryAddress: {
          label: 'Workshop',
          street: '12 Adeola Odeku Street',
          city: 'Ikeja',
          state: 'Lagos',
          phone: '08012345678'
        }
      });

    expect(createOrderResponse.status).to.equal(201);
    expect(createOrderResponse.body.success).to.equal(true);
    expect(createOrderResponse.body.data.status).to.equal('pending_payment');
    expect(createOrderResponse.body.data.paymentStatus).to.equal('pending');
    expect(createOrderResponse.body.data.totalKobo).to.equal(3700000);
    expect(createOrderResponse.body.data.items).to.have.length(1);
    expect(createOrderResponse.body.data.deliveryAddress.city).to.equal('Ikeja');

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
});
