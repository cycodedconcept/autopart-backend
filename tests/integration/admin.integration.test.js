require('../setup/mocha');

const bcrypt = require('bcrypt');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const chai = require('chai');
const request = require('supertest');
const { PNG_IMAGE } = require('./support/image-fixtures');
const { ADMIN_ROLE_NAMES } = require('../../src/config/constants');
const { createApp } = require('../../src/app');
const { createInMemoryBuyerAddressesRepository } = require('./support/in-memory-buyer-addresses-repository');
const { createInMemoryCartsRepository } = require('./support/in-memory-carts-repository');
const { createInMemoryCommerceStore } = require('./support/in-memory-commerce-store');
const { createFakePaystackClient } = require('./support/fake-paystack-client');
const { createInMemoryAdminRepository } = require('./support/in-memory-admin-repository');
const { createInMemoryAdminDashboardRepository } = require('./support/in-memory-admin-dashboard-repository');
const { createInMemoryAuditLogRepository } = require('./support/in-memory-audit-log-repository');
const { createInMemoryDeliveryJobsRepository } = require('./support/in-memory-delivery-jobs-repository');
const { createInMemoryDisputesRepository } = require('./support/in-memory-disputes-repository');
const { createInMemoryLogisticsRepository } = require('./support/in-memory-logistics-repository');
const { createInMemoryOrdersRepository } = require('./support/in-memory-orders-repository');
const { createInMemoryPaymentsRepository } = require('./support/in-memory-payments-repository');
const { createInMemoryPlatformConfigRepository } = require('./support/in-memory-platform-config-repository');
const { createInMemoryProductsRepository } = require('./support/in-memory-products-repository');
const { createInMemorySellerFinanceRepository } = require('./support/in-memory-seller-finance-repository');
const { createInMemorySellersRepository } = require('./support/in-memory-sellers-repository');
const { createInMemoryUsersRepository } = require('./support/in-memory-users-repository');
const {
  progressDeliveryJob,
  registerAndLoginLogistics
} = require('./support/logistics-test-helpers');

const { expect } = chai;

async function loginAdmin(app, credentials = {}) {
  const response = await request(app)
    .post('/api/v1/admin/login')
    .send({
      email: credentials.email || 'superadmin@autoparts.local',
      password: credentials.password || 'Password123'
    })
    .expect(200);

  return response.body.data.token;
}

async function registerSeller(app, email, cacNumber, overrides = {}) {
  const numericSeed = String(cacNumber || '')
    .replace(/\D/g, '')
    .slice(-8)
    .padStart(8, '0');
  const phone = overrides.phone || `080${numericSeed}`;

  const registerResponse = await request(app)
    .post('/api/v1/seller/register')
    .send({
      fullName: overrides.fullName || 'Uche Okafor',
      email,
      phone,
      password: 'Password123',
      businessName: overrides.businessName || 'Prime Auto Hub',
      contactEmail: overrides.contactEmail || `sales+${numericSeed}@primeautohub.ng`,
      contactPhone: overrides.contactPhone || phone,
      address: overrides.address || '12 Sapara Williams Close, Victoria Island, Lagos',
      cacNumber
    })
    .expect(201);
  const sellerId = registerResponse.body.data.sellerProfile.id;
  const loginResponse = await request(app)
    .post('/api/v1/auth/login')
    .send({
      identifier: email,
      password: 'Password123'
    })
    .expect(200);

  return {
    sellerId,
    userId: registerResponse.body.data.user.id,
    token: loginResponse.body.data.token
  };
}

async function registerBuyer(app, email = 'buyer@example.com') {
  const registerResponse = await request(app)
    .post('/api/v1/auth/register')
    .send({
      fullName: 'Bola Adeniran',
      email,
      password: 'Password123'
    })
    .expect(201);

  return {
    userId: registerResponse.body.data.user.id,
    token: registerResponse.body.data.token,
    email
  };
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
    .attach('photos', PNG_IMAGE, {
      filename: `${product.partNumber}.png`,
      contentType: 'image/png'
    })
    .expect(201);

  return response.body.data.id;
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

async function createOrder(app, token, productId, quantity = 2, deliveryAddress = null) {
  await request(app)
    .post('/api/v1/cart/items')
    .set('Authorization', `Bearer ${token}`)
    .send({
      productId,
      quantity
    })
    .expect(200);

  const createOrderResponse = await request(app)
    .post('/api/v1/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({
      paymentMethod: 'paystack',
      deliveryAddress: deliveryAddress || {
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

  await request(app)
    .get('/api/v1/payments/callback')
    .set('Authorization', `Bearer ${token}`)
    .query({
      reference: initializeResponse.body.data.payment.reference
    })
    .expect(200);
}

describe('Admin API integration', () => {
  let adminRepository;
  let adminDashboardRepository;
  let auditLogRepository;
  let app;
  let cacVerificationService;
  let disputesRepository;
  let platformConfigRepository;
  let uploadDirectory;

  beforeEach(async () => {
    const commerceStore = createInMemoryCommerceStore();
    const usersRepository = createInMemoryUsersRepository();
    const sellersRepository = createInMemorySellersRepository({ usersRepository });
    const productsRepository = createInMemoryProductsRepository();
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

    adminRepository = createInMemoryAdminRepository({ sellersRepository });
    adminDashboardRepository = createInMemoryAdminDashboardRepository({
      sellersRepository,
      store: commerceStore,
      usersRepository
    });
    auditLogRepository = createInMemoryAuditLogRepository({ adminRepository });
    platformConfigRepository = createInMemoryPlatformConfigRepository();
    disputesRepository = createInMemoryDisputesRepository({
      adminRepository,
      sellersRepository,
      store: commerceStore,
      usersRepository
    });
    cacVerificationService = {
      verifyBusiness: async () => ({
        checkedAt: '2026-07-09T09:30:00.000Z',
        response: {
          body: {
            entity_name: 'Prime Auto Hub',
            registration_number: 'RC-777001'
          },
          httpStatusCode: 200
        },
        status: 'completed'
      })
    };

    await adminRepository.createAdmin({
      fullName: 'Super Admin',
      email: 'superadmin@autoparts.local',
      passwordHash: await bcrypt.hash('Password123', 4),
      roleNames: [ADMIN_ROLE_NAMES.SUPER_ADMIN]
    });

    await adminRepository.createAdmin({
      fullName: 'Operations Admin',
      email: 'ops-admin@autoparts.local',
      passwordHash: await bcrypt.hash('Password123', 4),
      roleNames: []
    });

    uploadDirectory = path.join(os.tmpdir(), `autoparts-admin-${Date.now()}`);
    app = createApp({
      deliveryJobsRepository,
      logisticsRepository,
      cacVerificationService,
      usersRepository,
      sellersRepository,
      productsRepository,
      buyerAddressesRepository: createInMemoryBuyerAddressesRepository({ store: commerceStore }),
      cartsRepository: createInMemoryCartsRepository({ productsRepository, store: commerceStore }),
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
      disputesRepository,
      auditLogRepository,
      adminDashboardRepository,
      paystackClient: createFakePaystackClient(),
      adminRepository,
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
        DOJAH_BASE_URL: 'https://api.dojah.io',
        DOJAH_APP_ID: '',
        DOJAH_API_KEY: '',
        PLATFORM_COMMISSION_RATE_PERCENT: 10,
        SUPER_ADMIN_EMAIL: 'superadmin@autoparts.local',
        SUPER_ADMIN_PASSWORD: 'Password123'
      }
    });
  });

  afterEach(async () => {
    await fs.rm(uploadDirectory, {
      recursive: true,
      force: true
    });
  });

  it('logs in a super admin, returns /admin/me, and allows seller verification actions', async () => {
    const seller = await registerSeller(app, 'seller-review@example.com', 'RC-777001');

    await request(app)
      .post('/api/v1/seller/documents')
      .set('Authorization', `Bearer ${seller.token}`)
      .attach('cacDocument', Buffer.from('fake-cac-pdf'), {
        filename: 'cac-document.pdf',
        contentType: 'application/pdf'
      })
      .attach('proofOfAddressDocument', Buffer.from('fake-proof-pdf'), {
        filename: 'proof-of-address.pdf',
        contentType: 'application/pdf'
      })
      .expect(200);

    const adminToken = await loginAdmin(app);
    const meResponse = await request(app)
      .get('/api/v1/admin/me')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(meResponse.body.data.email).to.equal('superadmin@autoparts.local');
    expect(meResponse.body.data.roles).to.deep.equal(['super_admin']);
    expect(meResponse.body.data.permissions).to.include('admins.read_self');
    expect(meResponse.body.data.permissions).to.include('sellers.verify');

    const queueResponse = await request(app)
      .get('/api/v1/admin/sellers')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        status: 'pending'
      })
      .expect(200);

    expect(queueResponse.body.data.sellers).to.have.length(1);
    expect(queueResponse.body.data.sellers[0].sellerProfile.documents).to.have.length(2);
    expect(queueResponse.body.data.sellers[0].sellerProfile.verificationStatus).to.equal('pending');
    expect(queueResponse.body.data.sellers[0].sellerProfile.cacVerification.status).to.equal('completed');

    const detailResponse = await request(app)
      .get(`/api/v1/admin/sellers/${seller.sellerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(detailResponse.body.data.sellerProfile.documents).to.have.length(2);
    expect(detailResponse.body.data.sellerProfile.cacVerification.response.httpStatusCode).to.equal(200);

    const approveResponse = await request(app)
      .patch(`/api/v1/admin/sellers/${seller.sellerId}/verification`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        verificationStatus: 'verified'
      })
      .expect(200);

    expect(approveResponse.body.data.sellerProfile.verificationStatus).to.equal('verified');
    expect(approveResponse.body.data.sellerProfile.rejectionReason).to.equal(null);
    expect(approveResponse.body.data.sellerProfile.verifiedBy).to.equal(1);
    expect(approveResponse.body.data.user.isVerified).to.equal(true);

    const sellerMeResponse = await request(app)
      .get('/api/v1/seller/me')
      .set('Authorization', `Bearer ${seller.token}`)
      .expect(200);

    expect(sellerMeResponse.body.data.sellerProfile.verificationStatus).to.equal('verified');
  });

  it('manages category trees and vehicle taxonomy, then allows sellers to use the admin-managed catalogue data', async () => {
    const adminToken = await loginAdmin(app);

    const createRootCategoryResponse = await request(app)
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Cooling System'
      })
      .expect(201);

    const rootCategoryId = createRootCategoryResponse.body.data.id;

    const createChildCategoryResponse = await request(app)
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Radiators',
        parentId: rootCategoryId
      })
      .expect(201);

    expect(createChildCategoryResponse.body.data.parent.id).to.equal(rootCategoryId);

    const listCategoriesResponse = await request(app)
      .get('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const coolingSystemCategory = listCategoriesResponse.body.data.categories.find((category) => (
      category.id === rootCategoryId
    ));

    expect(coolingSystemCategory.children).to.have.length(1);
    expect(coolingSystemCategory.children[0].name).to.equal('Radiators');

    const categoryDetailResponse = await request(app)
      .get(`/api/v1/admin/categories/${createChildCategoryResponse.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(categoryDetailResponse.body.data.parent.id).to.equal(rootCategoryId);

    const updatedCategoryResponse = await request(app)
      .patch(`/api/v1/admin/categories/${createChildCategoryResponse.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Radiators & Cooling Fans'
      })
      .expect(200);

    expect(updatedCategoryResponse.body.data.name).to.equal('Radiators & Cooling Fans');
    expect(updatedCategoryResponse.body.data.slug).to.equal('radiators');

    const createVehicleTaxonomyResponse = await request(app)
      .post('/api/v1/admin/vehicle-taxonomy')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        make: 'Mazda',
        model: 'CX-5',
        yearFrom: 2018,
        yearTo: 2021
      })
      .expect(201);

    const vehicleTaxonomyId = createVehicleTaxonomyResponse.body.data.id;

    const listVehicleTaxonomyResponse = await request(app)
      .get('/api/v1/admin/vehicle-taxonomy')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        make: 'Mazda'
      })
      .expect(200);

    expect(listVehicleTaxonomyResponse.body.data.entries).to.have.length(1);

    const vehicleTaxonomyDetailResponse = await request(app)
      .get(`/api/v1/admin/vehicle-taxonomy/${vehicleTaxonomyId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(vehicleTaxonomyDetailResponse.body.data.model).to.equal('CX-5');

    const updatedVehicleTaxonomyResponse = await request(app)
      .patch(`/api/v1/admin/vehicle-taxonomy/${vehicleTaxonomyId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        model: 'CX-5 Signature'
      })
      .expect(200);

    expect(updatedVehicleTaxonomyResponse.body.data.model).to.equal('CX-5 Signature');

    const seller = await registerSeller(app, 'seller-catalogue@example.com', 'RC-777002');
    const createProductResponse = await request(app)
      .post('/api/v1/seller/products')
      .set('Authorization', `Bearer ${seller.token}`)
      .field('title', 'Mazda CX-5 Radiator Assembly')
      .field('description', 'Radiator assembly for Mazda CX-5 Signature SUVs.')
      .field('categoryId', String(createChildCategoryResponse.body.data.id))
      .field('partNumber', 'RAD-CX5-2018')
      .field('condition', 'new')
      .field('priceKobo', '8950000')
      .field('stockQty', '6')
      .field('location', 'Lagos')
      .field('compatibility', JSON.stringify([
        {
          make: 'Mazda',
          model: 'CX-5 Signature',
          yearFrom: 2018,
          yearTo: 2021
        }
      ]))
      .attach('photos', PNG_IMAGE, {
        filename: 'radiator-1.png',
        contentType: 'image/png'
      })
      .expect(201);

    expect(createProductResponse.body.data.category.id).to.equal(createChildCategoryResponse.body.data.id);

    const publicListResponse = await request(app)
      .get('/api/v1/products')
      .query({
        category: 'radiators',
        vehicleMake: 'Mazda',
        vehicleModel: 'CX-5 Signature',
        vehicleYear: 2019
      })
      .expect(200);

    expect(publicListResponse.body.data.products).to.have.length(1);
    expect(publicListResponse.body.data.products[0].title).to.equal('Mazda CX-5 Radiator Assembly');
  });

  it('archives categories instead of permanently deleting them and still deletes unused vehicle taxonomy entries', async () => {
    const adminToken = await loginAdmin(app);

    const categoryResponse = await request(app)
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Body Panels'
      })
      .expect(201);

    const childCategoryResponse = await request(app)
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Bumpers',
        parentId: categoryResponse.body.data.id
      })
      .expect(201);

    const deleteCategoryResponse = await request(app)
      .delete(`/api/v1/admin/categories/${categoryResponse.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(deleteCategoryResponse.body.data.name).to.equal('Body Panels');
    expect(deleteCategoryResponse.body.data.status).to.equal('archived');
    expect(deleteCategoryResponse.body.data.children[0].status).to.equal('archived');

    const archivedCategoriesResponse = await request(app)
      .get('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        status: 'archived'
      })
      .expect(200);

    expect(archivedCategoriesResponse.body.data.categories[0].name).to.equal('Body Panels');

    const childCategoryDetailResponse = await request(app)
      .get(`/api/v1/admin/categories/${childCategoryResponse.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(childCategoryDetailResponse.body.data.status).to.equal('archived');

    const vehicleTaxonomyResponse = await request(app)
      .post('/api/v1/admin/vehicle-taxonomy')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        make: 'Ford',
        model: 'Escape',
        yearFrom: 2015,
        yearTo: 2018
      })
      .expect(201);

    const deleteVehicleTaxonomyResponse = await request(app)
      .delete(`/api/v1/admin/vehicle-taxonomy/${vehicleTaxonomyResponse.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(deleteVehicleTaxonomyResponse.body.data.model).to.equal('Escape');
  });

  it('lists buyers and sellers, then lets admin suspend a seller account', async () => {
    const buyer = await registerBuyer(app, 'buyer-oversight@example.com');
    const seller = await registerSeller(app, 'seller-oversight@example.com', 'RC-777003');
    const adminToken = await loginAdmin(app);

    const listUsersResponse = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        page: 1,
        limit: 10
      })
      .expect(200);

    expect(listUsersResponse.body.data.users).to.have.length(2);
    expect(listUsersResponse.body.data.users.map((user) => user.role)).to.include('buyer');
    expect(listUsersResponse.body.data.users.map((user) => user.role)).to.include('seller');

    const sellerEntry = listUsersResponse.body.data.users.find((user) => user.id === seller.userId);
    expect(sellerEntry.accountStatus).to.equal('active');
    expect(sellerEntry.sellerProfile.businessName).to.equal('Prime Auto Hub');

    const buyerSearchResponse = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        role: 'buyer',
        search: buyer.email
      })
      .expect(200);

    expect(buyerSearchResponse.body.data.users).to.have.length(1);
    expect(buyerSearchResponse.body.data.users[0].id).to.equal(buyer.userId);

    const suspendResponse = await request(app)
      .patch(`/api/v1/admin/users/${seller.userId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'suspended'
      })
      .expect(200);

    expect(suspendResponse.body.data.accountStatus).to.equal('suspended');

    const sellerMeResponse = await request(app)
      .get('/api/v1/seller/me')
      .set('Authorization', `Bearer ${seller.token}`)
      .expect(403);

    expect(sellerMeResponse.body.error.code).to.equal('FORBIDDEN');

    const sellerLoginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        identifier: 'seller-oversight@example.com',
        password: 'Password123'
      })
      .expect(403);

    expect(sellerLoginResponse.body.error.code).to.equal('FORBIDDEN');
  });

  it('lists platform orders and lets admin move a paid order forward with status history', async () => {
    const buyer = await registerBuyer(app, 'buyer-orders@example.com');
    const orderId = await createPendingOrder(app, buyer.token);

    await confirmOrderPayment(app, buyer.token, orderId);

    const adminToken = await loginAdmin(app);
    const listOrdersResponse = await request(app)
      .get('/api/v1/admin/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        status: 'confirmed',
        paymentStatus: 'paid',
        search: buyer.email
      })
      .expect(200);

    expect(listOrdersResponse.body.data.orders).to.have.length(1);
    expect(listOrdersResponse.body.data.orders[0].id).to.equal(orderId);
    expect(listOrdersResponse.body.data.orders[0].buyer.email).to.equal(buyer.email);
    expect(listOrdersResponse.body.data.orders[0].sellerCount).to.equal(1);

    const updateOrderResponse = await request(app)
      .patch(`/api/v1/admin/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'picked_up',
        note: 'Collected from seller by operations team.'
      })
      .expect(200);

    expect(updateOrderResponse.body.data.status).to.equal('picked_up');
    expect(updateOrderResponse.body.data.statusHistory.map((entry) => entry.status)).to.deep.equal([
      'pending_payment',
      'confirmed',
      'picked_up'
    ]);

    const buyerStatusResponse = await request(app)
      .get(`/api/v1/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${buyer.token}`)
      .expect(200);

    expect(buyerStatusResponse.body.data.currentStatus.status).to.equal('picked_up');
    expect(buyerStatusResponse.body.data.history.map((entry) => entry.status)).to.deep.equal([
      'pending_payment',
      'confirmed',
      'picked_up'
    ]);
  });

  it('updates platform config, reviews payout requests, and advances payouts through approval to paid', async () => {
    const seller = await registerSeller(app, 'seller-payouts@example.com', 'RC-777004');
    const buyer = await registerBuyer(app, 'buyer-payouts@example.com');
    const adminToken = await loginAdmin(app);
    const logistics = await registerAndLoginLogistics(app, {
      fullName: 'Alex Rider',
      email: 'logistics-admin@example.com',
      phone: '08012345003',
      password: 'Password123',
      providerName: 'Swift Dispatch',
      vehicleType: 'van',
      plateNumber: 'LAG-503XY'
    });

    const configResponse = await request(app)
      .get('/api/v1/admin/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(configResponse.body.data.commissionRateDefault).to.equal(10);
    expect(configResponse.body.data.commissionRatesByCategory).to.deep.equal([]);

    const updatedConfigResponse = await request(app)
      .patch('/api/v1/admin/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        commissionRateDefault: 12,
        commissionRatesByCategory: [
          {
            categoryId: 1002,
            ratePercent: 15
          }
        ],
        commissionRatesBySellerTier: [
          {
            tier: 'gold',
            ratePercent: 8
          }
        ],
        platformSettings: {
          payoutBatchCutoffHour: 17
        }
      })
      .expect(200);

    expect(updatedConfigResponse.body.data.commissionRateDefault).to.equal(12);
    expect(updatedConfigResponse.body.data.commissionRatesByCategory[0]).to.deep.equal({
      categoryId: 1002,
      ratePercent: 15
    });
    expect(updatedConfigResponse.body.data.commissionRatesBySellerTier[0]).to.deep.equal({
      tier: 'gold',
      ratePercent: 8
    });
    expect(updatedConfigResponse.body.data.platformSettings.payoutBatchCutoffHour).to.equal(17);

    const productId = await createSellerListing(app, seller.token, {
      title: 'Rear Brake Disc',
      description: 'Premium brake disc for Toyota Camry sedans.',
      categoryId: 1002,
      partNumber: 'DISC-ADMIN-001',
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
    const orderId = await createOrder(app, buyer.token, productId, 2);

    await confirmOrderPayment(app, buyer.token, orderId);

    const today = new Date().toISOString().slice(0, 10);
    const sellerSalesBeforeDeliveryResponse = await request(app)
      .get('/api/v1/seller/sales')
      .set('Authorization', `Bearer ${seller.token}`)
      .query({
        dateFrom: today,
        dateTo: today
      })
      .expect(200);

    expect(sellerSalesBeforeDeliveryResponse.body.data.payouts.pendingKobo).to.equal(0);

    const sellerOrdersResponse = await request(app)
      .get('/api/v1/seller/orders')
      .set('Authorization', `Bearer ${seller.token}`)
      .expect(200);
    const orderItemId = sellerOrdersResponse.body.data.orders[0].items[0].id;

    await request(app)
      .patch(`/api/v1/seller/orders/${orderItemId}/status`)
      .set('Authorization', `Bearer ${seller.token}`)
      .send({
        itemStatus: 'ready_for_pickup'
      })
      .expect(200);

    await progressDeliveryJob(app, logistics.token, orderItemId);

    const sellerSalesResponse = await request(app)
      .get('/api/v1/seller/sales')
      .set('Authorization', `Bearer ${seller.token}`)
      .query({
        dateFrom: today,
        dateTo: today
      })
      .expect(200);

    expect(sellerSalesResponse.body.data.commissionRatePercent).to.equal(12);
    expect(sellerSalesResponse.body.data.sales.commissionKobo).to.equal(1080000);
    expect(sellerSalesResponse.body.data.payouts.pendingKobo).to.equal(7920000);

    const payoutRequestResponse = await request(app)
      .post('/api/v1/seller/payouts')
      .set('Authorization', `Bearer ${seller.token}`)
      .send({
        bankAccountRef: 'BANK-ADMIN-001'
      })
      .expect(201);

    expect(payoutRequestResponse.body.data.status).to.equal('requested');
    expect(payoutRequestResponse.body.data.amountKobo).to.equal(7920000);

    const payoutListResponse = await request(app)
      .get('/api/v1/admin/payouts')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        status: 'requested',
        search: 'seller-payouts@example.com'
      })
      .expect(200);

    expect(payoutListResponse.body.data.payouts).to.have.length(1);
    expect(payoutListResponse.body.data.payouts[0].seller.businessName).to.equal('Prime Auto Hub');
    expect(payoutListResponse.body.data.payouts[0].items).to.have.length(1);

    const payoutId = payoutListResponse.body.data.payouts[0].id;
    const approvePayoutResponse = await request(app)
      .patch(`/api/v1/admin/payouts/${payoutId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'approved'
      })
      .expect(200);

    expect(approvePayoutResponse.body.data.status).to.equal('approved');
    expect(approvePayoutResponse.body.data.approvedBy).to.equal(1);
    expect(approvePayoutResponse.body.data.approvedAt).to.be.a('string');

    const markPaidResponse = await request(app)
      .patch(`/api/v1/admin/payouts/${payoutId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'paid'
      })
      .expect(200);

    expect(markPaidResponse.body.data.status).to.equal('paid');
    expect(markPaidResponse.body.data.settledAt).to.be.a('string');

    const logisticsPayoutRequestResponse = await request(app)
      .post('/api/v1/logistics/payouts')
      .set('Authorization', `Bearer ${logistics.companyToken}`)
      .send({
        bankAccountRef: 'BANK-LOG-ADMIN-001'
      })
      .expect(201);

    expect(logisticsPayoutRequestResponse.body.data.payout.payeeType).to.equal('logistics_company');
    expect(logisticsPayoutRequestResponse.body.data.payout.companyShareKobo).to.equal(184500);

    const logisticsPayoutListResponse = await request(app)
      .get('/api/v1/admin/payouts')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        payeeType: 'logistics_company',
        companyId: logistics.companyId,
        status: 'requested'
      })
      .expect(200);

    expect(logisticsPayoutListResponse.body.data.payouts).to.have.length(1);
    expect(logisticsPayoutListResponse.body.data.payouts[0].payeeType).to.equal('logistics_company');
    expect(logisticsPayoutListResponse.body.data.payouts[0].logisticsCompany.name).to.equal(
      'Swift Dispatch'
    );

    const logisticsPayoutId = logisticsPayoutListResponse.body.data.payouts[0].id;
    const approveLogisticsPayoutResponse = await request(app)
      .patch(`/api/v1/admin/payouts/${logisticsPayoutId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'approved'
      })
      .expect(200);

    expect(approveLogisticsPayoutResponse.body.data.status).to.equal('approved');
    expect(approveLogisticsPayoutResponse.body.data.payeeType).to.equal('logistics_company');

    const markLogisticsPayoutPaidResponse = await request(app)
      .patch(`/api/v1/admin/payouts/${logisticsPayoutId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'paid'
      })
      .expect(200);

    expect(markLogisticsPayoutPaidResponse.body.data.status).to.equal('paid');
    expect(markLogisticsPayoutPaidResponse.body.data.settledAt).to.be.a('string');
  });

  it('returns the super admin dashboard summary with alerts, previews, and leaderboard widgets', async () => {
    const approvedSeller = await registerSeller(app, 'seller-dashboard-approved@example.com', 'RC-777006');

    await request(app)
      .post('/api/v1/seller/documents')
      .set('Authorization', `Bearer ${approvedSeller.token}`)
      .attach('cacDocument', Buffer.from('fake-cac-pdf'), {
        filename: 'approved-cac-document.pdf',
        contentType: 'application/pdf'
      })
      .attach('proofOfAddressDocument', Buffer.from('fake-proof-pdf'), {
        filename: 'approved-proof-of-address.pdf',
        contentType: 'application/pdf'
      })
      .expect(200);

    const pendingSeller = await registerSeller(app, 'seller-dashboard-pending@example.com', 'RC-777007');

    await request(app)
      .post('/api/v1/seller/documents')
      .set('Authorization', `Bearer ${pendingSeller.token}`)
      .attach('cacDocument', Buffer.from('fake-cac-pdf'), {
        filename: 'pending-cac-document.pdf',
        contentType: 'application/pdf'
      })
      .attach('proofOfAddressDocument', Buffer.from('fake-proof-pdf'), {
        filename: 'pending-proof-of-address.pdf',
        contentType: 'application/pdf'
      })
      .expect(200);

    const adminToken = await loginAdmin(app);
    const logistics = await registerAndLoginLogistics(app, {
      fullName: 'Alex Rider',
      email: 'logistics-dashboard-admin@example.com',
      phone: '08012345004',
      password: 'Password123',
      providerName: 'Swift Dispatch',
      vehicleType: 'van',
      plateNumber: 'LAG-504XY'
    });

    await request(app)
      .patch(`/api/v1/admin/sellers/${approvedSeller.sellerId}/verification`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        verificationStatus: 'verified'
      })
      .expect(200);

    const productId = await createSellerListing(app, approvedSeller.token, {
      title: 'Premium Brake Disc',
      description: 'Premium brake disc for Toyota Camry sedans.',
      categoryId: 1002,
      partNumber: 'DISC-DASHBOARD-001',
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
    const buyer = await registerBuyer(app, 'buyer-dashboard@example.com');
    const orderId = await createOrder(app, buyer.token, productId, 2);

    await confirmOrderPayment(app, buyer.token, orderId);

    const sellerOrdersResponse = await request(app)
      .get('/api/v1/seller/orders')
      .set('Authorization', `Bearer ${approvedSeller.token}`)
      .expect(200);
    const orderItemId = sellerOrdersResponse.body.data.orders[0].items[0].id;

    await request(app)
      .patch(`/api/v1/seller/orders/${orderItemId}/status`)
      .set('Authorization', `Bearer ${approvedSeller.token}`)
      .send({
        itemStatus: 'ready_for_pickup'
      })
      .expect(200);

    await progressDeliveryJob(app, logistics.token, orderItemId);

    await request(app)
      .post('/api/v1/seller/payouts')
      .set('Authorization', `Bearer ${approvedSeller.token}`)
      .send({
        bankAccountRef: 'BANK-DASHBOARD-001'
      })
      .expect(201);

    await disputesRepository.createDispute({
      orderId,
      raisedBy: 'buyer',
      reason: 'Buyer reported a damaged part on delivery.'
    });

    const dashboardResponse = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(dashboardResponse.body.data.alerts.openDisputes.count).to.equal(1);
    expect(dashboardResponse.body.data.alerts.pendingVerifications.count).to.equal(1);
    expect(dashboardResponse.body.data.alerts.payoutRequests.count).to.equal(1);
    expect(dashboardResponse.body.data.overviewCards.activeSellers.value).to.equal(1);
    expect(dashboardResponse.body.data.overviewCards.ordersToday.value).to.equal(1);
    expect(dashboardResponse.body.data.overviewCards.platformGmv.valueKobo).to.be.greaterThan(0);
    expect(dashboardResponse.body.data.sellerVerificationQueue.total).to.equal(1);
    expect(dashboardResponse.body.data.openDisputes.total).to.equal(1);
    expect(dashboardResponse.body.data.openDisputes.items[0].orderId).to.equal(orderId);
    expect(dashboardResponse.body.data.recentOrders.items[0].orderId).to.equal(orderId);
    expect(dashboardResponse.body.data.topSellers.total).to.equal(1);
    expect(dashboardResponse.body.data.payoutQueue.total).to.equal(1);
    expect(dashboardResponse.body.data.recentActivity).to.not.be.empty;
    expect(dashboardResponse.body.data.platformHealth.metrics.payoutCompletionRatePercent).to.equal(0);
  });

  it('lists disputes, resolves an open dispute, and exposes the resulting audit log entry', async () => {
    const seller = await registerSeller(app, 'seller-disputes@example.com', 'RC-777005');
    const buyer = await registerBuyer(app, 'buyer-disputes@example.com');
    const adminToken = await loginAdmin(app);

    const productId = await createSellerListing(app, seller.token, {
      title: 'Front Shock Absorber',
      description: 'Front shock absorber for Toyota Camry sedans.',
      categoryId: 1002,
      partNumber: 'SHOCK-ADMIN-001',
      condition: 'new',
      priceKobo: 3750000,
      stockQty: 5,
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
    const orderId = await createOrder(app, buyer.token, productId, 1);

    await confirmOrderPayment(app, buyer.token, orderId);

    await disputesRepository.createDispute({
      orderId,
      raisedBy: 'buyer',
      reason: 'Buyer reported a damaged part on delivery.'
    });

    const listDisputesResponse = await request(app)
      .get('/api/v1/admin/disputes')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        status: 'open',
        raisedBy: 'buyer',
        search: 'damaged'
      })
      .expect(200);

    expect(listDisputesResponse.body.data.disputes).to.have.length(1);
    expect(listDisputesResponse.body.data.disputes[0].order.id).to.equal(orderId);
    expect(listDisputesResponse.body.data.disputes[0].buyer.email).to.equal('buyer-disputes@example.com');

    const disputeId = listDisputesResponse.body.data.disputes[0].id;
    const resolveDisputeResponse = await request(app)
      .patch(`/api/v1/admin/disputes/${disputeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'resolved',
        resolutionNote: 'Refund approved after confirming the damaged item.',
        refundReference: 'RFD-5001',
        refundAmountKobo: 1500000
      })
      .expect(200);

    expect(resolveDisputeResponse.body.data.status).to.equal('resolved');
    expect(resolveDisputeResponse.body.data.refundReference).to.equal('RFD-5001');
    expect(resolveDisputeResponse.body.data.resolvedBy).to.equal(1);
    expect(resolveDisputeResponse.body.data.resolvedByAdmin.email).to.equal('superadmin@autoparts.local');

    const auditLogsResponse = await request(app)
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        action: 'dispute.resolved',
        targetType: 'dispute',
        targetId: disputeId
      })
      .expect(200);

    expect(auditLogsResponse.body.data.auditLogs).to.have.length(1);
    expect(auditLogsResponse.body.data.auditLogs[0].detail.refundAmountKobo).to.equal(1500000);
    expect(auditLogsResponse.body.data.auditLogs[0].admin.email).to.equal('superadmin@autoparts.local');
  });

  it('lists logistics companies and riders, then allows admin to approve a company', async () => {
    const logisticsRegisterResponse = await request(app)
      .post('/api/v1/logistics/register')
      .send({
        name: 'Swift Dispatch',
        email: 'ops@swiftdispatch.ng',
        phone: '08012345091',
        password: 'Password123',
        address: '12 Sapara Williams Close, Victoria Island, Lagos'
      })
      .expect(201);
    const companyId = logisticsRegisterResponse.body.data.company.id;
    const companyToken = logisticsRegisterResponse.body.data.token;

    const zonesResponse = await request(app)
      .get('/api/v1/logistics/zones')
      .set('Authorization', `Bearer ${companyToken}`)
      .expect(200);

    await request(app)
      .post('/api/v1/logistics/riders')
      .set('Authorization', `Bearer ${companyToken}`)
      .send({
        fullName: 'Alex Rider',
        email: 'alex.admin@swiftdispatch.ng',
        phone: '08012345092',
        password: 'Password123',
        vehicleType: 'van',
        zoneId: zonesResponse.body.data.zones[0].id,
        status: 'available'
      })
      .expect(201);

    const adminToken = await loginAdmin(app);

    const companiesResponse = await request(app)
      .get('/api/v1/admin/logistics/companies')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        status: 'pending',
        search: 'swift'
      })
      .expect(200);

    expect(companiesResponse.body.data.companies).to.have.length(1);
    expect(companiesResponse.body.data.companies[0].status).to.equal('pending');
    expect(companiesResponse.body.data.summary).to.deep.equal({
      totalCompaniesCount: 1,
      pendingCount: 1,
      approvedCount: 0,
      suspendedCount: 0
    });

    const updateCompanyResponse = await request(app)
      .patch(`/api/v1/admin/logistics/companies/${companyId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'approved'
      })
      .expect(200);

    expect(updateCompanyResponse.body.data.status).to.equal('approved');

    const ridersResponse = await request(app)
      .get('/api/v1/admin/logistics/riders')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        companyId,
        status: 'available'
      })
      .expect(200);

    expect(ridersResponse.body.data.riders).to.have.length(1);
    expect(ridersResponse.body.data.riders[0].company.id).to.equal(companyId);
    expect(ridersResponse.body.data.summary).to.deep.equal({
      totalRidersCount: 1,
      availableCount: 1,
      onDeliveryCount: 0,
      unavailableCount: 0,
      inactiveCount: 0
    });

    const auditLogsResponse = await request(app)
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        action: 'logistics_company.status_updated',
        targetType: 'logistics_company',
        targetId: companyId
      })
      .expect(200);

    expect(auditLogsResponse.body.data.auditLogs).to.have.length(1);
    expect(auditLogsResponse.body.data.auditLogs[0].detail.nextStatus).to.equal('approved');
  });

  it('lists pending delivery jobs and lets admin manually assign one when auto-assignment finds no rider', async () => {
    const seller = await registerSeller(
      app,
      'seller-manual-logistics@example.com',
      'RC-900010',
      {
        businessName: 'Manual Queue Hub',
        contactEmail: 'queue@manualhub.ng'
      }
    );
    const logistics = await registerAndLoginLogistics(app, {
      fullName: 'Alex Rider',
      email: 'manual-rider@example.com',
      phone: '08012345093',
      password: 'Password123',
      providerName: 'Swift Dispatch',
      vehicleType: 'bike'
    });
    const productId = await createSellerListing(app, seller.token, {
      title: 'Manual Assignment Brake Caliper',
      description: 'Brake caliper reserved for admin queue testing.',
      categoryId: 1002,
      partNumber: 'MANUAL-LGS-010',
      condition: 'new',
      priceKobo: 2800000,
      stockQty: 4,
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
    const buyer = await registerBuyer(app, 'buyer-manual-logistics@example.com');
    const orderId = await createOrder(app, buyer.token, productId, 1, {
      label: 'Northern Workshop',
      street: '23 Bompai Road',
      city: 'Kano',
      state: 'Kano',
      phone: '08022334455'
    });

    await confirmOrderPayment(app, buyer.token, orderId);

    const sellerOrdersResponse = await request(app)
      .get('/api/v1/seller/orders')
      .set('Authorization', `Bearer ${seller.token}`)
      .expect(200);
    const orderItemId = sellerOrdersResponse.body.data.orders[0].items[0].id;

    await request(app)
      .patch(`/api/v1/seller/orders/${orderItemId}/status`)
      .set('Authorization', `Bearer ${seller.token}`)
      .send({
        itemStatus: 'ready_for_pickup'
      })
      .expect(200);

    const adminToken = await loginAdmin(app);
    const pendingJobsResponse = await request(app)
      .get('/api/v1/admin/delivery-jobs')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        status: 'pending',
        search: 'kano'
      })
      .expect(200);

    expect(pendingJobsResponse.body.data.jobs).to.have.length(1);
    expect(pendingJobsResponse.body.data.jobs[0].status).to.equal('pending');
    expect(pendingJobsResponse.body.data.jobs[0].assignedRider).to.equal(null);
    expect(pendingJobsResponse.body.data.summary.jobsByStatus).to.deep.equal({
      total: 1,
      pending: 1,
      assigned: 0,
      picked_up: 0,
      in_transit: 0,
      delivered: 0,
      failed: 0,
      cancelled: 0
    });
    expect(pendingJobsResponse.body.data.summary.deliveryMetrics).to.deep.equal({
      totalJobsCount: 1,
      unassignedJobsCount: 1,
      activeJobsCount: 0,
      deliveredJobsCount: 0,
      failedJobsCount: 0,
      completionRatePercent: 0,
      deliveryFeesKobo: 0,
      platformMarginKobo: 0,
      companyShareKobo: 0,
      averageDeliveryFeeKobo: 0
    });

    const deliveryJobId = pendingJobsResponse.body.data.jobs[0].id;
    const assignResponse = await request(app)
      .patch(`/api/v1/admin/delivery-jobs/${deliveryJobId}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        riderId: logistics.riderId,
        note: 'Manual fallback assignment after no automatic zone match was found.'
      })
      .expect(200);

    expect(assignResponse.body.data.status).to.equal('assigned');
    expect(assignResponse.body.data.assignedRider.id).to.equal(logistics.riderId);
    expect(assignResponse.body.data.assignedCompany.id).to.equal(logistics.companyId);
    expect(assignResponse.body.data.statusHistory.map((entry) => entry.status)).to.deep.equal([
      'pending',
      'assigned'
    ]);

    const riderJobsResponse = await request(app)
      .get('/api/v1/rider/jobs')
      .set('Authorization', `Bearer ${logistics.token}`)
      .query({
        status: 'assigned'
      })
      .expect(200);

    expect(riderJobsResponse.body.data.jobs).to.have.length(1);
    expect(riderJobsResponse.body.data.jobs[0].id).to.equal(deliveryJobId);

    const assignedJobsResponse = await request(app)
      .get('/api/v1/admin/delivery-jobs')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        companyId: logistics.companyId,
        riderId: logistics.riderId,
        status: 'assigned'
      })
      .expect(200);

    expect(assignedJobsResponse.body.data.jobs).to.have.length(1);
    expect(assignedJobsResponse.body.data.jobs[0].assignedCompany.id).to.equal(logistics.companyId);
    expect(assignedJobsResponse.body.data.filters.companyId).to.equal(logistics.companyId);
    expect(assignedJobsResponse.body.data.filters.riderId).to.equal(logistics.riderId);
    expect(assignedJobsResponse.body.data.summary.jobsByStatus).to.deep.equal({
      total: 1,
      pending: 0,
      assigned: 1,
      picked_up: 0,
      in_transit: 0,
      delivered: 0,
      failed: 0,
      cancelled: 0
    });

    const auditLogsResponse = await request(app)
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        action: 'delivery_job.assigned',
        targetType: 'delivery_job',
        targetId: deliveryJobId
      })
      .expect(200);

    expect(auditLogsResponse.body.data.auditLogs).to.have.length(1);
    expect(auditLogsResponse.body.data.auditLogs[0].detail.riderId).to.equal(logistics.riderId);
  });

  it('returns 403 when an admin lacks the sellers.verify permission', async () => {
    const adminToken = await loginAdmin(app, {
      email: 'ops-admin@autoparts.local'
    });

    const response = await request(app)
      .get('/api/v1/admin/sellers')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({
        status: 'pending'
      })
      .expect(403);

    expect(response.body.success).to.equal(false);
    expect(response.body.error.code).to.equal('FORBIDDEN');
  });

  it('returns 403 when an admin lacks the categories.manage permission', async () => {
    const adminToken = await loginAdmin(app, {
      email: 'ops-admin@autoparts.local'
    });

    const response = await request(app)
      .get('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);

    expect(response.body.success).to.equal(false);
    expect(response.body.error.code).to.equal('FORBIDDEN');
  });

  it('returns 403 when an admin lacks the users.manage permission', async () => {
    const adminToken = await loginAdmin(app, {
      email: 'ops-admin@autoparts.local'
    });

    const response = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);

    expect(response.body.success).to.equal(false);
    expect(response.body.error.code).to.equal('FORBIDDEN');
  });

  it('returns 403 when an admin lacks the orders.manage permission', async () => {
    const adminToken = await loginAdmin(app, {
      email: 'ops-admin@autoparts.local'
    });

    const response = await request(app)
      .get('/api/v1/admin/orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);

    expect(response.body.success).to.equal(false);
    expect(response.body.error.code).to.equal('FORBIDDEN');
  });

  it('returns 403 when an admin lacks the payouts.approve and config.manage permissions', async () => {
    const adminToken = await loginAdmin(app, {
      email: 'ops-admin@autoparts.local'
    });

    const payoutResponse = await request(app)
      .get('/api/v1/admin/payouts')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);

    expect(payoutResponse.body.success).to.equal(false);
    expect(payoutResponse.body.error.code).to.equal('FORBIDDEN');

    const configResponse = await request(app)
      .get('/api/v1/admin/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);

    expect(configResponse.body.success).to.equal(false);
    expect(configResponse.body.error.code).to.equal('FORBIDDEN');
  });

  it('returns 403 when an admin lacks the logistics.manage permission', async () => {
    const adminToken = await loginAdmin(app, {
      email: 'ops-admin@autoparts.local'
    });

    const companiesResponse = await request(app)
      .get('/api/v1/admin/logistics/companies')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);

    expect(companiesResponse.body.success).to.equal(false);
    expect(companiesResponse.body.error.code).to.equal('FORBIDDEN');

    const ridersResponse = await request(app)
      .get('/api/v1/admin/logistics/riders')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);

    expect(ridersResponse.body.success).to.equal(false);
    expect(ridersResponse.body.error.code).to.equal('FORBIDDEN');

    const jobsResponse = await request(app)
      .get('/api/v1/admin/delivery-jobs')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);

    expect(jobsResponse.body.success).to.equal(false);
    expect(jobsResponse.body.error.code).to.equal('FORBIDDEN');

    const assignJobResponse = await request(app)
      .patch('/api/v1/admin/delivery-jobs/1/assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        riderId: 1
      })
      .expect(403);

    expect(assignJobResponse.body.success).to.equal(false);
    expect(assignJobResponse.body.error.code).to.equal('FORBIDDEN');
  });

  it('returns 403 when an admin lacks the disputes.resolve and audit_logs.read permissions', async () => {
    const adminToken = await loginAdmin(app, {
      email: 'ops-admin@autoparts.local'
    });

    const disputesResponse = await request(app)
      .get('/api/v1/admin/disputes')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);

    expect(disputesResponse.body.success).to.equal(false);
    expect(disputesResponse.body.error.code).to.equal('FORBIDDEN');

    const auditLogsResponse = await request(app)
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);

    expect(auditLogsResponse.body.success).to.equal(false);
    expect(auditLogsResponse.body.error.code).to.equal('FORBIDDEN');
  });

  it('returns 403 when an admin lacks the dashboard.read permission', async () => {
    const adminToken = await loginAdmin(app, {
      email: 'ops-admin@autoparts.local'
    });

    const response = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);

    expect(response.body.success).to.equal(false);
    expect(response.body.error.code).to.equal('FORBIDDEN');
  });
});
