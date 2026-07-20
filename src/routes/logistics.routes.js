const express = require('express');
const { USER_ROLES } = require('../config/constants');
const asyncHandler = require('../middleware/async-handler');
const { authorizeRoles } = require('../middleware/role.middleware');
const { createAuthRateLimiter } = require('../middleware/rate-limit.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const {
  createLogisticsPayoutSchema,
  createRiderSchema,
  getLogisticsEarningsSchema,
  getLogisticsMeSchema,
  getLogisticsRiderSchema,
  listDeliveryZonesSchema,
  listLogisticsJobsSchema,
  listLogisticsRidersSchema,
  logisticsLoginSchema,
  logisticsRegisterSchema,
  updateLogisticsRiderSchema
} = require('../validators/logistics.validator');

function createLogisticsRouter({ logisticsCompanyAuthMiddleware, logisticsController }) {
  const router = express.Router();
  const authRateLimiter = createAuthRateLimiter();

  router.post(
    '/register',
    authRateLimiter,
    validateRequest(logisticsRegisterSchema),
    asyncHandler(logisticsController.registerCompany)
  );

  router.post(
    '/login',
    authRateLimiter,
    validateRequest(logisticsLoginSchema),
    asyncHandler(logisticsController.loginCompany)
  );

  router.use(logisticsCompanyAuthMiddleware);
  router.use(authorizeRoles(USER_ROLES.LOGISTICS_COMPANY));

  router.get(
    '/me',
    validateRequest(getLogisticsMeSchema),
    asyncHandler(logisticsController.getMe)
  );

  router.get(
    '/zones',
    validateRequest(listDeliveryZonesSchema),
    asyncHandler(logisticsController.listZones)
  );

  router.post(
    '/riders',
    validateRequest(createRiderSchema),
    asyncHandler(logisticsController.createRider)
  );

  router.get(
    '/riders',
    validateRequest(listLogisticsRidersSchema),
    asyncHandler(logisticsController.listRiders)
  );

  router.get(
    '/riders/:id',
    validateRequest(getLogisticsRiderSchema),
    asyncHandler(logisticsController.getRider)
  );

  router.patch(
    '/riders/:id',
    validateRequest(updateLogisticsRiderSchema),
    asyncHandler(logisticsController.updateRider)
  );

  router.get(
    '/jobs',
    validateRequest(listLogisticsJobsSchema),
    asyncHandler(logisticsController.listJobs)
  );

  router.get(
    '/earnings',
    validateRequest(getLogisticsEarningsSchema),
    asyncHandler(logisticsController.getEarnings)
  );

  router.post(
    '/payouts',
    validateRequest(createLogisticsPayoutSchema),
    asyncHandler(logisticsController.createPayoutRequest)
  );

  return router;
}

module.exports = {
  createLogisticsRouter
};
