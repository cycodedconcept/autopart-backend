const express = require('express');
const asyncHandler = require('../middleware/async-handler');
const { validateRequest } = require('../middleware/validate.middleware');
const {
  getProductByIdSchema,
  listProductsSchema
} = require('../validators/products.validator');

function createProductsRouter({ productsController }) {
  const router = express.Router();

  router.get(
    '/',
    validateRequest(listProductsSchema),
    asyncHandler(productsController.listProducts)
  );

  router.get(
    '/:id',
    validateRequest(getProductByIdSchema),
    asyncHandler(productsController.getProductById)
  );

  return router;
}

module.exports = {
  createProductsRouter
};
