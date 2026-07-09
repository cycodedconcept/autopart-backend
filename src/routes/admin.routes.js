const express = require('express');
const {
  ADMIN_PERMISSION_KEYS
} = require('../config/constants');
const asyncHandler = require('../middleware/async-handler');
const { authorizePermissions } = require('../middleware/permission.middleware');
const { createAuthRateLimiter } = require('../middleware/rate-limit.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const {
  adminLoginSchema,
  createCategorySchema,
  createVehicleTaxonomySchema,
  deleteCategorySchema,
  deleteVehicleTaxonomySchema,
  getCategorySchema,
  getSellerVerificationCandidateSchema,
  getVehicleTaxonomySchema,
  listCategoriesSchema,
  listSellerVerificationQueueSchema,
  listVehicleTaxonomySchema,
  updateCategorySchema,
  updateSellerVerificationStatusSchema,
  updateVehicleTaxonomySchema
} = require('../validators/admin.validator');

function createAdminRouter({ adminAuthMiddleware, adminController }) {
  const router = express.Router();
  const authRateLimiter = createAuthRateLimiter();

  router.post(
    '/login',
    authRateLimiter,
    validateRequest(adminLoginSchema),
    asyncHandler(adminController.login)
  );

  router.use(adminAuthMiddleware);

  router.get(
    '/me',
    authorizePermissions(ADMIN_PERMISSION_KEYS.READ_SELF),
    asyncHandler(adminController.getMe)
  );

  router.get(
    '/categories',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_CATEGORIES),
    validateRequest(listCategoriesSchema),
    asyncHandler(adminController.listCategories)
  );

  router.post(
    '/categories',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_CATEGORIES),
    validateRequest(createCategorySchema),
    asyncHandler(adminController.createCategory)
  );

  router.get(
    '/categories/:id',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_CATEGORIES),
    validateRequest(getCategorySchema),
    asyncHandler(adminController.getCategory)
  );

  router.patch(
    '/categories/:id',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_CATEGORIES),
    validateRequest(updateCategorySchema),
    asyncHandler(adminController.updateCategory)
  );

  router.delete(
    '/categories/:id',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_CATEGORIES),
    validateRequest(deleteCategorySchema),
    asyncHandler(adminController.deleteCategory)
  );

  router.get(
    '/vehicle-taxonomy',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_CATEGORIES),
    validateRequest(listVehicleTaxonomySchema),
    asyncHandler(adminController.listVehicleTaxonomy)
  );

  router.post(
    '/vehicle-taxonomy',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_CATEGORIES),
    validateRequest(createVehicleTaxonomySchema),
    asyncHandler(adminController.createVehicleTaxonomyEntry)
  );

  router.get(
    '/vehicle-taxonomy/:id',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_CATEGORIES),
    validateRequest(getVehicleTaxonomySchema),
    asyncHandler(adminController.getVehicleTaxonomyEntry)
  );

  router.patch(
    '/vehicle-taxonomy/:id',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_CATEGORIES),
    validateRequest(updateVehicleTaxonomySchema),
    asyncHandler(adminController.updateVehicleTaxonomyEntry)
  );

  router.delete(
    '/vehicle-taxonomy/:id',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_CATEGORIES),
    validateRequest(deleteVehicleTaxonomySchema),
    asyncHandler(adminController.deleteVehicleTaxonomyEntry)
  );

  router.get(
    '/sellers',
    authorizePermissions(ADMIN_PERMISSION_KEYS.VERIFY_SELLERS),
    validateRequest(listSellerVerificationQueueSchema),
    asyncHandler(adminController.listSellerVerificationQueue)
  );

  router.get(
    '/sellers/:id',
    authorizePermissions(ADMIN_PERMISSION_KEYS.VERIFY_SELLERS),
    validateRequest(getSellerVerificationCandidateSchema),
    asyncHandler(adminController.getSellerVerificationCandidate)
  );

  router.patch(
    '/sellers/:id/verification',
    authorizePermissions(ADMIN_PERMISSION_KEYS.VERIFY_SELLERS),
    validateRequest(updateSellerVerificationStatusSchema),
    asyncHandler(adminController.updateSellerVerificationStatus)
  );

  return router;
}

module.exports = {
  createAdminRouter
};
