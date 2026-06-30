const express = require('express');
const asyncHandler = require('../middleware/async-handler');
const { validateRequest } = require('../middleware/validate.middleware');
const {
  addCartItemSchema,
  deleteCartItemSchema,
  getCartSchema,
  updateCartItemSchema
} = require('../validators/cart.validator');

function createCartRouter({ authMiddleware, cartController }) {
  const router = express.Router();

  router.get(
    '/',
    authMiddleware,
    validateRequest(getCartSchema),
    asyncHandler(cartController.getCart)
  );

  router.post(
    '/items',
    authMiddleware,
    validateRequest(addCartItemSchema),
    asyncHandler(cartController.addItem)
  );

  router.patch(
    '/items/:id',
    authMiddleware,
    validateRequest(updateCartItemSchema),
    asyncHandler(cartController.updateItemQuantity)
  );

  router.delete(
    '/items/:id',
    authMiddleware,
    validateRequest(deleteCartItemSchema),
    asyncHandler(cartController.removeItem)
  );

  return router;
}

module.exports = {
  createCartRouter
};
