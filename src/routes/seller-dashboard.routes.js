const express = require('express');
const { USER_ROLES } = require('../config/constants');
const asyncHandler = require('../middleware/async-handler');
const { authorizeRoles } = require('../middleware/role.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const { sellerSalesSummarySchema } = require('../validators/seller-finance.validator');

function createSellerDashboardRouter({ authMiddleware, sellerDashboardController }) {
  const router = express.Router();

  router.get(
    '/dashboard',
    authMiddleware,
    authorizeRoles(USER_ROLES.SELLER),
    validateRequest(sellerSalesSummarySchema),
    asyncHandler(sellerDashboardController.getDashboard)
  );

  return router;
}

module.exports = {
  createSellerDashboardRouter
};
