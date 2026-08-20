require('../setup/mocha');

const chai = require('chai');
const request = require('supertest');
const { createApp } = require('../../src/app');
const AppError = require('../../src/utils/app-error');

const { expect } = chai;

describe('Newsletter API integration', () => {
  let app;
  let newsletterService;

  beforeEach(() => {
    newsletterService = {
      subscribe: async () => ({
        data: {
          status: 'subscribed'
        },
        message: 'Newsletter subscription saved successfully.'
      }),
      unsubscribe: async (token) => {
        if (token === 'f'.repeat(64)) {
          throw new AppError('Newsletter subscription was not found.', {
            statusCode: 404,
            code: 'NOT_FOUND'
          });
        }

        return {
          data: {
            status: 'unsubscribed',
            unsubscribedAt: '2026-08-20 11:00:00'
          },
          message: 'Newsletter subscription updated successfully.'
        };
      }
    };

    app = createApp({
      newsletterService
    });
  });

  it('subscribes a public newsletter email without authentication', async () => {
    const response = await request(app)
      .post('/api/v1/newsletter/subscribe')
      .send({
        email: 'fleet-updates@example.com'
      });

    expect(response.status).to.equal(200);
    expect(response.body.success).to.equal(true);
    expect(response.body.data.status).to.equal('subscribed');
  });

  it('validates newsletter subscribe payloads', async () => {
    const response = await request(app)
      .post('/api/v1/newsletter/subscribe')
      .send({
        email: 'not-an-email'
      });

    expect(response.status).to.equal(422);
    expect(response.body.success).to.equal(false);
    expect(response.body.error.code).to.equal('VALIDATION_ERROR');
  });

  it('unsubscribes a valid public token', async () => {
    const response = await request(app)
      .get(`/api/v1/newsletter/unsubscribe/${'a'.repeat(64)}`);

    expect(response.status).to.equal(200);
    expect(response.body.success).to.equal(true);
    expect(response.body.data.status).to.equal('unsubscribed');
  });

  it('returns 404 for an unknown unsubscribe token', async () => {
    const response = await request(app)
      .get(`/api/v1/newsletter/unsubscribe/${'f'.repeat(64)}`);

    expect(response.status).to.equal(404);
    expect(response.body.success).to.equal(false);
    expect(response.body.error.code).to.equal('NOT_FOUND');
  });
});
