const express = require('express');
const asyncHandler = require('../middleware/async-handler');
const { validateRequest } = require('../middleware/validate.middleware');
const { createOrderSchema } = require('../validators/orders.validator');

function createOrdersRouter({ authMiddleware, ordersController }) {
  const router = express.Router();

  router.post(
    '/',
    authMiddleware,
    validateRequest(createOrderSchema),
    asyncHandler(ordersController.createOrder)
  );

  return router;
}

module.exports = {
  createOrdersRouter
};
