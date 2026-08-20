const { sendSuccess } = require('../utils/responses');

function normalizeSignature(signatureHeader) {
  if (Array.isArray(signatureHeader)) {
    return signatureHeader[0] || null;
  }

  return typeof signatureHeader === 'string' ? signatureHeader : null;
}

function createPaymentsController({ paymentsService, logger }) {
  async function sendVerificationResult(res, payload) {
    const result = await paymentsService.verifyPayment({
      reference: payload.reference,
      userId: payload.userId
    });

    return sendSuccess(res, {
      data: result,
      message: result.verified
        ? 'Payment verified successfully.'
        : 'Payment verification completed without a successful charge.'
    });
  }

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

    async verifyPayment(req, res) {
      return sendVerificationResult(res, {
        reference: req.params.reference,
        userId: req.user.id
      });
    },

    async verifyPaymentCallback(req, res) {
      return sendVerificationResult(res, {
        reference: req.query.reference || req.query.trxref,
        userId: req.user.id
      });
    },

    handlePaystackWebhook(req, res) {
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      const signature = normalizeSignature(req.headers['x-paystack-signature']);
      const isValidSignature = paymentsService.verifyWebhookSignature({
        rawBody,
        signature
      });

      if (!isValidSignature) {
        if (logger) {
          logger.warn('Paystack webhook signature rejected.', {
            signatureValid: false,
            sourceIp: req.ip
          });
        }

        return res.sendStatus(401);
      }

      res.sendStatus(200);

      void paymentsService.processWebhook({
        rawBody,
        requestIp: req.ip
      }).catch((error) => {
        if (logger) {
          logger.error('Paystack webhook processing failed.', {
            error: error.message,
            sourceIp: req.ip
          });
        }
      });

      return undefined;
    }
  };
}

module.exports = {
  createPaymentsController
};
