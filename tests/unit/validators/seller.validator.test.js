require('../../setup/jest');

const {
  sellerDocumentsUploadSchema,
  sellerRegisterSchema
} = require('../../../src/validators/seller.validator');

describe('seller validators', () => {
  it('accepts seller registration with account and business details', () => {
    const { error } = sellerRegisterSchema.validate({
      body: {
        fullName: 'Uche Okafor',
        email: 'uche@example.com',
        password: 'Password123',
        businessName: 'Prime Auto Hub',
        contactPhone: '08012345678',
        address: '12 Sapara Williams Close, Victoria Island, Lagos',
        cacNumber: 'RC-123456'
      },
      params: {},
      query: {}
    });

    expect(error).toBeUndefined();
  });

  it('rejects seller registration without an account email or phone', () => {
    const { error } = sellerRegisterSchema.validate({
      body: {
        fullName: 'Uche Okafor',
        password: 'Password123',
        businessName: 'Prime Auto Hub',
        address: '12 Sapara Williams Close, Victoria Island, Lagos',
        cacNumber: 'RC-123456'
      },
      params: {},
      query: {}
    });

    expect(error).toBeDefined();
  });

  it('accepts the seller documents upload request envelope', () => {
    const { error } = sellerDocumentsUploadSchema.validate({
      body: {},
      params: {},
      query: {}
    });

    expect(error).toBeUndefined();
  });
});
