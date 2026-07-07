require('../setup/mocha');

const bcrypt = require('bcrypt');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const chai = require('chai');
const request = require('supertest');
const { createApp } = require('../../src/app');
const { createInMemoryAdminRepository } = require('./support/in-memory-admin-repository');
const { createInMemorySellersRepository } = require('./support/in-memory-sellers-repository');
const { createInMemoryUsersRepository } = require('./support/in-memory-users-repository');

const { expect } = chai;

async function loginAdmin(app) {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({
      identifier: 'admin@autoparts.local',
      password: 'Password123'
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
  let app;
  let usersRepository;
  let uploadDirectory;

  beforeEach(async () => {
    usersRepository = createInMemoryUsersRepository();
    const sellersRepository = createInMemorySellersRepository({ usersRepository });
    const adminRepository = createInMemoryAdminRepository({ sellersRepository });

    await usersRepository.createUser({
      role: 'admin',
      fullName: 'Platform Admin',
      email: 'admin@autoparts.local',
      phone: '+2348012345699',
      passwordHash: await bcrypt.hash('Password123', 4),
      isVerified: true
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
        SELLER_AUTO_VERIFY: false,
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

  it('lets an admin review the pending seller verification queue and approve a seller', async () => {
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

  it('lets an admin reject a seller and persists the rejection reason', async () => {
    const seller = await registerSeller(app, 'seller-reject@example.com', 'RC-777002');

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
    const rejectResponse = await request(app)
      .patch(`/api/v1/admin/sellers/${seller.sellerId}/verification`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        verificationStatus: 'rejected',
        rejectionReason: 'CAC document details could not be matched.'
      })
      .expect(200);

    expect(rejectResponse.body.data.sellerProfile.verificationStatus).to.equal('rejected');
    expect(rejectResponse.body.data.sellerProfile.rejectionReason)
      .to.equal('CAC document details could not be matched.');

    const sellerMeResponse = await request(app)
      .get('/api/v1/seller/me')
      .set('Authorization', `Bearer ${seller.token}`)
      .expect(200);

    expect(sellerMeResponse.body.data.sellerProfile.verificationStatus).to.equal('rejected');
    expect(sellerMeResponse.body.data.sellerProfile.rejectionReason)
      .to.equal('CAC document details could not be matched.');
  });
});
