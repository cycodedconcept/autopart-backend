require('../../setup/jest');

const {
  subscribeNewsletterSchema,
  unsubscribeNewsletterSchema
} = require('../../../src/validators/newsletter.validator');

describe('newsletter validator', () => {
  it('accepts a valid subscribe payload', () => {
    const { error, value } = subscribeNewsletterSchema.validate({
      body: {
        email: 'Fleet-Updates@Example.com'
      },
      params: {},
      query: {}
    });

    expect(error).toBeUndefined();
    expect(value.body).toEqual({
      email: 'fleet-updates@example.com'
    });
  });

  it('accepts a valid unsubscribe token', () => {
    const { error, value } = unsubscribeNewsletterSchema.validate({
      body: {},
      params: {
        token: 'a'.repeat(64)
      },
      query: {}
    });

    expect(error).toBeUndefined();
    expect(value.params).toEqual({
      token: 'a'.repeat(64)
    });
  });

  it('rejects an invalid unsubscribe token', () => {
    const { error } = unsubscribeNewsletterSchema.validate({
      body: {},
      params: {
        token: 'short-token'
      },
      query: {}
    });

    expect(error).toBeDefined();
    expect(error.message).toContain('"params.token"');
  });
});
