require('../setup/mocha');

const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const chai = require('chai');
const request = require('supertest');
const { createApp } = require('../../src/app');
const { createInMemorySellersRepository } = require('./support/in-memory-sellers-repository');
const { createInMemoryUsersRepository } = require('./support/in-memory-users-repository');

const { expect } = chai;

describe('Seller API integration', () => {
  let app;
  let cacVerificationService;
  let currentCacVerificationResult;
  let uploadDirectory;

  beforeEach(() => {
    const usersRepository = createInMemoryUsersRepository();
    const sellersRepository = createInMemorySellersRepository({ usersRepository });
    currentCacVerificationResult = {
      checkedAt: '2026-07-09T09:30:00.000Z',
      response: {
        body: {
          entity_name: 'Prime Auto Hub',
          registration_number: 'RC-123456'
        },
        httpStatusCode: 200
      },
      status: 'completed'
    };
    cacVerificationService = {
      verifyBusiness: async () => currentCacVerificationResult
    };

    uploadDirectory = path.join(os.tmpdir(), `autoparts-seller-uploads-${Date.now()}`);
    app = createApp({
      cacVerificationService,
      usersRepository,
      sellersRepository,
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
        UPLOAD_DIR: uploadDirectory
      }
    });
  });

  afterEach(async () => {
    await fs.rm(uploadDirectory, {
      recursive: true,
      force: true
    });
  });

  it('registers a seller, logs in, uploads documents, and keeps the seller pending admin review', async () => {
    const registerResponse = await request(app)
      .post('/api/v1/seller/register')
      .send({
        fullName: 'Uche Okafor',
        email: 'uche@example.com',
        phone: '08012345678',
        password: 'Password123',
        businessName: 'Prime Auto Hub',
        contactEmail: 'sales@primeautohub.ng',
        contactPhone: '08012345678',
        address: '12 Sapara Williams Close, Victoria Island, Lagos',
        cacNumber: 'RC-123456'
      });

    expect(registerResponse.status).to.equal(201);
    expect(registerResponse.body.success).to.equal(true);
    expect(registerResponse.body.data.user.role).to.equal('seller');
    expect(registerResponse.body.data.sellerProfile.verificationStatus).to.equal('pending');
    expect(registerResponse.body.data.sellerProfile.cacVerification.status).to.equal('completed');

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        identifier: 'uche@example.com',
        password: 'Password123'
      });

    expect(loginResponse.status).to.equal(200);
    expect(loginResponse.body.data.user.role).to.equal('seller');

    const uploadResponse = await request(app)
      .post('/api/v1/seller/documents')
      .set('Authorization', `Bearer ${loginResponse.body.data.token}`)
      .attach('cacDocument', Buffer.from('fake-cac-pdf'), {
        filename: 'cac-document.pdf',
        contentType: 'application/pdf'
      })
      .attach('proofOfAddressDocument', Buffer.from('fake-proof-pdf'), {
        filename: 'proof-of-address.pdf',
        contentType: 'application/pdf'
      });

    expect(uploadResponse.status).to.equal(200);
    expect(uploadResponse.body.success).to.equal(true);
    expect(uploadResponse.body.data.sellerProfile.verificationStatus).to.equal('pending');
    expect(uploadResponse.body.data.sellerProfile.documents).to.have.lengthOf(2);

    const meResponse = await request(app)
      .get('/api/v1/seller/me')
      .set('Authorization', `Bearer ${loginResponse.body.data.token}`);

    expect(meResponse.status).to.equal(200);
    expect(meResponse.body.success).to.equal(true);
    expect(meResponse.body.data.user.email).to.equal('uche@example.com');
    expect(meResponse.body.data.sellerProfile.businessName).to.equal('Prime Auto Hub');
    expect(meResponse.body.data.sellerProfile.verificationStatus).to.equal('pending');
    expect(meResponse.body.data.sellerProfile.cacVerification.response.httpStatusCode).to.equal(200);
  });

  it('retries CAC verification for an existing seller and refreshes the stored Dojah payload', async () => {
    currentCacVerificationResult = {
      checkedAt: '2026-07-09T11:06:55.000Z',
      error: {
        message: 'Your Secret Key could not be Authorized'
      },
      response: {
        body: {
          error: 'Your Secret Key could not be Authorized'
        },
        httpStatusCode: 401
      },
      status: 'failed'
    };

    const registerResponse = await request(app)
      .post('/api/v1/seller/register')
      .send({
        fullName: 'Uche Okafor',
        email: 'retry-seller@example.com',
        phone: '08012345679',
        password: 'Password123',
        businessName: 'Prime Auto Hub',
        contactEmail: 'sales@primeautohub.ng',
        contactPhone: '08012345679',
        address: '12 Sapara Williams Close, Victoria Island, Lagos',
        cacNumber: 'RC-654321'
      });

    expect(registerResponse.status).to.equal(201);
    expect(registerResponse.body.data.sellerProfile.cacVerification.status).to.equal('failed');
    expect(registerResponse.body.data.sellerProfile.cacVerification.response.httpStatusCode).to.equal(401);

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        identifier: 'retry-seller@example.com',
        password: 'Password123'
      });

    expect(loginResponse.status).to.equal(200);

    currentCacVerificationResult = {
      checkedAt: '2026-07-09T12:20:00.000Z',
      response: {
        body: {
          entity_name: 'Prime Auto Hub',
          registration_number: 'RC-654321'
        },
        httpStatusCode: 200
      },
      status: 'completed'
    };

    const retryResponse = await request(app)
      .post('/api/v1/seller/cac-verification/retry')
      .set('Authorization', `Bearer ${loginResponse.body.data.token}`)
      .send({});

    expect(retryResponse.status).to.equal(200);
    expect(retryResponse.body.success).to.equal(true);
    expect(retryResponse.body.data.sellerProfile.verificationStatus).to.equal('pending');
    expect(retryResponse.body.data.sellerProfile.cacVerification.status).to.equal('completed');
    expect(retryResponse.body.data.sellerProfile.cacVerification.response.httpStatusCode).to.equal(200);
    expect(retryResponse.body.data.sellerProfile.cacVerification.response.body.registration_number)
      .to.equal('RC-654321');

    const meResponse = await request(app)
      .get('/api/v1/seller/me')
      .set('Authorization', `Bearer ${loginResponse.body.data.token}`);

    expect(meResponse.status).to.equal(200);
    expect(meResponse.body.data.sellerProfile.cacVerification.status).to.equal('completed');
    expect(meResponse.body.data.sellerProfile.cacVerification.response.httpStatusCode).to.equal(200);
  });

  it('blocks buyers from reading the seller self-profile route', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Buyer User',
        email: 'buyer@example.com',
        password: 'Password123'
      })
      .expect(201);

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        identifier: 'buyer@example.com',
        password: 'Password123'
      })
      .expect(200);

    const response = await request(app)
      .get('/api/v1/seller/me')
      .set('Authorization', `Bearer ${loginResponse.body.data.token}`);

    expect(response.status).to.equal(403);
    expect(response.body.success).to.equal(false);
    expect(response.body.error.code).to.equal('FORBIDDEN');
  });
});
