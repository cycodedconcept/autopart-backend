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
  let uploadDirectory;

  beforeEach(async () => {
    const usersRepository = createInMemoryUsersRepository();
    const sellersRepository = createInMemorySellersRepository({ usersRepository });

    adminRepository = createInMemoryAdminRepository({ sellersRepository });

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
      usersRepository,
      sellersRepository,
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
        SELLER_AUTO_VERIFY: false,
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

    const approveResponse = await request(app)
      .patch(`/api/v1/admin/sellers/${seller.sellerId}/verification`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        verificationStatus: 'verified'
      })
      .expect(200);

    expect(approveResponse.body.data.sellerProfile.verificationStatus).to.equal('verified');
    expect(approveResponse.body.data.sellerProfile.rejectionReason).to.equal(null);

    const sellerMeResponse = await request(app)
      .get('/api/v1/seller/me')
      .set('Authorization', `Bearer ${seller.token}`)
      .expect(200);

    expect(sellerMeResponse.body.data.sellerProfile.verificationStatus).to.equal('verified');
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
});
