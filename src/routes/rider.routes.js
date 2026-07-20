const express = require('express');
const { USER_ROLES } = require('../config/constants');
const asyncHandler = require('../middleware/async-handler');
const { authorizeRoles } = require('../middleware/role.middleware');
const { createAuthRateLimiter } = require('../middleware/rate-limit.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const {
  getDeliveryJobSchema,
  getRiderMeSchema,
  listLogisticsJobsSchema,
  riderLoginSchema,
  updateDeliveryJobStatusSchema,
  updateRiderAvailabilitySchema
} = require('../validators/logistics.validator');

function createRiderRouter({ riderAuthMiddleware, riderController }) {
  const router = express.Router();
  const authRateLimiter = createAuthRateLimiter();

  router.post(
    '/login',
    authRateLimiter,
    validateRequest(riderLoginSchema),
    asyncHandler(riderController.login)
  );

  router.use(riderAuthMiddleware);
  router.use(authorizeRoles(USER_ROLES.RIDER));

  router.get(
    '/me',
    validateRequest(getRiderMeSchema),
    asyncHandler(riderController.getMe)
  );

  router.patch(
    '/availability',
    validateRequest(updateRiderAvailabilitySchema),
    asyncHandler(riderController.updateAvailability)
  );

  router.get(
    '/jobs',
    validateRequest(listLogisticsJobsSchema),
    asyncHandler(riderController.listJobs)
  );

  router.get(
    '/jobs/:id',
    validateRequest(getDeliveryJobSchema),
    asyncHandler(riderController.getJobById)
  );

  router.patch(
    '/jobs/:id/status',
    validateRequest(updateDeliveryJobStatusSchema),
    asyncHandler(riderController.updateJobStatus)
  );

  return router;
}

module.exports = {
  createRiderRouter
};
