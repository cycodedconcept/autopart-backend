require('../../setup/jest');

const {
  adminLoginSchema,
  listSellerVerificationQueueSchema,
  updateSellerVerificationStatusSchema
} = require('../../../src/validators/admin.validator');

describe('admin validator', () => {
  it('accepts a valid admin login payload', () => {
    const { error, value } = adminLoginSchema.validate({
      body: {
        email: 'SUPERADMIN@EXAMPLE.COM',
        password: 'Password123'
      },
      params: {},
      query: {}
    });

    expect(error).toBeUndefined();
    expect(value.body.email).toBe('superadmin@example.com');
  });

  it('accepts a valid seller verification queue query', () => {
    const { error, value } = listSellerVerificationQueueSchema.validate({
      body: {},
      params: {},
      query: {
        status: 'pending',
        page: '2',
        limit: '5'
      }
    });

    expect(error).toBeUndefined();
    expect(value.query).toEqual({
      status: 'pending',
      page: 2,
      limit: 5
    });
  });

  it('accepts a valid seller verification approval payload', () => {
    const { error } = updateSellerVerificationStatusSchema.validate({
      body: {
        verificationStatus: 'verified'
      },
      params: {
        id: 101
      },
      query: {}
    });

    expect(error).toBeUndefined();
  });

  it('requires a rejection reason when rejecting a seller', () => {
    const { error } = updateSellerVerificationStatusSchema.validate({
      body: {
        verificationStatus: 'rejected'
      },
      params: {
        id: 101
      },
      query: {}
    });

    expect(error).toBeDefined();
    expect(error.message).toContain('rejectionReason');
  });
});
