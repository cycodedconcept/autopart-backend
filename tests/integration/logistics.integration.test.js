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
const { createInMemoryDeliveryJobsRepository } = require('./support/in-memory-delivery-jobs-repository');
const { createFakePaystackClient } = require('./support/fake-paystack-client');
const { createInMemoryLogisticsRepository } = require('./support/in-memory-logistics-repository');
const { createInMemoryOrdersRepository } = require('./support/in-memory-orders-repository');
const { createInMemoryPaymentsRepository } = require('./support/in-memory-payments-repository');
const { createInMemoryPlatformConfigRepository } = require('./support/in-memory-platform-config-repository');
const { createInMemoryProductsRepository } = require('./support/in-memory-products-repository');
const { createInMemorySellerFinanceRepository } = require('./support/in-memory-seller-finance-repository');
const { createInMemorySellersRepository } = require('./support/in-memory-sellers-repository');
const { createInMemoryUsersRepository } = require('./support/in-memory-users-repository');
const {
  failDeliveryJob,
  getDeliveryJobByOrderItemId,
  progressDeliveryJob,
  registerAndLoginLogistics
} = require('./support/logistics-test-helpers');

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

describe('Logistics API integration', () => {
  let app;
  let uploadDirectory;

  beforeEach(() => {
    const usersRepository = createInMemoryUsersRepository();
    const sellersRepository = createInMemorySellersRepository({ usersRepository });
    const productsRepository = createInMemoryProductsRepository();
    const commerceStore = createInMemoryCommerceStore();
    const platformConfigRepository = createInMemoryPlatformConfigRepository();
    const logisticsRepository = createInMemoryLogisticsRepository({
      store: commerceStore,
      usersRepository
    });
    const deliveryJobsRepository = createInMemoryDeliveryJobsRepository({
      logisticsRepository,
      productsRepository,
      sellersRepository,
      store: commerceStore,
      usersRepository
    });

    uploadDirectory = path.join(os.tmpdir(), `autoparts-logistics-${Date.now()}`);
    app = createApp({
      deliveryJobsRepository,
      logisticsRepository,
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
        store: commerceStore,
        usersRepository
      }),
      paymentsRepository: createInMemoryPaymentsRepository({
        productsRepository,
        store: commerceStore
      }),
      sellerFinanceRepository: createInMemorySellerFinanceRepository({
        sellersRepository,
        store: commerceStore
      }),
      platformConfigRepository,
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
        PLATFORM_COMMISSION_RATE_PERCENT: 10,
        DELIVERY_BASE_FEE_KOBO: 100000,
        DELIVERY_PER_KM_KOBO: 5000,
        LOGISTICS_PLATFORM_MARGIN_PCT: 10
      }
    });
  });

  afterEach(async () => {
    await fs.rm(uploadDirectory, {
      recursive: true,
      force: true
    });
  });

  it('registers a logistics company, manages riders, and lets a rider update availability', async () => {
    const registerResponse = await request(app)
      .post('/api/v1/logistics/register')
      .send({
        name: 'Swift Dispatch',
        email: 'ops@swiftdispatch.ng',
        phone: '08012345080',
        password: 'Password123',
        address: '12 Sapara Williams Close, Victoria Island, Lagos'
      })
      .expect(201);

    expect(registerResponse.body.data.company.status).to.equal('pending');

    const companyLoginResponse = await request(app)
      .post('/api/v1/logistics/login')
      .send({
        identifier: 'ops@swiftdispatch.ng',
        password: 'Password123'
      })
      .expect(200);

    const companyToken = companyLoginResponse.body.data.token;
    const meResponse = await request(app)
      .get('/api/v1/logistics/me')
      .set('Authorization', `Bearer ${companyToken}`)
      .expect(200);

    expect(meResponse.body.data.company.email).to.equal('ops@swiftdispatch.ng');

    const zonesResponse = await request(app)
      .get('/api/v1/logistics/zones')
      .set('Authorization', `Bearer ${companyToken}`)
      .expect(200);

    expect(zonesResponse.body.data.zones.length).to.be.greaterThan(0);
    const zoneId = zonesResponse.body.data.zones[0].id;

    const createRiderResponse = await request(app)
      .post('/api/v1/logistics/riders')
      .set('Authorization', `Bearer ${companyToken}`)
      .send({
        fullName: 'Alex Rider',
        email: 'alex.rider@swiftdispatch.ng',
        phone: '08012345081',
        password: 'Password123',
        vehicleType: 'van',
        zoneId,
        status: 'available'
      })
      .expect(201);

    expect(createRiderResponse.body.data.rider.status).to.equal('available');

    const riderId = createRiderResponse.body.data.rider.id;
    const listRidersResponse = await request(app)
      .get('/api/v1/logistics/riders')
      .set('Authorization', `Bearer ${companyToken}`)
      .query({
        status: 'available'
      })
      .expect(200);

    expect(listRidersResponse.body.data.riders).to.have.length(1);
    expect(listRidersResponse.body.data.riders[0].email).to.equal('alex.rider@swiftdispatch.ng');

    const riderDetailResponse = await request(app)
      .get(`/api/v1/logistics/riders/${riderId}`)
      .set('Authorization', `Bearer ${companyToken}`)
      .expect(200);

    expect(riderDetailResponse.body.data.rider.zone.id).to.equal(zoneId);

    const riderLoginResponse = await request(app)
      .post('/api/v1/rider/login')
      .send({
        identifier: 'alex.rider@swiftdispatch.ng',
        password: 'Password123'
      })
      .expect(200);

    const riderToken = riderLoginResponse.body.data.token;
    const riderMeResponse = await request(app)
      .get('/api/v1/rider/me')
      .set('Authorization', `Bearer ${riderToken}`)
      .expect(200);

    expect(riderMeResponse.body.data.rider.company.name).to.equal('Swift Dispatch');

    const availabilityResponse = await request(app)
      .patch('/api/v1/rider/availability')
      .set('Authorization', `Bearer ${riderToken}`)
      .send({
        status: 'unavailable'
      })
      .expect(200);

    expect(availabilityResponse.body.data.rider.status).to.equal('unavailable');

    const updateRiderResponse = await request(app)
      .patch(`/api/v1/logistics/riders/${riderId}`)
      .set('Authorization', `Bearer ${companyToken}`)
      .send({
        vehicleType: 'bike',
        status: 'inactive'
      })
      .expect(200);

    expect(updateRiderResponse.body.data.rider.vehicleType).to.equal('bike');
    expect(updateRiderResponse.body.data.rider.status).to.equal('inactive');
  });

  it('prevents one logistics company from managing another company rider', async () => {
    const firstCompany = await request(app)
      .post('/api/v1/logistics/register')
      .send({
        name: 'Swift Dispatch',
        email: 'team@swiftdispatch.ng',
        phone: '08012345082',
        password: 'Password123',
        address: '12 Sapara Williams Close, Victoria Island, Lagos'
      })
      .expect(201);
    const firstCompanyToken = firstCompany.body.data.token;
    const zonesResponse = await request(app)
      .get('/api/v1/logistics/zones')
      .set('Authorization', `Bearer ${firstCompanyToken}`)
      .expect(200);
    const zoneId = zonesResponse.body.data.zones[0].id;
    const riderResponse = await request(app)
      .post('/api/v1/logistics/riders')
      .set('Authorization', `Bearer ${firstCompanyToken}`)
      .send({
        fullName: 'Alex Rider',
        email: 'alex.team@swiftdispatch.ng',
        phone: '08012345083',
        password: 'Password123',
        vehicleType: 'van',
        zoneId,
        status: 'available'
      })
      .expect(201);

    const secondCompany = await request(app)
      .post('/api/v1/logistics/register')
      .send({
        name: 'Fast Lane',
        email: 'ops@fastlane.ng',
        phone: '08012345084',
        password: 'Password123',
        address: '8 Admiralty Way, Lekki, Lagos'
      })
      .expect(201);

    const response = await request(app)
      .patch(`/api/v1/logistics/riders/${riderResponse.body.data.rider.id}`)
      .set('Authorization', `Bearer ${secondCompany.body.data.token}`)
      .send({
        status: 'inactive'
      })
      .expect(404);

    expect(response.body.error.code).to.equal('NOT_FOUND');
  });

  it('creates delivery jobs from seller handoff and lets a rider complete the delivery flow', async () => {
    const sellerToken = await registerAndLoginSeller(app, {
      fullName: 'Uche Okafor',
      email: 'seller-logistics@example.com',
      phone: '08012345678',
      password: 'Password123',
      businessName: 'Prime Auto Hub',
      contactEmail: 'sales@primeautohub.ng',
      contactPhone: '08012345678',
      address: '12 Sapara Williams Close, Victoria Island, Lagos',
      cacNumber: 'RC-900001'
    });
    const logistics = await registerAndLoginLogistics(app, {
      fullName: 'Alex Rider',
      email: 'logistics@example.com',
      phone: '08012345010',
      password: 'Password123',
      providerName: 'Swift Dispatch',
      vehicleType: 'van',
      plateNumber: 'LAG-510XY'
    });
    const productId = await createSellerListing(app, sellerToken, {
      title: 'Front Brake Disc',
      description: 'Premium brake disc for Toyota Camry sedans.',
      categoryId: 1002,
      partNumber: 'DISC-LGS-001',
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
    const buyerToken = await registerBuyer(app, 'logistics-buyer@example.com');
    const orderId = await createOrder(app, buyerToken, productId, 1);

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

    const sellerOrdersResponse = await request(app)
      .get('/api/v1/seller/orders')
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(200);
    const orderItemId = sellerOrdersResponse.body.data.orders[0].items[0].id;

    await request(app)
      .patch(`/api/v1/seller/orders/${orderItemId}/status`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        itemStatus: 'ready_for_pickup'
      })
      .expect(200);

    const assignedJobsResponse = await request(app)
      .get('/api/v1/rider/jobs')
      .set('Authorization', `Bearer ${logistics.token}`)
      .query({
        status: 'assigned'
      })
      .expect(200);

    expect(assignedJobsResponse.body.data.jobs).to.have.length(1);
    expect(assignedJobsResponse.body.data.jobs[0].order.id).to.equal(orderId);
    expect(assignedJobsResponse.body.data.jobs[0].item.id).to.equal(orderItemId);
    expect(assignedJobsResponse.body.data.jobs[0].assignedRider.id).to.equal(logistics.riderId);

    const jobId = assignedJobsResponse.body.data.jobs[0].id;
    const jobDetailResponse = await request(app)
      .get(`/api/v1/rider/jobs/${jobId}`)
      .set('Authorization', `Bearer ${logistics.token}`)
      .expect(200);

    expect(jobDetailResponse.body.data.statusHistory).to.have.length(2);
    expect(jobDetailResponse.body.data.statusHistory.map((entry) => entry.status)).to.deep.equal([
      'pending',
      'assigned'
    ]);

    await progressDeliveryJob(app, logistics.token, orderItemId);

    const deliveredJobResponse = await request(app)
      .get(`/api/v1/rider/jobs/${jobId}`)
      .set('Authorization', `Bearer ${logistics.token}`)
      .expect(200);

    expect(deliveredJobResponse.body.data.status).to.equal('delivered');
    expect(deliveredJobResponse.body.data.assignedRider.email).to.equal('logistics@example.com');
    expect(deliveredJobResponse.body.data.assignedCompany.name).to.equal('Swift Dispatch');
    expect(deliveredJobResponse.body.data.deliveryFeeKobo).to.equal(200000);
    expect(deliveredJobResponse.body.data.platformMarginKobo).to.equal(20000);
    expect(deliveredJobResponse.body.data.companyShareKobo).to.equal(180000);
    expect(deliveredJobResponse.body.data.settlementRecordedAt).to.be.a('string');
    expect(deliveredJobResponse.body.data.statusHistory.map((entry) => entry.status)).to.deep.equal([
      'pending',
      'assigned',
      'picked_up',
      'in_transit',
      'delivered'
    ]);

    const companyJobsResponse = await request(app)
      .get('/api/v1/logistics/jobs')
      .set('Authorization', `Bearer ${logistics.companyToken}`)
      .query({
        status: 'delivered'
      })
      .expect(200);

    expect(companyJobsResponse.body.data.jobs).to.have.length(1);
    expect(companyJobsResponse.body.data.jobs[0].assignedRider.id).to.equal(logistics.riderId);
    expect(companyJobsResponse.body.data.summary.jobsByStatus).to.deep.equal({
      total: 1,
      pending: 0,
      assigned: 0,
      picked_up: 0,
      in_transit: 0,
      delivered: 1,
      failed: 0,
      cancelled: 0
    });
    expect(companyJobsResponse.body.data.summary.riderPerformance.summary).to.deep.equal({
      totalRidersCount: 1,
      availableCount: 1,
      onDeliveryCount: 0,
      unavailableCount: 0,
      inactiveCount: 0,
      activeJobsCount: 0,
      deliveredJobsCount: 1,
      failedJobsCount: 0,
      completionRatePercent: 100
    });
    expect(companyJobsResponse.body.data.summary.riderPerformance.riders[0].deliveryFeesKobo)
      .to.equal(200000);

    const earningsResponse = await request(app)
      .get('/api/v1/logistics/earnings')
      .set('Authorization', `Bearer ${logistics.companyToken}`)
      .expect(200);

    expect(earningsResponse.body.data.summary).to.deep.equal({
      completedJobsCount: 1,
      deliveryFeesKobo: 200000,
      platformMarginKobo: 20000,
      companyShareKobo: 180000
    });
    expect(earningsResponse.body.data.payouts).to.deep.equal({
      pendingKobo: 180000,
      requestedKobo: 0,
      approvedKobo: 0,
      paidKobo: 0
    });

    const payoutResponse = await request(app)
      .post('/api/v1/logistics/payouts')
      .set('Authorization', `Bearer ${logistics.companyToken}`)
      .send({
        bankAccountRef: 'BANK-LOG-001'
      })
      .expect(201);

    expect(payoutResponse.body.data.payout.payeeType).to.equal('logistics_company');
    expect(payoutResponse.body.data.payout.deliveryFeeKobo).to.equal(200000);
    expect(payoutResponse.body.data.payout.platformMarginKobo).to.equal(20000);
    expect(payoutResponse.body.data.payout.companyShareKobo).to.equal(180000);

    const earningsAfterPayoutResponse = await request(app)
      .get('/api/v1/logistics/earnings')
      .set('Authorization', `Bearer ${logistics.companyToken}`)
      .expect(200);

    expect(earningsAfterPayoutResponse.body.data.payouts).to.deep.equal({
      pendingKobo: 0,
      requestedKobo: 180000,
      approvedKobo: 0,
      paidKobo: 0
    });

    const buyerStatusResponse = await request(app)
      .get(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200);

    expect(buyerStatusResponse.body.data.currentStatus.status).to.equal('delivered');
    expect(buyerStatusResponse.body.data.history.map((entry) => entry.status)).to.deep.equal([
      'pending_payment',
      'confirmed',
      'picked_up',
      'in_transit',
      'delivered'
    ]);
  });

  it('returns a conflict when a rider tries to skip directly from assigned to in_transit', async () => {
    const sellerToken = await registerAndLoginSeller(app, {
      fullName: 'Uche Okafor',
      email: 'seller-logistics-invalid@example.com',
      phone: '08012345630',
      password: 'Password123',
      businessName: 'Prime Auto Hub',
      contactEmail: 'sales-invalid@primeautohub.ng',
      contactPhone: '08012345630',
      address: '12 Sapara Williams Close, Victoria Island, Lagos',
      cacNumber: 'RC-900010'
    });
    const logistics = await registerAndLoginLogistics(app, {
      fullName: 'Alex Rider',
      email: 'invalid-logistics@example.com',
      phone: '08012345031',
      password: 'Password123',
      providerName: 'Swift Dispatch',
      vehicleType: 'bike'
    });
    const productId = await createSellerListing(app, sellerToken, {
      title: 'Front Brake Pad',
      description: 'Ceramic brake pad set.',
      categoryId: 1002,
      partNumber: 'PAD-LGS-010',
      condition: 'new',
      priceKobo: 2200000,
      stockQty: 6,
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
    const buyerToken = await registerBuyer(app, 'logistics-invalid-buyer@example.com');
    const orderId = await createOrder(app, buyerToken, productId, 1);

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

    const sellerOrdersResponse = await request(app)
      .get('/api/v1/seller/orders')
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(200);
    const orderItemId = sellerOrdersResponse.body.data.orders[0].items[0].id;

    await request(app)
      .patch(`/api/v1/seller/orders/${orderItemId}/status`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        itemStatus: 'ready_for_pickup'
      })
      .expect(200);

    const job = await getDeliveryJobByOrderItemId(app, logistics.token, orderItemId);

    const response = await request(app)
      .patch(`/api/v1/rider/jobs/${job.id}/status`)
      .set('Authorization', `Bearer ${logistics.token}`)
      .send({
        status: 'in_transit'
      })
      .expect(409);

    expect(response.body.success).to.equal(false);
    expect(response.body.error.code).to.equal('CONFLICT');
    expect(response.body.error.message).to.equal('This delivery job status change is not allowed.');
  });

  it('lets a rider mark a delivery job as failed with a reason and releases the rider', async () => {
    const sellerToken = await registerAndLoginSeller(app, {
      fullName: 'Uche Okafor',
      email: 'seller-logistics-failed@example.com',
      phone: '08012345631',
      password: 'Password123',
      businessName: 'Prime Auto Hub',
      contactEmail: 'sales-failed@primeautohub.ng',
      contactPhone: '08012345631',
      address: '12 Sapara Williams Close, Victoria Island, Lagos',
      cacNumber: 'RC-900011'
    });
    const logistics = await registerAndLoginLogistics(app, {
      fullName: 'Alex Rider',
      email: 'failed-logistics@example.com',
      phone: '08012345032',
      password: 'Password123',
      providerName: 'Swift Dispatch',
      vehicleType: 'bike'
    });
    const productId = await createSellerListing(app, sellerToken, {
      title: 'Radiator Hose',
      description: 'Durable upper radiator hose.',
      categoryId: 1002,
      partNumber: 'HOSE-LGS-011',
      condition: 'new',
      priceKobo: 1800000,
      stockQty: 9,
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
    const buyerToken = await registerBuyer(app, 'logistics-failed-buyer@example.com');
    const orderId = await createOrder(app, buyerToken, productId, 1);

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

    const sellerOrdersResponse = await request(app)
      .get('/api/v1/seller/orders')
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(200);
    const orderItemId = sellerOrdersResponse.body.data.orders[0].items[0].id;

    await request(app)
      .patch(`/api/v1/seller/orders/${orderItemId}/status`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        itemStatus: 'ready_for_pickup'
      })
      .expect(200);

    const job = await getDeliveryJobByOrderItemId(app, logistics.token, orderItemId);

    await request(app)
      .patch(`/api/v1/rider/jobs/${job.id}/status`)
      .set('Authorization', `Bearer ${logistics.token}`)
      .send({
        status: 'picked_up'
      })
      .expect(200);

    const failedResponse = await failDeliveryJob(
      app,
      logistics.token,
      orderItemId,
      'Buyer was unreachable at the delivery address.'
    );

    expect(failedResponse.status).to.equal('failed');
    expect(failedResponse.failureReason).to.equal('Buyer was unreachable at the delivery address.');
    expect(failedResponse.item.itemStatus).to.equal('ready_for_pickup');
    expect(failedResponse.order.status).to.equal('confirmed');
    expect(failedResponse.statusHistory.map((entry) => entry.status)).to.deep.equal([
      'pending',
      'assigned',
      'picked_up',
      'failed'
    ]);

    const riderMeResponse = await request(app)
      .get('/api/v1/rider/me')
      .set('Authorization', `Bearer ${logistics.token}`)
      .expect(200);

    expect(riderMeResponse.body.data.rider.status).to.equal('available');

    const buyerStatusResponse = await request(app)
      .get(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${buyerToken}`)
      .expect(200);

    expect(buyerStatusResponse.body.data.currentStatus.status).to.equal('confirmed');
    expect(buyerStatusResponse.body.data.history.map((entry) => entry.status)).to.deep.equal([
      'pending_payment',
      'confirmed',
      'picked_up',
      'confirmed'
    ]);

    const companyJobsResponse = await request(app)
      .get('/api/v1/logistics/jobs')
      .set('Authorization', `Bearer ${logistics.companyToken}`)
      .query({
        status: 'failed'
      })
      .expect(200);

    expect(companyJobsResponse.body.data.jobs).to.have.length(1);
    expect(companyJobsResponse.body.data.jobs[0].failureReason).to.equal(
      'Buyer was unreachable at the delivery address.'
    );
  });

  it('prevents another rider from hijacking an already assigned delivery job', async () => {
    const sellerToken = await registerAndLoginSeller(app, {
      fullName: 'Uche Okafor',
      email: 'seller-logistics-block@example.com',
      phone: '08012345679',
      password: 'Password123',
      businessName: 'Prime Auto Hub',
      contactEmail: 'sales2@primeautohub.ng',
      contactPhone: '08012345679',
      address: '12 Sapara Williams Close, Victoria Island, Lagos',
      cacNumber: 'RC-900002'
    });
    const firstLogistics = await registerAndLoginLogistics(app, {
      fullName: 'Alex Rider',
      email: 'logistics-first@example.com',
      phone: '08012345011',
      password: 'Password123',
      providerName: 'Swift Dispatch',
      vehicleType: 'bike',
      plateNumber: 'LAG-511XY'
    });
    const secondLogistics = await registerAndLoginLogistics(app, {
      fullName: 'Musa Bello',
      email: 'logistics-second@example.com',
      phone: '08012345012',
      password: 'Password123',
      providerName: 'Fast Lane',
      vehicleType: 'truck',
      plateNumber: 'ABJ-900TR'
    });
    const productId = await createSellerListing(app, sellerToken, {
      title: 'Rear Shock Absorber',
      description: 'Gas-filled rear shock absorber for Honda Accord.',
      categoryId: 1003,
      partNumber: 'SHOCK-LGS-002',
      condition: 'new',
      priceKobo: 3200000,
      stockQty: 5,
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
    const buyerToken = await registerBuyer(app, 'logistics-block-buyer@example.com');
    const orderId = await createOrder(app, buyerToken, productId, 1);

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

    const sellerOrdersResponse = await request(app)
      .get('/api/v1/seller/orders')
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(200);
    const orderItemId = sellerOrdersResponse.body.data.orders[0].items[0].id;

    await request(app)
      .patch(`/api/v1/seller/orders/${orderItemId}/status`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        itemStatus: 'ready_for_pickup'
      })
      .expect(200);

    const job = await getDeliveryJobByOrderItemId(app, firstLogistics.token, orderItemId);

    await request(app)
      .patch(`/api/v1/rider/jobs/${job.id}/status`)
      .set('Authorization', `Bearer ${firstLogistics.token}`)
      .send({
        status: 'picked_up'
      })
      .expect(200);

    const response = await request(app)
      .patch(`/api/v1/rider/jobs/${job.id}/status`)
      .set('Authorization', `Bearer ${secondLogistics.token}`)
      .send({
        status: 'in_transit'
      })
      .expect(403);

    expect(response.body.success).to.equal(false);
    expect(response.body.error.code).to.equal('FORBIDDEN');
  });
});
