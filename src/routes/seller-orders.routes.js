const express = require('express');
const { USER_ROLES } = require('../config/constants');
const asyncHandler = require('../middleware/async-handler');
const { authorizeRoles } = require('../middleware/role.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const {
  listSellerOrdersSchema,
  updateSellerOrderItemStatusSchema
} = require('../validators/seller-orders.validator');

function createSellerOrdersRouter({ authMiddleware, sellerOrdersController }) {
  const router = express.Router();

  router.use(authMiddleware);
  router.use(authorizeRoles(USER_ROLES.SELLER));

  router.get(
    '/',
    validateRequest(listSellerOrdersSchema),
    asyncHandler(sellerOrdersController.listOrders)
  );

  router.patch(
    '/:id/status',
    validateRequest(updateSellerOrderItemStatusSchema),
    asyncHandler(sellerOrdersController.updateOrderItemStatus)
  );

  return router;
}

module.exports = {
  createSellerOrdersRouter
};
