require('../setup/mocha');

const chai = require('chai');
const request = require('supertest');
const { createApp } = require('../../src/app');
const env = require('../../src/config/env');
const { createInMemoryUsersRepository } = require('./support/in-memory-users-repository');

const { expect } = chai;

describe('Auth API integration', () => {
  let app;

  beforeEach(() => {
    app = createApp({
      usersRepository: createInMemoryUsersRepository()
    });
  });

  it('registers a buyer and returns a token', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Amaka Nwosu',
        email: 'amaka@example.com',
        password: 'Password123'
      });

    expect(response.status).to.equal(201);
    expect(response.body.success).to.equal(true);
    expect(response.body.data.token).to.be.a('string');
    expect(response.body.data.user.email).to.equal('amaka@example.com');
  });

  it('logs in and returns the buyer profile from /me', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Tunde Adebayo',
        phone: '08012345678',
        password: 'Password123'
      })
      .expect(201);

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        identifier: '08012345678',
        password: 'Password123'
      });

    expect(loginResponse.status).to.equal(200);
    expect(loginResponse.body.data.user.phone).to.equal('+2348012345678');

    const meResponse = await request(app)
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${loginResponse.body.data.token}`);

    expect(meResponse.status).to.equal(200);
    expect(meResponse.body.success).to.equal(true);
    expect(meResponse.body.data.fullName).to.equal('Tunde Adebayo');
    expect(meResponse.body.data.phone).to.equal('+2348012345678');
  });

  it('responds to browser preflight requests for an allowed frontend origin', async () => {
    const corsApp = createApp({
      env: {
        ...env,
        CORS_ALLOWED_ORIGINS: 'http://127.0.0.1:5500,http://localhost:3000'
      },
      usersRepository: createInMemoryUsersRepository()
    });

    const response = await request(corsApp)
      .options('/api/v1/auth/login')
      .set('Origin', 'http://127.0.0.1:5500')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');

    expect(response.status).to.equal(204);
    expect(response.headers['access-control-allow-origin']).to.equal('http://127.0.0.1:5500');
    expect(response.headers['access-control-allow-methods']).to.include('POST');
    expect(response.headers['access-control-allow-headers']).to.equal('content-type');
  });

  it('adds CORS headers to auth responses for an allowed frontend origin', async () => {
    const corsApp = createApp({
      env: {
        ...env,
        CORS_ALLOWED_ORIGINS: 'http://127.0.0.1:5500'
      },
      usersRepository: createInMemoryUsersRepository()
    });

    const response = await request(corsApp)
      .post('/api/v1/auth/register')
      .set('Origin', 'http://127.0.0.1:5500')
      .send({
        fullName: 'CORS Test User',
        email: 'cors@example.com',
        password: 'Password123'
      });

    expect(response.status).to.equal(201);
    expect(response.headers['access-control-allow-origin']).to.equal('http://127.0.0.1:5500');
  });

  it('rejects duplicate registrations', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Ngozi Okafor',
        email: 'ngozi@example.com',
        password: 'Password123'
      })
      .expect(201);

    const duplicateResponse = await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Ngozi Okafor',
        email: 'ngozi@example.com',
        password: 'Password123'
      });

    expect(duplicateResponse.status).to.equal(409);
    expect(duplicateResponse.body.success).to.equal(false);
    expect(duplicateResponse.body.error.code).to.equal('CONFLICT');
  });

  it('supports forgot-password and reset-password with a new login', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Ada Obi',
        email: 'ada@example.com',
        password: 'Password123'
      })
      .expect(201);

    const forgotPasswordResponse = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({
        identifier: 'ada@example.com'
      });

    expect(forgotPasswordResponse.status).to.equal(200);
    expect(forgotPasswordResponse.body.data.resetToken).to.be.a('string');

    const resetPasswordResponse = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({
        token: forgotPasswordResponse.body.data.resetToken,
        newPassword: 'NewPassword123'
      });

    expect(resetPasswordResponse.status).to.equal(200);
    expect(resetPasswordResponse.body.success).to.equal(true);

    await request(app)
      .post('/api/v1/auth/login')
      .send({
        identifier: 'ada@example.com',
        password: 'Password123'
      })
      .expect(401);

    const loginWithNewPasswordResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        identifier: 'ada@example.com',
        password: 'NewPassword123'
      });

    expect(loginWithNewPasswordResponse.status).to.equal(200);
    expect(loginWithNewPasswordResponse.body.success).to.equal(true);
  });

  it('updates a password for an authenticated buyer', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Kelechi Umeh',
        email: 'kelechi@example.com',
        password: 'Password123'
      })
      .expect(201);

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        identifier: 'kelechi@example.com',
        password: 'Password123'
      })
      .expect(200);

    const changePasswordResponse = await request(app)
      .patch('/api/v1/auth/password')
      .set('Authorization', `Bearer ${loginResponse.body.data.token}`)
      .send({
        currentPassword: 'Password123',
        newPassword: 'NewPassword123'
      });

    expect(changePasswordResponse.status).to.equal(200);
    expect(changePasswordResponse.body.success).to.equal(true);

    await request(app)
      .post('/api/v1/auth/login')
      .send({
        identifier: 'kelechi@example.com',
        password: 'Password123'
      })
      .expect(401);

    await request(app)
      .post('/api/v1/auth/login')
      .send({
        identifier: 'kelechi@example.com',
        password: 'NewPassword123'
      })
      .expect(200);
  });
});
