const express = require('express');
const asyncHandler = require('../middleware/async-handler');
const { validateRequest } = require('../middleware/validate.middleware');
const {
  initializePaymentSchema,
  paystackWebhookSchema,
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
    '/callback',
    validateRequest(verifyPaymentCallbackSchema),
    asyncHandler(paymentsController.verifyPaymentCallback)
  );

  router.post(
    '/webhook',
    validateRequest(paystackWebhookSchema),
    asyncHandler(paymentsController.handleWebhook)
  );

  return router;
}

module.exports = {
  createPaymentsRouter
};
