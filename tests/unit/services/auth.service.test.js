require('../../setup/jest');

const AppError = require('../../../src/utils/app-error');
const { createAuthService } = require('../../../src/services/auth.service');

describe('auth service', () => {
  let usersRepository;
  let jwtUtils;
  let passwordUtils;
  let passwordResetUtils;
  let authEnv;
  let authService;

  beforeEach(() => {
    usersRepository = {
      createUser: jest.fn(),
      findByEmail: jest.fn(),
      findById: jest.fn(),
      findByPasswordResetTokenHash: jest.fn(),
      findByPhone: jest.fn(),
      storePasswordResetToken: jest.fn(),
      updatePassword: jest.fn()
    };

    jwtUtils = {
      signAccessToken: jest.fn(() => 'signed-token'),
      verifyAccessToken: jest.fn()
    };

    passwordUtils = {
      comparePassword: jest.fn(),
      hashPassword: jest.fn(() => 'hashed-password')
    };

    passwordResetUtils = {
      generateResetToken: jest.fn(() => 'plain-reset-token'),
      hashResetToken: jest.fn(() => 'hashed-reset-token')
    };

    authEnv = {
      NODE_ENV: 'test',
      PASSWORD_RESET_TOKEN_TTL_MINUTES: 30
    };

    authService = createAuthService({
      usersRepository,
      jwtUtils,
      passwordUtils,
      passwordResetUtils,
      env: authEnv
    });
  });

  describe('register', () => {
    it('creates a buyer account with a normalized email', async () => {
      usersRepository.findByEmail.mockResolvedValue(null);
      usersRepository.createUser.mockResolvedValue({
        id: 1,
        role: 'buyer',
        fullName: 'Amaka Nwosu',
        email: 'amaka@example.com',
        phone: null,
        isVerified: false,
        createdAt: '2026-06-29T10:00:00.000Z',
        updatedAt: '2026-06-29T10:00:00.000Z'
      });

      const result = await authService.register({
        fullName: 'Amaka Nwosu',
        email: 'AMAKA@EXAMPLE.COM',
        password: 'Password123'
      });

      expect(usersRepository.findByEmail).toHaveBeenCalledWith('amaka@example.com');
      expect(passwordUtils.hashPassword).toHaveBeenCalledWith('Password123');
      expect(result).toEqual({
        token: 'signed-token',
        user: {
          id: 1,
          role: 'buyer',
          fullName: 'Amaka Nwosu',
          email: 'amaka@example.com',
          phone: null,
          isVerified: false,
          createdAt: '2026-06-29T10:00:00.000Z',
          updatedAt: '2026-06-29T10:00:00.000Z'
        }
      });
    });

    it('rejects duplicate phone numbers', async () => {
      usersRepository.findByPhone.mockResolvedValue({ id: 22 });

      await expect(authService.register({
        fullName: 'Tunde Adebayo',
        phone: '08012345678',
        password: 'Password123'
      })).rejects.toMatchObject({
        statusCode: 409,
        code: 'CONFLICT'
      });
    });
  });

  describe('login', () => {
    it('logs in with a phone number', async () => {
      usersRepository.findByPhone.mockResolvedValue({
        id: 7,
        role: 'buyer',
        fullName: 'Tunde Adebayo',
        email: null,
        phone: '+2348012345678',
        passwordHash: 'stored-hash',
        isVerified: false,
        createdAt: '2026-06-29T10:00:00.000Z',
        updatedAt: '2026-06-29T10:00:00.000Z'
      });
      passwordUtils.comparePassword.mockResolvedValue(true);

      const result = await authService.login({
        identifier: '08012345678',
        password: 'Password123'
      });

      expect(usersRepository.findByPhone).toHaveBeenCalledWith('+2348012345678');
      expect(passwordUtils.comparePassword).toHaveBeenCalledWith('Password123', 'stored-hash');
      expect(result.user.id).toBe(7);
      expect(result.token).toBe('signed-token');
    });

    it('throws when credentials are invalid', async () => {
      usersRepository.findByEmail.mockResolvedValue(null);

      await expect(authService.login({
        identifier: 'missing@example.com',
        password: 'Password123'
      })).rejects.toBeInstanceOf(AppError);
    });

    it('rejects suspended accounts after password verification', async () => {
      usersRepository.findByEmail.mockResolvedValue({
        id: 8,
        role: 'seller',
        fullName: 'Suspended Seller',
        email: 'suspended@example.com',
        phone: null,
        passwordHash: 'stored-hash',
        accountStatus: 'suspended',
        isVerified: false,
        createdAt: '2026-06-29T10:00:00.000Z',
        updatedAt: '2026-06-29T10:00:00.000Z'
      });
      passwordUtils.comparePassword.mockResolvedValue(true);

      await expect(authService.login({
        identifier: 'suspended@example.com',
        password: 'Password123'
      })).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN'
      });
    });
  });

  describe('getAuthenticatedUser', () => {
    it('returns a sanitized authenticated user', async () => {
      jwtUtils.verifyAccessToken.mockReturnValue({ sub: 5 });
      usersRepository.findById.mockResolvedValue({
        id: 5,
        role: 'buyer',
        fullName: 'Ngozi Okafor',
        email: 'ngozi@example.com',
        phone: '+2347012345678',
        passwordHash: 'secret',
        isVerified: false,
        createdAt: '2026-06-29T10:00:00.000Z',
        updatedAt: '2026-06-29T10:00:00.000Z'
      });

      const result = await authService.getAuthenticatedUser('token');

      expect(result).toEqual({
        id: 5,
        role: 'buyer',
        fullName: 'Ngozi Okafor',
        email: 'ngozi@example.com',
        phone: '+2347012345678',
        isVerified: false,
        createdAt: '2026-06-29T10:00:00.000Z',
        updatedAt: '2026-06-29T10:00:00.000Z'
      });
    });

    it('rejects banned authenticated users', async () => {
      jwtUtils.verifyAccessToken.mockReturnValue({ sub: 5 });
      usersRepository.findById.mockResolvedValue({
        id: 5,
        role: 'buyer',
        fullName: 'Ngozi Okafor',
        email: 'ngozi@example.com',
        phone: '+2347012345678',
        passwordHash: 'secret',
        accountStatus: 'banned',
        isVerified: false,
        createdAt: '2026-06-29T10:00:00.000Z',
        updatedAt: '2026-06-29T10:00:00.000Z'
      });

      await expect(authService.getAuthenticatedUser('token')).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN'
      });
    });
  });

  describe('forgotPassword', () => {
    it('stores a hashed reset token and returns the plain token outside production', async () => {
      usersRepository.findByEmail.mockResolvedValue({
        id: 3,
        role: 'buyer',
        email: 'buyer@example.com'
      });

      const result = await authService.forgotPassword({
        identifier: 'buyer@example.com'
      });

      expect(passwordResetUtils.generateResetToken).toHaveBeenCalledTimes(1);
      expect(passwordResetUtils.hashResetToken).toHaveBeenCalledWith('plain-reset-token');
      expect(usersRepository.storePasswordResetToken).toHaveBeenCalledWith({
        userId: 3,
        passwordResetTokenHash: 'hashed-reset-token',
        passwordResetExpiresAt: expect.any(Date)
      });
      expect(result.data.resetToken).toBe('plain-reset-token');
      expect(result.data.expiresAt).toBeTruthy();
    });

    it('returns a generic success message when the user does not exist', async () => {
      usersRepository.findByPhone.mockResolvedValue(null);

      const result = await authService.forgotPassword({
        identifier: '08012345678'
      });

      expect(usersRepository.storePasswordResetToken).not.toHaveBeenCalled();
      expect(result).toEqual({
        data: {},
        message: 'If an account matches the provided details, a password reset token has been generated.'
      });
    });
  });

  describe('resetPassword', () => {
    it('updates the password when the reset token is valid', async () => {
      usersRepository.findByPasswordResetTokenHash.mockResolvedValue({
        id: 9,
        passwordResetExpiresAt: new Date(Date.now() + 60000).toISOString()
      });

      const result = await authService.resetPassword({
        token: 'plain-reset-token',
        newPassword: 'Password123'
      });

      expect(passwordResetUtils.hashResetToken).toHaveBeenCalledWith('plain-reset-token');
      expect(passwordUtils.hashPassword).toHaveBeenCalledWith('Password123');
      expect(usersRepository.updatePassword).toHaveBeenCalledWith(9, 'hashed-password');
      expect(result.message).toBe('Password has been reset successfully.');
    });

    it('rejects expired reset tokens', async () => {
      usersRepository.findByPasswordResetTokenHash.mockResolvedValue({
        id: 9,
        passwordResetExpiresAt: new Date(Date.now() - 60000).toISOString()
      });

      await expect(authService.resetPassword({
        token: 'plain-reset-token',
        newPassword: 'Password123'
      })).rejects.toMatchObject({
        statusCode: 400,
        code: 'INVALID_RESET_TOKEN'
      });
    });
  });

  describe('changePassword', () => {
    it('updates the password for an authenticated user', async () => {
      usersRepository.findById.mockResolvedValue({
        id: 5,
        role: 'buyer',
        fullName: 'Ngozi Okafor',
        email: 'ngozi@example.com',
        phone: '+2347012345678',
        passwordHash: 'stored-hash',
        isVerified: false,
        createdAt: '2026-06-29T10:00:00.000Z',
        updatedAt: '2026-06-29T10:00:00.000Z'
      });
      usersRepository.updatePassword.mockResolvedValue({
        id: 5,
        role: 'buyer',
        fullName: 'Ngozi Okafor',
        email: 'ngozi@example.com',
        phone: '+2347012345678',
        isVerified: false,
        createdAt: '2026-06-29T10:00:00.000Z',
        updatedAt: '2026-06-29T11:00:00.000Z'
      });
      passwordUtils.comparePassword
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      const result = await authService.changePassword({
        userId: 5,
        currentPassword: 'OldPassword123',
        newPassword: 'NewPassword123'
      });

      expect(passwordUtils.comparePassword).toHaveBeenNthCalledWith(1, 'OldPassword123', 'stored-hash');
      expect(passwordUtils.comparePassword).toHaveBeenNthCalledWith(2, 'NewPassword123', 'stored-hash');
      expect(passwordUtils.hashPassword).toHaveBeenCalledWith('NewPassword123');
      expect(usersRepository.updatePassword).toHaveBeenCalledWith(5, 'hashed-password');
      expect(result.message).toBe('Password updated successfully.');
      expect(result.data.user.id).toBe(5);
    });

    it('rejects an invalid current password', async () => {
      usersRepository.findById.mockResolvedValue({
        id: 5,
        passwordHash: 'stored-hash'
      });
      passwordUtils.comparePassword.mockResolvedValue(false);

      await expect(authService.changePassword({
        userId: 5,
        currentPassword: 'WrongPassword123',
        newPassword: 'NewPassword123'
      })).rejects.toMatchObject({
        statusCode: 401,
        code: 'INVALID_CREDENTIALS'
      });
    });
  });
});
