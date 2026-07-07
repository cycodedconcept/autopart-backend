const express = require('express');
const { USER_ROLES } = require('../config/constants');
const asyncHandler = require('../middleware/async-handler');
const { authorizeRoles } = require('../middleware/role.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const {
  createSellerPayoutSchema,
  listSellerPayoutsSchema,
  sellerSalesSummarySchema
} = require('../validators/seller-finance.validator');

function createSellerFinanceRouter({ authMiddleware, sellerFinanceController }) {
  const router = express.Router();

  router.get(
    '/sales',
    authMiddleware,
    authorizeRoles(USER_ROLES.SELLER),
    validateRequest(sellerSalesSummarySchema),
    asyncHandler(sellerFinanceController.getSalesSummary)
  );

  router.post(
    '/payouts',
    authMiddleware,
    authorizeRoles(USER_ROLES.SELLER),
    validateRequest(createSellerPayoutSchema),
    asyncHandler(sellerFinanceController.createPayoutRequest)
  );

  router.get(
    '/payouts',
    authMiddleware,
    authorizeRoles(USER_ROLES.SELLER),
    validateRequest(listSellerPayoutsSchema),
    asyncHandler(sellerFinanceController.listPayouts)
  );

  return router;
}

module.exports = {
  createSellerFinanceRouter
};
