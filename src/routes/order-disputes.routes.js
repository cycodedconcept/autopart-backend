const express = require('express');
const asyncHandler = require('../middleware/async-handler');
const { authorizeRoles } = require('../middleware/role.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const { createDisputeSchema, orderDisputesSchema } = require('../validators/disputes.validator');

function createOrderDisputesRouter({ authMiddleware, disputesController, uploadEvidence, uploadCleanup }) {
  const router = express.Router();
  const buyer = authorizeRoles('buyer');
  router.post('/:orderId/disputes', authMiddleware, buyer, uploadEvidence,
    validateRequest(createDisputeSchema), asyncHandler(disputesController.createDispute), uploadCleanup);
  router.get('/:orderId/disputes', authMiddleware, buyer,
    validateRequest(orderDisputesSchema), asyncHandler(disputesController.listDisputes));
  return router;
}

module.exports = { createOrderDisputesRouter };
