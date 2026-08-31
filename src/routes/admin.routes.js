const express = require('express');
const {
  ADMIN_PERMISSION_KEYS
} = require('../config/constants');
const asyncHandler = require('../middleware/async-handler');
const { parseJsonFields } = require('../middleware/parse-json-fields.middleware');
const { authorizePermissions } = require('../middleware/permission.middleware');
const { createAuthRateLimiter } = require('../middleware/rate-limit.middleware');
const { createAdminBlogImageUploadMiddleware } = require('../middleware/upload.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const {
  adminLoginSchema,
  createAdminBlogCategorySchema,
  createAdminBlogPostSchema,
  createAdminBlogTagSchema,
  createCategorySchema,
  createVehicleTaxonomySchema,
  deleteAdminBlogCategorySchema,
  deleteAdminBlogPostSchema,
  deleteAdminBlogTagSchema,
  deleteCategorySchema,
  deleteVehicleTaxonomySchema,
  exportAdminNewsletterSubscribersSchema,
  getAdminDashboardSchema,
  getAdminBlogCategorySchema,
  getAdminBlogPostSchema,
  getAdminBlogTagSchema,
  getCategorySchema,
  getPlatformConfigSchema,
  getSellerVerificationCandidateSchema,
  listAdminBlogCategoriesSchema,
  listAdminBlogCommentsSchema,
  listAdminBlogPostsSchema,
  listAdminBlogTagsSchema,
  listAdminDisputesSchema,
  listAdminNewsletterSubscribersSchema,
  listAdminOrdersSchema,
  listAdminPayoutsSchema,
  listAuditLogsSchema,
  publishAdminBlogPostSchema,
  reconcilePendingPaymentsSchema,
  getVehicleTaxonomySchema,
  listCategoriesSchema,
  listSellerVerificationQueueSchema,
  listUsersSchema,
  listVehicleTaxonomySchema,
  unpublishAdminBlogPostSchema,
  updateAdminBlogCategorySchema,
  updateAdminBlogCommentSchema,
  updateAdminBlogPostSchema,
  updateAdminBlogTagSchema,
  updateAdminDisputeSchema,
  updateAdminOrderStatusSchema,
  updateAdminPayoutStatusSchema,
  updateCategorySchema,
  updatePlatformConfigSchema,
  updateSellerVerificationStatusSchema,
  updateUserStatusSchema,
  updateVehicleTaxonomySchema
} = require('../validators/admin.validator');
const {
  assignAdminDeliveryJobSchema,
  listAdminLogisticsCompaniesSchema,
  listAdminDeliveryJobsSchema,
  listAdminLogisticsRidersSchema,
  updateAdminLogisticsCompanyStatusSchema
} = require('../validators/logistics.validator');

function createAdminRouter({ adminAuthMiddleware, adminController, adminDashboardController, env }) {
  const router = express.Router();
  const authRateLimiter = createAuthRateLimiter();
  const uploadBlogImage = createAdminBlogImageUploadMiddleware({ env });

  router.post(
    '/login',
    authRateLimiter,
    validateRequest(adminLoginSchema),
    asyncHandler(adminController.login)
  );

  router.use(adminAuthMiddleware);

  router.get(
    '/dashboard',
    authorizePermissions(ADMIN_PERMISSION_KEYS.READ_DASHBOARD),
    validateRequest(getAdminDashboardSchema),
    asyncHandler(adminDashboardController.getDashboard)
  );

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
    '/blog/categories',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_BLOG_CATEGORIES),
    validateRequest(listAdminBlogCategoriesSchema),
    asyncHandler(adminController.listBlogCategories)
  );

  router.post(
    '/blog/categories',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_BLOG_CATEGORIES),
    validateRequest(createAdminBlogCategorySchema),
    asyncHandler(adminController.createBlogCategory)
  );

  router.get(
    '/blog/categories/:id',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_BLOG_CATEGORIES),
    validateRequest(getAdminBlogCategorySchema),
    asyncHandler(adminController.getBlogCategory)
  );

  router.patch(
    '/blog/categories/:id',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_BLOG_CATEGORIES),
    validateRequest(updateAdminBlogCategorySchema),
    asyncHandler(adminController.updateBlogCategory)
  );

  router.delete(
    '/blog/categories/:id',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_BLOG_CATEGORIES),
    validateRequest(deleteAdminBlogCategorySchema),
    asyncHandler(adminController.deleteBlogCategory)
  );

  router.get(
    '/blog/tags',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_BLOG_TAGS),
    validateRequest(listAdminBlogTagsSchema),
    asyncHandler(adminController.listBlogTags)
  );

  router.post(
    '/blog/tags',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_BLOG_TAGS),
    validateRequest(createAdminBlogTagSchema),
    asyncHandler(adminController.createBlogTag)
  );

  router.get(
    '/blog/tags/:id',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_BLOG_TAGS),
    validateRequest(getAdminBlogTagSchema),
    asyncHandler(adminController.getBlogTag)
  );

  router.patch(
    '/blog/tags/:id',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_BLOG_TAGS),
    validateRequest(updateAdminBlogTagSchema),
    asyncHandler(adminController.updateBlogTag)
  );

  router.delete(
    '/blog/tags/:id',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_BLOG_TAGS),
    validateRequest(deleteAdminBlogTagSchema),
    asyncHandler(adminController.deleteBlogTag)
  );

  router.get(
    '/blog/posts',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_BLOG_POSTS),
    validateRequest(listAdminBlogPostsSchema),
    asyncHandler(adminController.listBlogPosts)
  );

  router.post(
    '/blog/posts',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_BLOG_POSTS),
    uploadBlogImage,
    parseJsonFields(['tagIds']),
    validateRequest(createAdminBlogPostSchema),
    asyncHandler(adminController.createBlogPost)
  );

  router.get(
    '/blog/posts/:id',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_BLOG_POSTS),
    validateRequest(getAdminBlogPostSchema),
    asyncHandler(adminController.getBlogPost)
  );

  router.patch(
    '/blog/posts/:id',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_BLOG_POSTS),
    uploadBlogImage,
    parseJsonFields(['tagIds']),
    validateRequest(updateAdminBlogPostSchema),
    asyncHandler(adminController.updateBlogPost)
  );

  router.post(
    '/blog/posts/:id/publish',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_BLOG_POSTS),
    validateRequest(publishAdminBlogPostSchema),
    asyncHandler(adminController.publishBlogPost)
  );

  router.post(
    '/blog/posts/:id/unpublish',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_BLOG_POSTS),
    validateRequest(unpublishAdminBlogPostSchema),
    asyncHandler(adminController.unpublishBlogPost)
  );

  router.delete(
    '/blog/posts/:id',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_BLOG_POSTS),
    validateRequest(deleteAdminBlogPostSchema),
    asyncHandler(adminController.deleteBlogPost)
  );

  router.get(
    '/blog/comments',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_BLOG_COMMENTS),
    validateRequest(listAdminBlogCommentsSchema),
    asyncHandler(adminController.listBlogComments)
  );

  router.patch(
    '/blog/comments/:id',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_BLOG_COMMENTS),
    validateRequest(updateAdminBlogCommentSchema),
    asyncHandler(adminController.updateBlogComment)
  );

  router.get(
    '/newsletter/subscribers/export',
    authorizePermissions(ADMIN_PERMISSION_KEYS.READ_NEWSLETTER_SUBSCRIBERS),
    validateRequest(exportAdminNewsletterSubscribersSchema),
    asyncHandler(adminController.exportNewsletterSubscribers)
  );

  router.get(
    '/newsletter/subscribers',
    authorizePermissions(ADMIN_PERMISSION_KEYS.READ_NEWSLETTER_SUBSCRIBERS),
    validateRequest(listAdminNewsletterSubscribersSchema),
    asyncHandler(adminController.listNewsletterSubscribers)
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

  router.get(
    '/users',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_USERS),
    validateRequest(listUsersSchema),
    asyncHandler(adminController.listUsers)
  );

  router.patch(
    '/users/:id/status',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_USERS),
    validateRequest(updateUserStatusSchema),
    asyncHandler(adminController.updateUserStatus)
  );

  router.get(
    '/logistics/companies',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_LOGISTICS),
    validateRequest(listAdminLogisticsCompaniesSchema),
    asyncHandler(adminController.listLogisticsCompanies)
  );

  router.patch(
    '/logistics/companies/:id/status',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_LOGISTICS),
    validateRequest(updateAdminLogisticsCompanyStatusSchema),
    asyncHandler(adminController.updateLogisticsCompanyStatus)
  );

  router.get(
    '/logistics/riders',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_LOGISTICS),
    validateRequest(listAdminLogisticsRidersSchema),
    asyncHandler(adminController.listLogisticsRiders)
  );

  router.get(
    '/delivery-jobs',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_LOGISTICS),
    validateRequest(listAdminDeliveryJobsSchema),
    asyncHandler(adminController.listDeliveryJobs)
  );

  router.patch(
    '/delivery-jobs/:id/assign',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_LOGISTICS),
    validateRequest(assignAdminDeliveryJobSchema),
    asyncHandler(adminController.assignDeliveryJob)
  );

  router.get(
    '/orders',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_ORDERS),
    validateRequest(listAdminOrdersSchema),
    asyncHandler(adminController.listOrders)
  );

  router.post(
    '/payments/reconcile-pending',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_ORDERS),
    validateRequest(reconcilePendingPaymentsSchema),
    asyncHandler(adminController.reconcilePendingPayments)
  );

  router.patch(
    '/orders/:id/status',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_ORDERS),
    validateRequest(updateAdminOrderStatusSchema),
    asyncHandler(adminController.updateOrderStatus)
  );

  router.get(
    '/disputes',
    authorizePermissions(ADMIN_PERMISSION_KEYS.RESOLVE_DISPUTES),
    validateRequest(listAdminDisputesSchema),
    asyncHandler(adminController.listDisputes)
  );

  router.patch(
    '/disputes/:id',
    authorizePermissions(ADMIN_PERMISSION_KEYS.RESOLVE_DISPUTES),
    validateRequest(updateAdminDisputeSchema),
    asyncHandler(adminController.updateDispute)
  );

  router.get(
    '/payouts',
    authorizePermissions(ADMIN_PERMISSION_KEYS.APPROVE_PAYOUTS),
    validateRequest(listAdminPayoutsSchema),
    asyncHandler(adminController.listPayouts)
  );

  router.patch(
    '/payouts/:id',
    authorizePermissions(ADMIN_PERMISSION_KEYS.APPROVE_PAYOUTS),
    validateRequest(updateAdminPayoutStatusSchema),
    asyncHandler(adminController.updatePayoutStatus)
  );

  router.get(
    '/config',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_CONFIG),
    validateRequest(getPlatformConfigSchema),
    asyncHandler(adminController.getPlatformConfig)
  );

  router.patch(
    '/config',
    authorizePermissions(ADMIN_PERMISSION_KEYS.MANAGE_CONFIG),
    validateRequest(updatePlatformConfigSchema),
    asyncHandler(adminController.updatePlatformConfig)
  );

  router.get(
    '/audit-logs',
    authorizePermissions(ADMIN_PERMISSION_KEYS.READ_AUDIT_LOGS),
    validateRequest(listAuditLogsSchema),
    asyncHandler(adminController.listAuditLogs)
  );

  return router;
}

module.exports = {
  createAdminRouter
};
