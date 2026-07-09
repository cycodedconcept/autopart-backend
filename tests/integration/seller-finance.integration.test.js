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
const { createInMemorySellerFinanceRepository } = require('./support/in-memory-seller-finance-repository');
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
      filename: 'cac.pdf',
      contentType: 'application/pdf'
    })
    .attach('proofOfAddressDocument', Buffer.from('fake-proof'), {
      filename: 'proof.pdf',
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

async function createOrder(app, token, productId, quantity) {
  await request(app)
    .post('/api/v1/cart/items')
    .set('Authorization', `Bearer ${token}`)
    .send({
      productId,
      quantity
    })
    .expect(200);

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

describe('Seller finance API integration', () => {
  let app;
  let uploadDirectory;

  beforeEach(() => {
    const usersRepository = createInMemoryUsersRepository();
    const sellersRepository = createInMemorySellersRepository({ usersRepository });
    const productsRepository = createInMemoryProductsRepository();
    const commerceStore = createInMemoryCommerceStore();

    uploadDirectory = path.join(os.tmpdir(), `autoparts-seller-finance-${Date.now()}`);
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
      sellerFinanceRepository: createInMemorySellerFinanceRepository({
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
        PLATFORM_COMMISSION_RATE_PERCENT: 10
      }
    });
  });

  afterEach(async () => {
    await fs.rm(uploadDirectory, {
      recursive: true,
      force: true
    });
  });

  it('returns seller sales totals, creates a payout request, and lists payout history', async () => {
    const sellerToken = await registerAndLoginSeller(app, {
      fullName: 'Uche Okafor',
      email: 'seller-finance@example.com',
      phone: '08012345678',
      password: 'Password123',
      businessName: 'Prime Auto Hub',
      contactEmail: 'sales@primeautohub.ng',
      contactPhone: '08012345678',
      address: '12 Sapara Williams Close, Victoria Island, Lagos',
      cacNumber: 'RC-323499'
    });
    const productId = await createSellerListing(app, sellerToken, {
      title: 'Front Brake Disc',
      description: 'Premium brake disc for Toyota Camry sedans.',
      categoryId: 1002,
      partNumber: 'DISC-FIN-001',
      condition: 'new',
      priceKobo: 4500000,
      stockQty: 8,
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
    const buyerToken = await registerBuyer(app, 'seller-finance-buyer@example.com');
    const orderId = await createOrder(app, buyerToken, productId, 2);
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

    const today = new Date().toISOString().slice(0, 10);
    const salesResponse = await request(app)
      .get('/api/v1/seller/sales')
      .set('Authorization', `Bearer ${sellerToken}`)
      .query({
        dateFrom: today,
        dateTo: today
      })
      .expect(200);

    expect(salesResponse.body.data.commissionRatePercent).to.equal(10);
    expect(salesResponse.body.data.sales.totalOrders).to.equal(1);
    expect(salesResponse.body.data.sales.totalItems).to.equal(2);
    expect(salesResponse.body.data.sales.grossSalesKobo).to.equal(9000000);
    expect(salesResponse.body.data.sales.commissionKobo).to.equal(900000);
    expect(salesResponse.body.data.sales.netSalesKobo).to.equal(8100000);
    expect(salesResponse.body.data.payouts.pendingKobo).to.equal(8100000);

    const createPayoutResponse = await request(app)
      .post('/api/v1/seller/payouts')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        bankAccountRef: 'BANK-0012345678'
      })
      .expect(201);

    expect(createPayoutResponse.body.data.status).to.equal('requested');
    expect(createPayoutResponse.body.data.amountKobo).to.equal(8100000);
    expect(createPayoutResponse.body.data.itemCount).to.equal(1);

    const payoutHistoryResponse = await request(app)
      .get('/api/v1/seller/payouts')
      .set('Authorization', `Bearer ${sellerToken}`)
      .query({
        status: 'requested'
      })
      .expect(200);

    expect(payoutHistoryResponse.body.data.payouts).to.have.length(1);
    expect(payoutHistoryResponse.body.data.payouts[0].bankAccountRef).to.equal('BANK-0012345678');
    expect(payoutHistoryResponse.body.data.pagination.total).to.equal(1);

    const updatedSalesResponse = await request(app)
      .get('/api/v1/seller/sales')
      .set('Authorization', `Bearer ${sellerToken}`)
      .query({
        dateFrom: today,
        dateTo: today
      })
      .expect(200);

    expect(updatedSalesResponse.body.data.payouts.pendingKobo).to.equal(0);
    expect(updatedSalesResponse.body.data.payouts.requestedKobo).to.equal(8100000);
  });

  it('returns a conflict when the seller has no completed sales ready for payout', async () => {
    const sellerToken = await registerAndLoginSeller(app, {
      fullName: 'Amaka Obi',
      email: 'seller-finance-empty@example.com',
      phone: '08012345679',
      password: 'Password123',
      businessName: 'Savannah Parts Depot',
      contactEmail: 'sales@savannahparts.ng',
      contactPhone: '08012345679',
      address: '24 Aminu Kano Crescent, Wuse II, Abuja',
      cacNumber: 'RC-323500'
    });

    const response = await request(app)
      .post('/api/v1/seller/payouts')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        bankAccountRef: 'BANK-EMPTY-001'
      })
      .expect(409);

    expect(response.body.success).to.equal(false);
    expect(response.body.error.code).to.equal('CONFLICT');
  });
});
