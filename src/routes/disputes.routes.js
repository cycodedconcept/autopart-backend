const express = require('express');
const asyncHandler = require('../middleware/async-handler');
const { authorizeRoles } = require('../middleware/role.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const { listDisputesSchema, detailDisputeSchema, respondDisputeSchema } = require('../validators/disputes.validator');

function createDisputesRouter({ authMiddleware, disputesController, uploadAttachments, uploadCleanup }) {
  const router = express.Router();
  router.use(authMiddleware, authorizeRoles('buyer'));
  router.get('/', validateRequest(listDisputesSchema), asyncHandler(disputesController.listDisputes));
  router.get('/:id', validateRequest(detailDisputeSchema), asyncHandler(disputesController.getDispute));
  router.post('/:id/respond', uploadAttachments, validateRequest(respondDisputeSchema),
    asyncHandler(disputesController.respond), uploadCleanup);
  return router;
}

module.exports = { createDisputesRouter };
