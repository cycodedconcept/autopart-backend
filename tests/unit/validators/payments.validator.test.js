require('../../setup/jest');

const {
  initializePaymentSchema,
  verifyPaymentSchema,
  verifyPaymentCallbackSchema
} = require('../../../src/validators/payments.validator');

describe('payments validator', () => {
  it('accepts a valid initialize payment payload', () => {
    const { error, value } = initializePaymentSchema.validate({
      body: {
        orderId: '101',
        email: 'buyer@example.com',
        callbackUrl: 'https://example.com/payments/callback'
      },
      params: {},
      query: {}
    });

    expect(error).toBeUndefined();
    expect(value.body).toEqual({
      orderId: 101,
      email: 'buyer@example.com',
      callbackUrl: 'https://example.com/payments/callback'
    });
  });

  it('accepts a reference path param on the verify route', () => {
    const { error, value } = verifyPaymentSchema.validate({
      body: {},
      params: {
        reference: 'APT-101-REF'
      },
      query: {}
    });

    expect(error).toBeUndefined();
    expect(value.params).toEqual({
      reference: 'APT-101-REF'
    });
  });

  it('accepts either reference or trxref on the callback query', () => {
    const { error, value } = verifyPaymentCallbackSchema.validate({
      body: {},
      params: {},
      query: {
        trxref: 'APT-101-REF'
      }
    });

    expect(error).toBeUndefined();
    expect(value.query).toEqual({
      trxref: 'APT-101-REF'
    });
  });
});
