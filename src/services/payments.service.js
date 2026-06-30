const crypto = require('crypto');
const {
  ERROR_CODES,
  ORDER_STATUSES,
  PAYMENT_STATUSES
} = require('../config/constants');
const AppError = require('../utils/app-error');

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : null;
}

function buildPaymentReference(orderId) {
  return `APT-${orderId}-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function mapPaymentRecord(payment) {
  return {
    amountKobo: payment.amountKobo,
    provider: payment.provider,
    reference: payment.reference,
    status: payment.paymentStatus
  };
}

function mapOrderRecord(payment) {
  return {
    id: payment.orderId,
    paymentMethod: payment.orderPaymentMethod,
    paymentStatus: payment.orderPaymentStatus,
    status: payment.orderStatus,
    totalKobo: payment.orderTotalKobo
  };
}

function createPaymentsService({ paymentsRepository, paystackClient }) {
  async function verifyAndReconcilePayment(existingPayment) {
    const verificationResponse = await paystackClient.verifyTransaction(existingPayment.reference);
    const verificationData = paystackClient.sanitizePaystackTransactionData(
      verificationResponse.data || {}
    );
    const isSuccessfulCharge = verificationData.status === 'success';
    const isMatchingAmount = verificationData.amount === existingPayment.orderTotalKobo;
    const isMatchingCurrency = verificationData.currency === 'NGN';
    const nextPaymentStatus = isSuccessfulCharge && isMatchingAmount && isMatchingCurrency
      ? PAYMENT_STATUSES.PAID
      : PAYMENT_STATUSES.FAILED;
    const rawResponse = {
      initialize: existingPayment.rawResponse && existingPayment.rawResponse.initialize
        ? existingPayment.rawResponse.initialize
        : null,
      verification: {
        ...verificationData,
        amountMatchesOrder: isMatchingAmount,
        currencyMatchesOrder: isMatchingCurrency
      }
    };

    const reconciledPayment = await paymentsRepository.reconcilePayment(existingPayment.reference, {
      paymentStatus: nextPaymentStatus,
      rawResponse
    });

    return {
      verified: nextPaymentStatus === PAYMENT_STATUSES.PAID,
      order: mapOrderRecord(reconciledPayment),
      payment: mapPaymentRecord(reconciledPayment)
    };
  }

  return {
    async initializePayment(payload) {
      const order = await paymentsRepository.findOrderForBuyer(payload.orderId, payload.userId);

      if (!order) {
        throw new AppError('Order was not found.', {
          statusCode: 404,
          code: ERROR_CODES.NOT_FOUND
        });
      }

      if (order.status !== ORDER_STATUSES.PENDING_PAYMENT) {
        throw new AppError('Only pending-payment orders can be initialized for payment.', {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT
        });
      }

      if (order.paymentStatus === PAYMENT_STATUSES.PAID) {
        throw new AppError('This order has already been paid for.', {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT
        });
      }

      const customerEmail = normalizeEmail(payload.email);

      if (!customerEmail) {
        throw new AppError('An email address is required to initialize payment.', {
          statusCode: 422,
          code: ERROR_CODES.VALIDATION_ERROR
        });
      }

      const requestedChannels = paystackClient.buildRequestedChannels(order.paymentMethod);
      const reference = buildPaymentReference(order.id);

      await paymentsRepository.createPaymentAttempt({
        orderId: order.id,
        provider: 'paystack',
        reference,
        amountKobo: order.totalKobo,
        status: PAYMENT_STATUSES.PENDING,
        rawResponse: null
      });

      try {
        const initializationResponse = await paystackClient.initializeTransaction({
          amountKobo: order.totalKobo,
          callbackUrl: payload.callbackUrl || null,
          channels: requestedChannels,
          email: customerEmail,
          metadata: {
            buyerId: payload.userId,
            orderId: order.id,
            paymentMethod: order.paymentMethod
          },
          reference
        });
        const sanitizedInitialization = paystackClient.sanitizePaystackTransactionData(
          initializationResponse.data || {}
        );
        const updatedPayment = await paymentsRepository.updatePaymentAttempt(reference, {
          status: PAYMENT_STATUSES.PENDING,
          rawResponse: {
            initialize: {
              ...sanitizedInitialization,
              requestedChannels
            }
          }
        });

        return {
          authorizationUrl: sanitizedInitialization.authorizationUrl,
          accessCode: sanitizedInitialization.accessCode,
          channels: requestedChannels,
          order: mapOrderRecord(updatedPayment),
          payment: mapPaymentRecord(updatedPayment)
        };
      } catch (error) {
        await paymentsRepository.updatePaymentAttempt(reference, {
          status: PAYMENT_STATUSES.FAILED,
          rawResponse: {
            initializeError: paystackClient.sanitizePaystackError(error)
          }
        });

        throw error;
      }
    },

    async verifyPaymentCallback(reference) {
      const existingPayment = await paymentsRepository.findPaymentByReference(reference);

      if (!existingPayment) {
        throw new AppError('Payment reference was not found.', {
          statusCode: 404,
          code: ERROR_CODES.NOT_FOUND
        });
      }

      return verifyAndReconcilePayment(existingPayment);
    },

    async handleWebhook(payload) {
      const isValidSignature = paystackClient.verifyWebhookSignature({
        rawBody: payload.rawBody,
        signature: payload.signature
      });

      if (!isValidSignature) {
        throw new AppError('Webhook signature is invalid.', {
          statusCode: 401,
          code: ERROR_CODES.UNAUTHORIZED
        });
      }

      if (payload.event !== 'charge.success') {
        return {
          acknowledged: true,
          event: payload.event,
          handled: false
        };
      }

      const reference = payload.data && payload.data.reference ? payload.data.reference : null;

      if (!reference) {
        return {
          acknowledged: true,
          event: payload.event,
          handled: false
        };
      }

      const existingPayment = await paymentsRepository.findPaymentByReference(reference);

      if (!existingPayment) {
        return {
          acknowledged: true,
          event: payload.event,
          handled: false
        };
      }

      const verificationResult = await verifyAndReconcilePayment(existingPayment);

      return {
        ...verificationResult,
        acknowledged: true,
        event: payload.event,
        handled: true
      };
    }
  };
}

module.exports = {
  createPaymentsService
};
