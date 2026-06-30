require('../../setup/jest');

const {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema
} = require('../../../src/validators/auth.validator');

describe('auth validators', () => {
  it('accepts registration with an email', () => {
    const { error } = registerSchema.validate({
      body: {
        fullName: 'Amaka Nwosu',
        email: 'amaka@example.com',
        password: 'Password123'
      },
      params: {},
      query: {}
    });

    expect(error).toBeUndefined();
  });

  it('rejects registration without email or phone', () => {
    const { error } = registerSchema.validate({
      body: {
        fullName: 'Amaka Nwosu',
        password: 'Password123'
      },
      params: {},
      query: {}
    });

    expect(error).toBeDefined();
  });

  it('accepts login with a Nigerian phone number', () => {
    const { error } = loginSchema.validate({
      body: {
        phone: '08012345678',
        password: 'Password123'
      },
      params: {},
      query: {}
    });

    expect(error).toBeUndefined();
  });

  it('accepts forgot-password requests with an email identifier', () => {
    const { error } = forgotPasswordSchema.validate({
      body: {
        identifier: 'buyer@example.com'
      },
      params: {},
      query: {}
    });

    expect(error).toBeUndefined();
  });

  it('accepts reset-password requests with a valid token', () => {
    const { error } = resetPasswordSchema.validate({
      body: {
        token: 'a'.repeat(64),
        newPassword: 'Password123'
      },
      params: {},
      query: {}
    });

    expect(error).toBeUndefined();
  });

  it('rejects changing to the same password', () => {
    const { error } = changePasswordSchema.validate({
      body: {
        currentPassword: 'Password123',
        newPassword: 'Password123'
      },
      params: {},
      query: {}
    });

    expect(error).toBeDefined();
  });
});
