const express = require('express');
const asyncHandler = require('../middleware/async-handler');
const { validateRequest } = require('../middleware/validate.middleware');
const {
  initializePaymentSchema,
  verifyPaymentSchema,
  verifyPaymentCallbackSchema
} = require('../validators/payments.validator');

function createPaymentsRouter({ authMiddleware, paymentsController }) {
  const router = express.Router();

  router.post(
    '/initialize',
    authMiddleware,
    validateRequest(initializePaymentSchema),
    asyncHandler(paymentsController.initializePayment)
  );

  router.get(
    '/verify/:reference',
    authMiddleware,
    validateRequest(verifyPaymentSchema),
    asyncHandler(paymentsController.verifyPayment)
  );

  router.get(
    '/callback',
    authMiddleware,
    validateRequest(verifyPaymentCallbackSchema),
    asyncHandler(paymentsController.verifyPaymentCallback)
  );

  return router;
}

module.exports = {
  createPaymentsRouter
};
