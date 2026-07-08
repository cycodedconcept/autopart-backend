const express = require('express');
const {
  ADMIN_PERMISSION_KEYS
} = require('../config/constants');
const asyncHandler = require('../middleware/async-handler');
const { authorizePermissions } = require('../middleware/permission.middleware');
const { createAuthRateLimiter } = require('../middleware/rate-limit.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const {
  adminLoginSchema,
  listSellerVerificationQueueSchema,
  updateSellerVerificationStatusSchema
} = require('../validators/admin.validator');

function createAdminRouter({ adminAuthMiddleware, adminController }) {
  const router = express.Router();
  const authRateLimiter = createAuthRateLimiter();

  router.post(
    '/login',
    authRateLimiter,
    validateRequest(adminLoginSchema),
    asyncHandler(adminController.login)
  );

  router.use(adminAuthMiddleware);

  router.get(
    '/me',
    authorizePermissions(ADMIN_PERMISSION_KEYS.READ_SELF),
    asyncHandler(adminController.getMe)
  );

  router.get(
    '/sellers',
    authorizePermissions(ADMIN_PERMISSION_KEYS.VERIFY_SELLERS),
    validateRequest(listSellerVerificationQueueSchema),
    asyncHandler(adminController.listSellerVerificationQueue)
  );

  router.patch(
    '/sellers/:id/verification',
    authorizePermissions(ADMIN_PERMISSION_KEYS.VERIFY_SELLERS),
    validateRequest(updateSellerVerificationStatusSchema),
    asyncHandler(adminController.updateSellerVerificationStatus)
  );

  return router;
}

module.exports = {
  createAdminRouter
};
