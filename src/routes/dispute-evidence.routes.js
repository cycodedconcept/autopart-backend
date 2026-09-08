const express = require('express');
const asyncHandler = require('../middleware/async-handler');
const { validateRequest } = require('../middleware/validate.middleware');
const { evidenceDisputeSchema } = require('../validators/disputes.validator');

function createDisputeEvidenceRouter({ disputeEvidenceAuthMiddleware, disputeEvidenceController }) {
  const router = express.Router();
  router.get('/:filename', disputeEvidenceAuthMiddleware, validateRequest(evidenceDisputeSchema),
    asyncHandler(disputeEvidenceController.getEvidence));
  return router;
}

module.exports = { createDisputeEvidenceRouter };
