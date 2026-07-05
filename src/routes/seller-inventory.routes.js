const express = require('express');
const { USER_ROLES } = require('../config/constants');
const asyncHandler = require('../middleware/async-handler');
const { authorizeRoles } = require('../middleware/role.middleware');
const { createSellerInventoryCsvUploadMiddleware } = require('../middleware/upload.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const {
  bulkUploadSellerInventorySchema,
  listSellerInventorySchema
} = require('../validators/seller-inventory.validator');

function createSellerInventoryRouter({ authMiddleware, sellerInventoryController }) {
  const router = express.Router();
  const uploadInventoryCsv = createSellerInventoryCsvUploadMiddleware();

  router.use(authMiddleware);
  router.use(authorizeRoles(USER_ROLES.SELLER));

  router.get(
    '/',
    validateRequest(listSellerInventorySchema),
    asyncHandler(sellerInventoryController.getInventory)
  );

  router.post(
    '/bulk',
    uploadInventoryCsv,
    validateRequest(bulkUploadSellerInventorySchema),
    asyncHandler(sellerInventoryController.bulkUpload)
  );

  return router;
}

module.exports = {
  createSellerInventoryRouter
};
