const express = require('express');
const { USER_ROLES } = require('../config/constants');
const asyncHandler = require('../middleware/async-handler');
const { authorizeRoles } = require('../middleware/role.middleware');
const { createSellerDocumentsUploadMiddleware } = require('../middleware/upload.middleware');
const { createAuthRateLimiter } = require('../middleware/rate-limit.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const {
  sellerDocumentsUploadSchema,
  sellerRegisterSchema
} = require('../validators/seller.validator');

function createSellerRouter({ authMiddleware, env, sellerController }) {
  const router = express.Router();
  const authRateLimiter = createAuthRateLimiter();
  const uploadSellerDocuments = createSellerDocumentsUploadMiddleware({ env });

  router.post(
    '/register',
    authRateLimiter,
    validateRequest(sellerRegisterSchema),
    asyncHandler(sellerController.register)
  );

  router.post(
    '/documents',
    authMiddleware,
    authorizeRoles(USER_ROLES.SELLER),
    uploadSellerDocuments,
    validateRequest(sellerDocumentsUploadSchema),
    asyncHandler(sellerController.uploadDocuments)
  );

  router.get(
    '/me',
    authMiddleware,
    authorizeRoles(USER_ROLES.SELLER),
    asyncHandler(sellerController.getMe)
  );

  return router;
}

module.exports = {
  createSellerRouter
};
