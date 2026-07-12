const {
  ERROR_CODES,
  TOKEN_SUBJECT_TYPES,
  USER_ACCOUNT_STATUSES,
  USER_ROLES
} = require('../config/constants');
const AppError = require('../utils/app-error');
const { isValidNigerianPhone, normalizeNigerianPhone } = require('../utils/phone');
const { sanitizeUser } = require('../utils/user');

function normalizeEmail(email) {
  return email ? email.trim().toLowerCase() : null;
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
  function buildInvalidCredentialsError() {
    return new AppError('Invalid email/phone or password.', {
      statusCode: 401,
      code: ERROR_CODES.INVALID_CREDENTIALS
    });
  }

  function ensureAccountIsActive(user) {
    if (!user || !user.accountStatus || user.accountStatus === USER_ACCOUNT_STATUSES.ACTIVE) {
      return user;
    }

    throw new AppError(
      user.accountStatus === USER_ACCOUNT_STATUSES.BANNED
        ? 'This account has been banned.'
        : 'This account has been suspended.',
      {
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN
      }
    );
  }

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
      role: user.role,
      actorType: TOKEN_SUBJECT_TYPES.USER
    });

    return {
      token,
      user: sanitizeUser(user)
    };
  }

  async function login(payload) {
    const user = await findUserByIdentifier(payload.identifier);

    if (!user || user.role === USER_ROLES.ADMIN) {
      throw buildInvalidCredentialsError();
    }

    const isPasswordValid = await passwordUtils.comparePassword(payload.password, user.passwordHash);

    if (!isPasswordValid) {
      throw buildInvalidCredentialsError();
    }

    ensureAccountIsActive(user);

    const token = jwtUtils.signAccessToken({
      sub: user.id,
      role: user.role,
      actorType: TOKEN_SUBJECT_TYPES.USER
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

    ensureAccountIsActive(user);

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

    if (decodedToken.actorType && decodedToken.actorType !== TOKEN_SUBJECT_TYPES.USER) {
      throw new AppError('Invalid or expired access token.', {
        statusCode: 401,
        code: ERROR_CODES.UNAUTHORIZED
      });
    }

    const user = await usersRepository.findById(decodedToken.sub);

    if (!user || user.role === USER_ROLES.ADMIN) {
      throw new AppError('Authenticated user was not found.', {
        statusCode: 401,
        code: ERROR_CODES.UNAUTHORIZED
      });
    }

    ensureAccountIsActive(user);

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
