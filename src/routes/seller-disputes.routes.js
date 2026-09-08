const express = require('express');
const asyncHandler = require('../middleware/async-handler');
const { authorizeRoles } = require('../middleware/role.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const { listDisputesSchema, detailDisputeSchema, respondDisputeSchema } = require('../validators/disputes.validator');

function createSellerDisputesRouter({ authMiddleware, sellerDisputesController, uploadEvidence, uploadCleanup }) {
  const router = express.Router();
  router.use(authMiddleware, authorizeRoles('seller'));
  router.get('/', validateRequest(listDisputesSchema), asyncHandler(sellerDisputesController.listDisputes));
  router.get('/:id', validateRequest(detailDisputeSchema), asyncHandler(sellerDisputesController.getDispute));
  router.post('/:id/respond', uploadEvidence, validateRequest(respondDisputeSchema),
    asyncHandler(sellerDisputesController.respond), uploadCleanup);
  return router;
}

module.exports = { createSellerDisputesRouter };
