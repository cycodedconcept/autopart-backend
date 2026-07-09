require('../setup/mocha');

const bcrypt = require('bcrypt');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const chai = require('chai');
const request = require('supertest');
const { ADMIN_ROLE_NAMES } = require('../../src/config/constants');
const { createApp } = require('../../src/app');
const { createInMemoryAdminRepository } = require('./support/in-memory-admin-repository');
const { createInMemoryProductsRepository } = require('./support/in-memory-products-repository');
const { createInMemorySellersRepository } = require('./support/in-memory-sellers-repository');
const { createInMemoryUsersRepository } = require('./support/in-memory-users-repository');

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

async function registerSeller(app, email, cacNumber) {
  const registerResponse = await request(app)
    .post('/api/v1/seller/register')
    .send({
      fullName: 'Uche Okafor',
      email,
      phone: '08012345678',
      password: 'Password123',
      businessName: 'Prime Auto Hub',
      contactEmail: 'sales@primeautohub.ng',
      contactPhone: '08012345678',
      address: '12 Sapara Williams Close, Victoria Island, Lagos',
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
    token: loginResponse.body.data.token
  };
}

describe('Admin API integration', () => {
  let adminRepository;
  let app;
  let cacVerificationService;
  let uploadDirectory;

  beforeEach(async () => {
    const usersRepository = createInMemoryUsersRepository();
    const sellersRepository = createInMemorySellersRepository({ usersRepository });
    const productsRepository = createInMemoryProductsRepository();

    adminRepository = createInMemoryAdminRepository({ sellersRepository });
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
      cacVerificationService,
      usersRepository,
      sellersRepository,
      productsRepository,
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
      .attach('photos', Buffer.from('fake-image-1'), {
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

  it('deletes unused categories and vehicle taxonomy entries', async () => {
    const adminToken = await loginAdmin(app);

    const categoryResponse = await request(app)
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Body Panels'
      })
      .expect(201);

    const deleteCategoryResponse = await request(app)
      .delete(`/api/v1/admin/categories/${categoryResponse.body.data.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(deleteCategoryResponse.body.data.name).to.equal('Body Panels');

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
});
