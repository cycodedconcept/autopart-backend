const express = require('express');
const { USER_ROLES } = require('../config/constants');
const asyncHandler = require('../middleware/async-handler');
const { authorizeRoles } = require('../middleware/role.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const {
  listSellerVerificationQueueSchema,
  updateSellerVerificationStatusSchema
} = require('../validators/admin.validator');

function createAdminRouter({ adminController, authMiddleware }) {
  const router = express.Router();

  router.use(authMiddleware);
  router.use(authorizeRoles(USER_ROLES.ADMIN));

  router.get(
    '/sellers',
    validateRequest(listSellerVerificationQueueSchema),
    asyncHandler(adminController.listSellerVerificationQueue)
  );

  router.patch(
    '/sellers/:id/verification',
    validateRequest(updateSellerVerificationStatusSchema),
    asyncHandler(adminController.updateSellerVerificationStatus)
  );

  return router;
}

module.exports = {
  createAdminRouter
};
