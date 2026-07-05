const express = require('express');
const { USER_ROLES } = require('../config/constants');
const asyncHandler = require('../middleware/async-handler');
const { authorizeRoles } = require('../middleware/role.middleware');
const { parseJsonFields } = require('../middleware/parse-json-fields.middleware');
const { createSellerProductImagesUploadMiddleware } = require('../middleware/upload.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const {
  createSellerProductSchema,
  deleteSellerProductSchema,
  listSellerProductsSchema,
  updateSellerProductSchema
} = require('../validators/seller-products.validator');

function createSellerProductsRouter({ authMiddleware, env, sellerProductsController }) {
  const router = express.Router();
  const uploadProductImages = createSellerProductImagesUploadMiddleware({ env });

  router.use(authMiddleware);
  router.use(authorizeRoles(USER_ROLES.SELLER));

  router.get(
    '/',
    validateRequest(listSellerProductsSchema),
    asyncHandler(sellerProductsController.listProducts)
  );

  router.post(
    '/',
    uploadProductImages,
    parseJsonFields(['compatibility']),
    validateRequest(createSellerProductSchema),
    asyncHandler(sellerProductsController.createProduct)
  );

  router.patch(
    '/:id',
    uploadProductImages,
    parseJsonFields(['compatibility']),
    validateRequest(updateSellerProductSchema),
    asyncHandler(sellerProductsController.updateProduct)
  );

  router.delete(
    '/:id',
    validateRequest(deleteSellerProductSchema),
    asyncHandler(sellerProductsController.deleteProduct)
  );

  return router;
}

module.exports = {
  createSellerProductsRouter
};
