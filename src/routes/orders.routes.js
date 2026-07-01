const express = require('express');
const asyncHandler = require('../middleware/async-handler');
const { validateRequest } = require('../middleware/validate.middleware');
const {
  createOrderSchema,
  getOrderByIdSchema,
  getOrderReceiptSchema,
  getOrderStatusSchema,
  listOrdersSchema
} = require('../validators/orders.validator');

function createOrdersRouter({ authMiddleware, ordersController }) {
  const router = express.Router();

  router.get(
    '/',
    authMiddleware,
    validateRequest(listOrdersSchema),
    asyncHandler(ordersController.listOrders)
  );

  router.post(
    '/',
    authMiddleware,
    validateRequest(createOrderSchema),
    asyncHandler(ordersController.createOrder)
  );

  router.get(
    '/:id/status',
    authMiddleware,
    validateRequest(getOrderStatusSchema),
    asyncHandler(ordersController.getOrderStatus)
  );

  router.get(
    '/:id/receipt',
    authMiddleware,
    validateRequest(getOrderReceiptSchema),
    asyncHandler(ordersController.getOrderReceipt)
  );

  router.get(
    '/:id',
    authMiddleware,
    validateRequest(getOrderByIdSchema),
    asyncHandler(ordersController.getOrderById)
  );

  return router;
}

module.exports = {
  createOrdersRouter
};
