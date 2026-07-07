const {
  ERROR_CODES,
  SELLER_DOCUMENT_TYPES,
  SELLER_VERIFICATION_STATUSES,
  USER_ROLES
} = require('../config/constants');
const AppError = require('../utils/app-error');
const { isValidNigerianPhone, normalizeNigerianPhone } = require('../utils/phone');
const { sanitizeSellerAccount } = require('../utils/seller');
const { sanitizeUser } = require('../utils/user');

function normalizeEmail(email) {
  return email ? email.trim().toLowerCase() : null;
}

function resolveVerificationStatus({ autoVerifyEnabled, currentStatus }) {
  if (autoVerifyEnabled) {
    return SELLER_VERIFICATION_STATUSES.VERIFIED;
  }

  if (currentStatus === SELLER_VERIFICATION_STATUSES.VERIFIED) {
    return SELLER_VERIFICATION_STATUSES.VERIFIED;
  }

  return SELLER_VERIFICATION_STATUSES.PENDING;
}

function resolveRejectionReason({ autoVerifyEnabled, currentStatus, currentRejectionReason }) {
  if (autoVerifyEnabled) {
    return null;
  }

  if (currentStatus === SELLER_VERIFICATION_STATUSES.VERIFIED) {
    return currentRejectionReason;
  }

  return null;
}

function createSellersService({ env, jwtUtils, passwordUtils, sellersRepository, usersRepository }) {
  async function registerSeller(payload) {
    const email = normalizeEmail(payload.email);
    const phone = payload.phone ? normalizeNigerianPhone(payload.phone) : null;
    const contactEmail = normalizeEmail(payload.contactEmail || email);
    const contactPhone = payload.contactPhone
      ? normalizeNigerianPhone(payload.contactPhone)
      : phone;

    if (!email && !phone) {
      throw new AppError('Email or Nigerian phone number is required.', {
        statusCode: 422,
        code: ERROR_CODES.VALIDATION_ERROR
      });
    }

    if (contactPhone && !isValidNigerianPhone(contactPhone)) {
      throw new AppError('Contact phone must be a valid Nigerian phone number.', {
        statusCode: 422,
        code: ERROR_CODES.VALIDATION_ERROR
      });
    }

    if (!contactEmail && !contactPhone) {
      throw new AppError('Contact email or contact phone is required.', {
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

    const existingSellerAccount = await sellersRepository.findByCacNumber(payload.cacNumber.trim());

    if (existingSellerAccount) {
      throw new AppError('A seller profile with this CAC number already exists.', {
        statusCode: 409,
        code: ERROR_CODES.CONFLICT
      });
    }

    const passwordHash = await passwordUtils.hashPassword(payload.password);
    const sellerAccount = await sellersRepository.createSellerAccount({
      user: {
        role: USER_ROLES.SELLER,
        fullName: payload.fullName.trim(),
        email,
        phone,
        passwordHash,
        isVerified: false
      },
      profile: {
        businessName: payload.businessName.trim(),
        contactPhone,
        contactEmail,
        address: payload.address.trim(),
        cacNumber: payload.cacNumber.trim(),
        verificationStatus: SELLER_VERIFICATION_STATUSES.PENDING,
        rejectionReason: null
      }
    });

    const token = jwtUtils.signAccessToken({
      sub: sellerAccount.user.id,
      role: sellerAccount.user.role
    });

    return {
      token,
      ...sanitizeSellerAccount(sellerAccount, sanitizeUser)
    };
  }

  async function uploadDocuments({ documents, userId }) {
    const sellerAccount = await sellersRepository.findByUserId(userId);

    if (!sellerAccount) {
      throw new AppError('Seller profile was not found.', {
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND
      });
    }

    if (!documents.cacDocument || !documents.proofOfAddressDocument) {
      throw new AppError('Both CAC and proof of address documents are required.', {
        statusCode: 422,
        code: ERROR_CODES.VALIDATION_ERROR
      });
    }

    const autoVerifyEnabled = Boolean(env.SELLER_AUTO_VERIFY);
    const nextStatus = resolveVerificationStatus({
      autoVerifyEnabled,
      currentStatus: sellerAccount.sellerProfile.verificationStatus
    });
    const nextRejectionReason = resolveRejectionReason({
      autoVerifyEnabled,
      currentStatus: sellerAccount.sellerProfile.verificationStatus,
      currentRejectionReason: sellerAccount.sellerProfile.rejectionReason
    });

    const updatedSellerAccount = await sellersRepository.replaceDocuments({
      sellerId: sellerAccount.sellerProfile.id,
      documents: [
        {
          type: SELLER_DOCUMENT_TYPES.CAC,
          filePath: documents.cacDocument.filePath
        },
        {
          type: SELLER_DOCUMENT_TYPES.PROOF_OF_ADDRESS,
          filePath: documents.proofOfAddressDocument.filePath
        }
      ],
      verificationStatus: nextStatus,
      rejectionReason: nextRejectionReason
    });

    if (autoVerifyEnabled && nextStatus === SELLER_VERIFICATION_STATUSES.VERIFIED) {
      // ADMIN-STUB: local auto-verify remains for dev, while non-dev review now lives in admin verification routes.
    }

    return sanitizeSellerAccount(updatedSellerAccount, sanitizeUser);
  }

  async function getSellerProfile(userId) {
    const sellerAccount = await sellersRepository.findByUserId(userId);

    if (!sellerAccount) {
      throw new AppError('Seller profile was not found.', {
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND
      });
    }

    return sanitizeSellerAccount(sellerAccount, sanitizeUser);
  }

  return {
    getSellerProfile,
    registerSeller,
    uploadDocuments
  };
}

module.exports = {
  createSellersService
};
