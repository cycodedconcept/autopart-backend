const { ERROR_CODES, USER_ROLES } = require('../config/constants');
const AppError = require('../utils/app-error');
const { isValidNigerianPhone, normalizeNigerianPhone } = require('../utils/phone');

function normalizeEmail(email) {
  return email ? email.trim().toLowerCase() : null;
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    role: user.role,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    isVerified: user.isVerified,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function resolveIdentifier(identifier) {
  if (!identifier || typeof identifier !== 'string') {
    return {
      email: null,
      phone: null
    };
  }

  const trimmedIdentifier = identifier.trim();

  if (trimmedIdentifier.includes('@')) {
    return {
      email: normalizeEmail(trimmedIdentifier),
      phone: null
    };
  }

  if (isValidNigerianPhone(trimmedIdentifier)) {
    return {
      email: null,
      phone: normalizeNigerianPhone(trimmedIdentifier)
    };
  }

  return {
    email: null,
    phone: null
  };
}

function createAuthService({ usersRepository, jwtUtils, passwordUtils, passwordResetUtils, env }) {
  async function findUserByIdentifier(identifier) {
    const resolvedIdentifier = resolveIdentifier(identifier);

    if (resolvedIdentifier.email) {
      return usersRepository.findByEmail(resolvedIdentifier.email);
    }

    if (resolvedIdentifier.phone) {
      return usersRepository.findByPhone(resolvedIdentifier.phone);
    }

    return null;
  }

  async function register(payload) {
    const email = normalizeEmail(payload.email);
    const phone = payload.phone ? normalizeNigerianPhone(payload.phone) : null;

    if (!email && !phone) {
      throw new AppError('Email or Nigerian phone number is required.', {
        statusCode: 422,
        code: ERROR_CODES.VALIDATION_ERROR
      });
    }

    if (email) {
      const existingEmailUser = await usersRepository.findByEmail(email);

      if (existingEmailUser) {
        throw new AppError('An account with this email already exists.', {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT
        });
      }
    }

    if (phone) {
      const existingPhoneUser = await usersRepository.findByPhone(phone);

      if (existingPhoneUser) {
        throw new AppError('An account with this phone number already exists.', {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT
        });
      }
    }

    const passwordHash = await passwordUtils.hashPassword(payload.password);
    const user = await usersRepository.createUser({
      role: USER_ROLES.BUYER,
      fullName: payload.fullName.trim(),
      email,
      phone,
      passwordHash,
      isVerified: false
    });

    const token = jwtUtils.signAccessToken({
      sub: user.id,
      role: user.role
    });

    return {
      token,
      user: sanitizeUser(user)
    };
  }

  async function login(payload) {
    const user = await findUserByIdentifier(payload.identifier);

    if (!user) {
      throw new AppError('Invalid email/phone or password.', {
        statusCode: 401,
        code: ERROR_CODES.INVALID_CREDENTIALS
      });
    }

    const isPasswordValid = await passwordUtils.comparePassword(payload.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new AppError('Invalid email/phone or password.', {
        statusCode: 401,
        code: ERROR_CODES.INVALID_CREDENTIALS
      });
    }

    const token = jwtUtils.signAccessToken({
      sub: user.id,
      role: user.role
    });

    return {
      token,
      user: sanitizeUser(user)
    };
  }

  async function forgotPassword(payload) {
    const user = await findUserByIdentifier(payload.identifier);
    const message = 'If an account matches the provided details, a password reset token has been generated.';

    if (!user) {
      return {
        data: {},
        message
      };
    }

    const resetToken = passwordResetUtils.generateResetToken();
    const passwordResetTokenHash = passwordResetUtils.hashResetToken(resetToken);
    const passwordResetExpiresAt = new Date(
      Date.now() + (env.PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000)
    );

    await usersRepository.storePasswordResetToken({
      userId: user.id,
      passwordResetTokenHash,
      passwordResetExpiresAt
    });

    return {
      data: env.NODE_ENV === 'production'
        ? {}
        : {
          resetToken,
          expiresAt: passwordResetExpiresAt.toISOString()
        },
      message
    };
  }

  async function resetPassword(payload) {
    const passwordResetTokenHash = passwordResetUtils.hashResetToken(payload.token.trim());
    const user = await usersRepository.findByPasswordResetTokenHash(passwordResetTokenHash);

    if (!user || !user.passwordResetExpiresAt || new Date(user.passwordResetExpiresAt) < new Date()) {
      throw new AppError('Password reset token is invalid or has expired.', {
        statusCode: 400,
        code: ERROR_CODES.INVALID_RESET_TOKEN
      });
    }

    const passwordHash = await passwordUtils.hashPassword(payload.newPassword);
    await usersRepository.updatePassword(user.id, passwordHash);

    return {
      data: {},
      message: 'Password has been reset successfully.'
    };
  }

  async function changePassword(payload) {
    const user = await usersRepository.findById(payload.userId);

    if (!user) {
      throw new AppError('Authenticated user was not found.', {
        statusCode: 401,
        code: ERROR_CODES.UNAUTHORIZED
      });
    }

    const isCurrentPasswordValid = await passwordUtils.comparePassword(
      payload.currentPassword,
      user.passwordHash
    );

    if (!isCurrentPasswordValid) {
      throw new AppError('Current password is incorrect.', {
        statusCode: 401,
        code: ERROR_CODES.INVALID_CREDENTIALS
      });
    }

    const isSamePassword = await passwordUtils.comparePassword(
      payload.newPassword,
      user.passwordHash
    );

    if (isSamePassword) {
      throw new AppError('New password must be different from the current password.', {
        statusCode: 422,
        code: ERROR_CODES.VALIDATION_ERROR
      });
    }

    const passwordHash = await passwordUtils.hashPassword(payload.newPassword);
    const updatedUser = await usersRepository.updatePassword(user.id, passwordHash);

    return {
      data: {
        user: sanitizeUser(updatedUser)
      },
      message: 'Password updated successfully.'
    };
  }

  async function getAuthenticatedUser(token) {
    let decodedToken;

    try {
      decodedToken = jwtUtils.verifyAccessToken(token);
    } catch (_error) {
      throw new AppError('Invalid or expired access token.', {
        statusCode: 401,
        code: ERROR_CODES.UNAUTHORIZED
      });
    }

    const user = await usersRepository.findById(decodedToken.sub);

    if (!user) {
      throw new AppError('Authenticated user was not found.', {
        statusCode: 401,
        code: ERROR_CODES.UNAUTHORIZED
      });
    }

    return sanitizeUser(user);
  }

  return {
    changePassword,
    forgotPassword,
    getAuthenticatedUser,
    login,
    resetPassword,
    register
  };
}

module.exports = {
  createAuthService
};
