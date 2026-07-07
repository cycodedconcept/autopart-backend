const {
  ERROR_CODES,
  SELLER_DOCUMENT_TYPES,
  SELLER_VERIFICATION_STATUSES
} = require('../config/constants');
const AppError = require('../utils/app-error');
const { buildPagination, normalizePagination } = require('../utils/pagination');
const { sanitizeSellerAccount } = require('../utils/seller');
const { sanitizeUser } = require('../utils/user');

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

function createAdminService({ adminRepository }) {
  return {
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
