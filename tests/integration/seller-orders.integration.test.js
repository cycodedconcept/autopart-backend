require('../setup/mocha');

const fs = require('fs/promises');
const os = require('os');
const path = require('path');
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
const { createInMemorySellersRepository } = require('./support/in-memory-sellers-repository');
const { createInMemoryUsersRepository } = require('./support/in-memory-users-repository');

const { expect } = chai;

async function registerBuyer(app, email) {
  const response = await request(app)
    .post('/api/v1/auth/register')
    .send({
      fullName: 'Buyer User',
      email,
      password: 'Password123'
    })
    .expect(201);

  return response.body.data.token;
}

async function registerAndLoginSeller(app, seller) {
  await request(app)
    .post('/api/v1/seller/register')
    .send({
      fullName: seller.fullName,
      email: seller.email,
      phone: seller.phone,
      password: seller.password,
      businessName: seller.businessName,
      contactEmail: seller.contactEmail,
      contactPhone: seller.contactPhone,
      address: seller.address,
      cacNumber: seller.cacNumber
    })
    .expect(201);

  const loginResponse = await request(app)
    .post('/api/v1/auth/login')
    .send({
      identifier: seller.email,
      password: seller.password
    })
    .expect(200);

  await request(app)
    .post('/api/v1/seller/documents')
    .set('Authorization', `Bearer ${loginResponse.body.data.token}`)
    .attach('cacDocument', Buffer.from('fake-cac'), {
      filename: `${seller.businessName}-cac.pdf`,
      contentType: 'application/pdf'
    })
    .attach('proofOfAddressDocument', Buffer.from('fake-proof'), {
      filename: `${seller.businessName}-proof.pdf`,
      contentType: 'application/pdf'
    })
    .expect(200);

  return loginResponse.body.data.token;
}

async function createSellerListing(app, token, product) {
  const response = await request(app)
    .post('/api/v1/seller/products')
    .set('Authorization', `Bearer ${token}`)
    .field('title', product.title)
    .field('description', product.description)
    .field('categoryId', String(product.categoryId))
    .field('partNumber', product.partNumber)
    .field('condition', product.condition)
    .field('priceKobo', String(product.priceKobo))
    .field('stockQty', String(product.stockQty))
    .field('location', product.location)
    .field('compatibility', JSON.stringify(product.compatibility))
    .attach('photos', Buffer.from('fake-image'), {
      filename: `${product.partNumber}.png`,
      contentType: 'image/png'
    })
    .expect(201);

  return response.body.data.id;
}

async function createOrder(app, token, productIds) {
  for (const productId of productIds) {
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId,
        quantity: 1
      })
      .expect(200);
  }

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
    })
    .expect(201);

  return response.body.data.id;
}

describe('Seller orders API integration', () => {
  let app;
  let uploadDirectory;

  beforeEach(() => {
    const usersRepository = createInMemoryUsersRepository();
    const sellersRepository = createInMemorySellersRepository({ usersRepository });
    const productsRepository = createInMemoryProductsRepository();
    const commerceStore = createInMemoryCommerceStore();

    uploadDirectory = path.join(os.tmpdir(), `autoparts-seller-orders-${Date.now()}`);
    app = createApp({
      usersRepository,
      sellersRepository,
      productsRepository,
      buyerAddressesRepository: createInMemoryBuyerAddressesRepository({ store: commerceStore }),
      cartsRepository: createInMemoryCartsRepository({
        productsRepository,
        store: commerceStore
      }),
      ordersRepository: createInMemoryOrdersRepository({
        productsRepository,
        store: commerceStore
      }),
      paymentsRepository: createInMemoryPaymentsRepository({
        productsRepository,
        store: commerceStore
      }),
      paystackClient: createFakePaystackClient(),
      env: {
        NODE_ENV: 'test',
        DB_HOST: 'localhost',
        DB_PORT: 3306,
        DB_USER: 'root',
        DB_PASSWORD: '',
        DB_NAME: 'autoparts_test',
        JWT_SECRET: 'test-jwt-secret-12345',
        JWT_EXPIRES_IN: '1d',
        BCRYPT_SALT_ROUNDS: 4,
        PASSWORD_RESET_TOKEN_TTL_MINUTES: 30,
        PAYSTACK_SECRET_KEY: '',
        PAYSTACK_PUBLIC_KEY: '',
        UPLOAD_DIR: uploadDirectory,
        SELLER_AUTO_VERIFY: true
      }
    });
  });

  afterEach(async () => {
    await fs.rm(uploadDirectory, {
      recursive: true,
      force: true
    });
  });

  it('shows each seller only their own order items and lets them mark an item ready_for_pickup', async () => {
    const sellerOneToken = await registerAndLoginSeller(app, {
      fullName: 'Uche Okafor',
      email: 'seller-one@example.com',
      phone: '08012345678',
      password: 'Password123',
      businessName: 'Prime Auto Hub',
      contactEmail: 'sales@primeautohub.ng',
      contactPhone: '08012345678',
      address: '12 Sapara Williams Close, Victoria Island, Lagos',
      cacNumber: 'RC-123456'
    });
    const sellerTwoToken = await registerAndLoginSeller(app, {
      fullName: 'Amaka Obi',
      email: 'seller-two@example.com',
      phone: '08012345679',
      password: 'Password123',
      businessName: 'Savannah Parts Depot',
      contactEmail: 'sales@savannahparts.ng',
      contactPhone: '08012345679',
      address: '24 Aminu Kano Crescent, Wuse II, Abuja',
      cacNumber: 'RC-123457'
    });

    const sellerOneProductId = await createSellerListing(app, sellerOneToken, {
      title: 'Front Brake Disc',
      description: 'Premium brake disc for Toyota Camry sedans.',
      categoryId: 1002,
      partNumber: 'DISC-001',
      condition: 'new',
      priceKobo: 4500000,
      stockQty: 12,
      location: 'Lagos',
      compatibility: [
        {
          make: 'Toyota',
          model: 'Camry',
          yearFrom: 2007,
          yearTo: 2011
        }
      ]
    });
    const sellerTwoProductId = await createSellerListing(app, sellerTwoToken, {
      title: 'Rear Shock Absorber',
      description: 'Gas-filled rear shock absorber for Honda Accord.',
      categoryId: 1003,
      partNumber: 'SHOCK-002',
      condition: 'new',
      priceKobo: 3200000,
      stockQty: 8,
      location: 'Abuja',
      compatibility: [
        {
          make: 'Honda',
          model: 'Accord',
          yearFrom: 2008,
          yearTo: 2012
        }
      ]
    });

    const buyerToken = await registerBuyer(app, 'buyer@example.com');
    const orderId = await createOrder(app, buyerToken, [sellerOneProductId, sellerTwoProductId]);

    const initializeResponse = await request(app)
      .post('/api/v1/payments/initialize')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        orderId
      })
      .expect(200);

    await request(app)
      .get('/api/v1/payments/callback')
      .query({
        reference: initializeResponse.body.data.payment.reference
      })
      .expect(200);

    const sellerOneOrdersResponse = await request(app)
      .get('/api/v1/seller/orders')
      .set('Authorization', `Bearer ${sellerOneToken}`)
      .expect(200);

    expect(sellerOneOrdersResponse.body.success).to.equal(true);
    expect(sellerOneOrdersResponse.body.data.orders).to.have.length(1);
    expect(sellerOneOrdersResponse.body.data.orders[0].items).to.have.length(1);
    expect(sellerOneOrdersResponse.body.data.orders[0].items[0].productId).to.equal(sellerOneProductId);
    expect(sellerOneOrdersResponse.body.data.orders[0].items[0].itemStatus).to.equal('pending');

    const sellerTwoOrdersResponse = await request(app)
      .get('/api/v1/seller/orders')
      .set('Authorization', `Bearer ${sellerTwoToken}`)
      .expect(200);

    expect(sellerTwoOrdersResponse.body.data.orders).to.have.length(1);
    expect(sellerTwoOrdersResponse.body.data.orders[0].items).to.have.length(1);
    expect(sellerTwoOrdersResponse.body.data.orders[0].items[0].productId).to.equal(sellerTwoProductId);

    const sellerOneOrderItemId = sellerOneOrdersResponse.body.data.orders[0].items[0].id;
    const updateResponse = await request(app)
      .patch(`/api/v1/seller/orders/${sellerOneOrderItemId}/status`)
      .set('Authorization', `Bearer ${sellerOneToken}`)
      .send({
        itemStatus: 'ready_for_pickup'
      })
      .expect(200);

    expect(updateResponse.body.success).to.equal(true);
    expect(updateResponse.body.data.itemStatus).to.equal('ready_for_pickup');
    expect(updateResponse.body.data.order.id).to.equal(orderId);

    const buyerOrderResponse = await request(app)
      .get(`/api/v1/orders/${orderId}`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200);

    expect(
      buyerOrderResponse.body.data.items.map((item) => ({
        productId: item.productId,
        itemStatus: item.itemStatus
      }))
    ).to.deep.equal([
      {
        productId: sellerOneProductId,
        itemStatus: 'ready_for_pickup'
      },
      {
        productId: sellerTwoProductId,
        itemStatus: 'pending'
      }
    ]);
  });

  it('rejects seller fulfillment updates before the buyer payment is confirmed', async () => {
    const sellerToken = await registerAndLoginSeller(app, {
      fullName: 'Uche Okafor',
      email: 'pending-seller@example.com',
      phone: '08012345670',
      password: 'Password123',
      businessName: 'Prime Auto Hub Pending',
      contactEmail: 'sales@primepending.ng',
      contactPhone: '08012345670',
      address: '12 Sapara Williams Close, Victoria Island, Lagos',
      cacNumber: 'RC-223456'
    });
    const productId = await createSellerListing(app, sellerToken, {
      title: 'Engine Mount',
      description: 'Heavy-duty engine mount for Toyota Corolla.',
      categoryId: 1001,
      partNumber: 'ENG-MNT-01',
      condition: 'new',
      priceKobo: 2500000,
      stockQty: 5,
      location: 'Lagos',
      compatibility: [
        {
          make: 'Toyota',
          model: 'Corolla',
          yearFrom: 2010,
          yearTo: 2016
        }
      ]
    });

    const buyerToken = await registerBuyer(app, 'pending-buyer@example.com');
    await createOrder(app, buyerToken, [productId]);

    const sellerOrdersResponse = await request(app)
      .get('/api/v1/seller/orders')
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(200);

    const orderItemId = sellerOrdersResponse.body.data.orders[0].items[0].id;
    const response = await request(app)
      .patch(`/api/v1/seller/orders/${orderItemId}/status`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        itemStatus: 'ready_for_pickup'
      });

    expect(response.status).to.equal(409);
    expect(response.body.success).to.equal(false);
    expect(response.body.error.code).to.equal('CONFLICT');
  });
});
