const {
  ERROR_CODES,
  SELLER_DOCUMENT_TYPES,
  SELLER_VERIFICATION_STATUSES,
  TOKEN_SUBJECT_TYPES
} = require('../config/constants');
const { sanitizeAdmin } = require('../utils/admin');
const AppError = require('../utils/app-error');
const { buildPagination, normalizePagination } = require('../utils/pagination');
const { sanitizeSellerAccount } = require('../utils/seller');
const { sanitizeUser } = require('../utils/user');

function normalizeEmail(email) {
  return email ? email.trim().toLowerCase() : null;
}

function normalizeVerificationQueueStatus(status) {
  return status || SELLER_VERIFICATION_STATUSES.PENDING;
}

function resolveRejectionReason(status, rejectionReason) {
  if (status !== SELLER_VERIFICATION_STATUSES.REJECTED) {
    return null;
  }

  return rejectionReason.trim();
}

function sellerHasRequiredDocuments(sellerAccount) {
  const documentTypes = new Set(
    (sellerAccount.sellerProfile.documents || []).map((document) => document.type)
  );

  return (
    documentTypes.has(SELLER_DOCUMENT_TYPES.CAC)
    && documentTypes.has(SELLER_DOCUMENT_TYPES.PROOF_OF_ADDRESS)
  );
}

function createAdminService({ adminRepository, jwtUtils, passwordUtils }) {
  async function getAuthenticatedAdmin(token) {
    let decodedToken;

    try {
      decodedToken = jwtUtils.verifyAccessToken(token);
    } catch (_error) {
      throw new AppError('Invalid or expired access token.', {
        statusCode: 401,
        code: ERROR_CODES.UNAUTHORIZED
      });
    }

    if (decodedToken.actorType !== TOKEN_SUBJECT_TYPES.ADMIN) {
      throw new AppError('Invalid or expired access token.', {
        statusCode: 401,
        code: ERROR_CODES.UNAUTHORIZED
      });
    }

    const admin = await adminRepository.findAdminById(decodedToken.sub);

    if (!admin || !admin.isActive) {
      throw new AppError('Authenticated admin was not found.', {
        statusCode: 401,
        code: ERROR_CODES.UNAUTHORIZED
      });
    }

    return sanitizeAdmin(admin);
  }

  async function login(payload) {
    const email = normalizeEmail(payload.email);
    const admin = await adminRepository.findAdminByEmail(email);

    if (!admin) {
      throw new AppError('Invalid email or password.', {
        statusCode: 401,
        code: ERROR_CODES.INVALID_CREDENTIALS
      });
    }

    const isPasswordValid = await passwordUtils.comparePassword(payload.password, admin.passwordHash);

    if (!isPasswordValid) {
      throw new AppError('Invalid email or password.', {
        statusCode: 401,
        code: ERROR_CODES.INVALID_CREDENTIALS
      });
    }

    if (!admin.isActive) {
      throw new AppError('This admin account is inactive.', {
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN
      });
    }

    const token = jwtUtils.signAccessToken({
      sub: admin.id,
      actorType: TOKEN_SUBJECT_TYPES.ADMIN
    });

    return {
      token,
      admin: sanitizeAdmin(admin)
    };
  }

  return {
    getAuthenticatedAdmin,

    async listSellerVerificationQueue(payload) {
      const pagination = normalizePagination(payload.query, {
        defaultLimit: 10,
        maxLimit: 50
      });
      const status = normalizeVerificationQueueStatus(payload.query.status);
      const result = await adminRepository.listSellerVerificationQueue({
        status,
        limit: pagination.limit,
        offset: pagination.offset
      });

      return {
        sellers: result.sellers.map((sellerAccount) => sanitizeSellerAccount(
          sellerAccount,
          sanitizeUser
        )),
        pagination: buildPagination({
          page: pagination.page,
          limit: pagination.limit,
          total: result.total
        }),
        filters: {
          status
        }
      };
    },

    login,

    async updateSellerVerificationStatus(payload) {
      const sellerAccount = await adminRepository.findSellerAccountBySellerId(payload.sellerId);

      if (!sellerAccount) {
        throw new AppError('Seller profile was not found.', {
          statusCode: 404,
          code: ERROR_CODES.NOT_FOUND
        });
      }

      if (!sellerHasRequiredDocuments(sellerAccount)) {
        throw new AppError('Seller verification requires both CAC and proof of address documents.', {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT
        });
      }

      if (sellerAccount.sellerProfile.verificationStatus === payload.verificationStatus) {
        throw new AppError('Seller already has this verification status.', {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT
        });
      }

      const updatedSellerAccount = await adminRepository.updateSellerVerificationStatus({
        sellerId: payload.sellerId,
        status: payload.verificationStatus,
        rejectionReason: resolveRejectionReason(
          payload.verificationStatus,
          payload.rejectionReason || ''
        )
      });

      return sanitizeSellerAccount(updatedSellerAccount, sanitizeUser);
    }
  };
}

module.exports = {
  createAdminService
};
