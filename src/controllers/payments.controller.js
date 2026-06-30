const { sendSuccess } = require('../utils/responses');

function createPaymentsController({ paymentsService }) {
  return {
    async initializePayment(req, res) {
      const payment = await paymentsService.initializePayment({
        userId: req.user.id,
        orderId: req.body.orderId,
        email: req.body.email || req.user.email,
        callbackUrl: req.body.callbackUrl
      });

      return sendSuccess(res, {
        data: payment,
        message: 'Payment initialized successfully.'
      });
    },

    async verifyPaymentCallback(req, res) {
      const reference = req.query.reference || req.query.trxref;
      const result = await paymentsService.verifyPaymentCallback(reference);

      return sendSuccess(res, {
        data: result,
        message: result.verified
          ? 'Payment verified successfully.'
          : 'Payment verification completed without a successful charge.'
      });
    },

    async handleWebhook(req, res) {
      const result = await paymentsService.handleWebhook({
        event: req.body.event,
        data: req.body.data,
        rawBody: req.rawBody,
        signature: req.headers['x-paystack-signature']
      });

      return sendSuccess(res, {
        data: result,
        message: result.handled
          ? 'Webhook processed successfully.'
          : 'Webhook acknowledged.'
      });
    }
  };
}

module.exports = {
  createPaymentsController
};
