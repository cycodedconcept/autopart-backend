const crypto = require('crypto');
const {
  ERROR_CODES,
  ORDER_STATUSES,
  PAYMENT_STATUSES
} = require('../config/constants');
const AppError = require('../utils/app-error');

const DEFAULT_RECONCILIATION_WINDOW_MINUTES = 15;
const DEFAULT_RECONCILIATION_LIMIT = 50;
const MAX_RECONCILIATION_LIMIT = 100;
const TERMINAL_WEBHOOK_STATUSES = new Set(['processed', 'ignored']);

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : null;
}

function normalizeCallbackUrl(callbackUrl, appUrl) {
  if (typeof callbackUrl === 'string' && callbackUrl.trim()) {
    return callbackUrl.trim();
  }

  if (typeof appUrl === 'string' && appUrl.trim()) {
    return `${appUrl.trim().replace(/\/$/, '')}/payments/callback`;
  }

  return null;
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

function buildVerificationResult(payment, options = {}) {
  return {
    verified: payment.paymentStatus === PAYMENT_STATUSES.PAID,
    source: options.source || null,
    settled: options.settled !== false,
    order: mapOrderRecord(payment),
    payment: mapPaymentRecord(payment)
  };
}

function normalizeProviderStatus(status) {
  return typeof status === 'string' ? status.trim().toLowerCase() : null;
}

function extractWebhookReference(payload) {
  if (!payload || !payload.data) {
    return null;
  }

  if (payload.data.reference) {
    return String(payload.data.reference).trim();
  }

  if (payload.data.metadata && payload.data.metadata.reference) {
    return String(payload.data.metadata.reference).trim();
  }

  return null;
}

function buildWebhookEventKey({ eventPayload, rawBody }) {
  if (eventPayload && eventPayload.data && eventPayload.data.id !== undefined && eventPayload.data.id !== null) {
    return String(eventPayload.data.id);
  }

  const reference = extractWebhookReference(eventPayload);

  if (reference) {
    return reference;
  }

  return crypto
    .createHash('sha256')
    .update(Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ''), 'utf8'))
    .digest('hex');
}

function parseWebhookBody(rawBody) {
  if (!rawBody || !Buffer.isBuffer(rawBody) || !rawBody.length) {
    return null;
  }

  return JSON.parse(rawBody.toString('utf8'));
}

function buildVerificationSnapshot(verificationData, expectedAmountKobo, options = {}) {
  return {
    ...verificationData,
    amountMatchesOrder: verificationData.amount === expectedAmountKobo,
    currencyMatchesOrder: verificationData.currency === 'NGN',
    source: options.source || null,
    verifiedAt: new Date().toISOString()
  };
}

function mergePaymentRawResponse(existingRawResponse, patch) {
  const current = existingRawResponse && typeof existingRawResponse === 'object'
    ? existingRawResponse
    : {};
  const merged = {
    ...current,
    ...patch
  };

  return Object.entries(merged).reduce((result, [key, value]) => {
    if (value === undefined) {
      return result;
    }

    result[key] = value;
    return result;
  }, {});
}

function determineNextPaymentStatus(verificationData, existingPayment, options = {}) {
  const providerStatus = normalizeProviderStatus(verificationData.status);
  const isMatchingAmount = verificationData.amount === existingPayment.orderTotalKobo;
  const isMatchingCurrency = verificationData.currency === 'NGN';

  if (providerStatus === 'success') {
    if (isMatchingAmount && isMatchingCurrency) {
      return {
        paymentStatus: PAYMENT_STATUSES.PAID,
        reason: 'verified_successfully'
      };
    }

    return {
      paymentStatus: PAYMENT_STATUSES.FLAGGED,
      reason: 'verification_mismatch'
    };
  }

  if (providerStatus === 'failed' || providerStatus === 'reversed') {
    return {
      paymentStatus: PAYMENT_STATUSES.FAILED,
      reason: 'provider_reported_failure'
    };
  }

  if (providerStatus === 'abandoned') {
    return {
      paymentStatus: PAYMENT_STATUSES.CANCELLED,
      reason: 'provider_reported_abandonment'
    };
  }

  if (options.expirePending) {
    return {
      paymentStatus: PAYMENT_STATUSES.EXPIRED,
      reason: 'pending_payment_expired'
    };
  }

  return {
    paymentStatus: PAYMENT_STATUSES.PENDING,
    reason: 'payment_not_yet_successful'
  };
}

function summarizeReconciliationStatus(status, summary) {
  switch (status) {
    case PAYMENT_STATUSES.PAID:
      summary.settledCount += 1;
      break;
    case PAYMENT_STATUSES.EXPIRED:
      summary.expiredCount += 1;
      break;
    case PAYMENT_STATUSES.FLAGGED:
      summary.flaggedCount += 1;
      break;
    case PAYMENT_STATUSES.FAILED:
    case PAYMENT_STATUSES.CANCELLED:
      summary.unsuccessfulCount += 1;
      break;
    default:
      summary.pendingCount += 1;
      break;
  }
}

function createPaymentsService({ paymentsRepository, paystackClient, env = {}, logger }) {
  function log(level, message, metadata) {
    if (!logger || typeof logger[level] !== 'function') {
      return;
    }

    logger[level](message, metadata);
  }

  async function findPaymentForVerification(reference, userId) {
    const existingPayment = await paymentsRepository.findPaymentByReference(reference);

    if (!existingPayment) {
      throw new AppError('Payment reference was not found.', {
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND
      });
    }

    if (userId !== undefined && userId !== null && Number(existingPayment.buyerId) !== Number(userId)) {
      throw new AppError('Payment reference was not found.', {
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND
      });
    }

    return existingPayment;
  }

  async function reconcileVerifiedPayment(existingPayment, options = {}) {
    if (
      existingPayment.paymentStatus === PAYMENT_STATUSES.PAID
      && existingPayment.orderPaymentStatus === PAYMENT_STATUSES.PAID
    ) {
      return buildVerificationResult(existingPayment, {
        source: options.source,
        settled: false
      });
    }

    if (
      existingPayment.paymentStatus === PAYMENT_STATUSES.FLAGGED
      && existingPayment.orderPaymentStatus === PAYMENT_STATUSES.FLAGGED
    ) {
      return buildVerificationResult(existingPayment, {
        source: options.source,
        settled: false
      });
    }

    const verificationResponse = await paystackClient.verifyTransaction(existingPayment.reference);
    const verificationData = paystackClient.sanitizePaystackTransactionData(
      verificationResponse.data || {}
    );
    const verificationSnapshot = buildVerificationSnapshot(
      verificationData,
      existingPayment.orderTotalKobo,
      { source: options.source }
    );
    const nextState = determineNextPaymentStatus(verificationData, existingPayment, {
      expirePending: options.expirePending
    });
    const rawResponse = mergePaymentRawResponse(existingPayment.rawResponse, {
      verification: {
        ...verificationSnapshot,
        reconciliationReason: nextState.reason
      },
      flags: nextState.paymentStatus === PAYMENT_STATUSES.FLAGGED
        ? {
          expectedAmountKobo: existingPayment.orderTotalKobo,
          verifiedAmountKobo: verificationData.amount,
          verifiedCurrency: verificationData.currency,
          reason: nextState.reason
        }
        : existingPayment.rawResponse && existingPayment.rawResponse.flags
    });

    if (nextState.paymentStatus === PAYMENT_STATUSES.FLAGGED) {
      log('warn', 'Paystack payment verification mismatch flagged.', {
        expectedAmountKobo: existingPayment.orderTotalKobo,
        reference: existingPayment.reference,
        verifiedAmountKobo: verificationData.amount,
        verifiedCurrency: verificationData.currency
      });
    }

    const reconciledPayment = await paymentsRepository.reconcilePayment(existingPayment.reference, {
      paymentStatus: nextState.paymentStatus,
      rawResponse
    });

    return buildVerificationResult(reconciledPayment, {
      source: options.source,
      settled: true
    });
  }

  async function verifyPaymentForBuyer(payload) {
    const existingPayment = await findPaymentForVerification(payload.reference, payload.userId);

    return reconcileVerifiedPayment(existingPayment, {
      source: 'redirect'
    });
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

      if (order.paymentStatus === PAYMENT_STATUSES.FLAGGED) {
        throw new AppError('This order payment is flagged for manual review.', {
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
      const callbackUrl = normalizeCallbackUrl(payload.callbackUrl, env.APP_URL);

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
          callbackUrl,
          channels: requestedChannels,
          email: customerEmail,
          metadata: {
            order_id: order.id,
            payment_method: order.paymentMethod,
            user_id: payload.userId
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
          accessCode: sanitizedInitialization.accessCode,
          authorizationUrl: sanitizedInitialization.authorizationUrl,
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

    async verifyPayment(payload) {
      return verifyPaymentForBuyer(payload);
    },

    async verifyPaymentCallback(reference, userId) {
      return verifyPaymentForBuyer({
        reference,
        userId
      });
    },

    verifyWebhookSignature(payload) {
      return paystackClient.verifyWebhookSignature({
        rawBody: payload.rawBody,
        signature: payload.signature
      });
    },

    async processWebhook(payload) {
      const webhookPayload = parseWebhookBody(payload.rawBody);
      const eventType = webhookPayload && webhookPayload.event ? String(webhookPayload.event) : 'unknown';
      const reference = extractWebhookReference(webhookPayload);
      const eventKey = buildWebhookEventKey({
        eventPayload: webhookPayload,
        rawBody: payload.rawBody
      });

      log('info', 'Paystack webhook received.', {
        eventType,
        reference,
        signatureValid: true,
        sourceIp: payload.requestIp || null
      });

      const webhookEvent = await paymentsRepository.recordWebhookEvent({
        eventKey,
        eventType,
        payload: webhookPayload,
        provider: 'paystack',
        reference
      });

      if (TERMINAL_WEBHOOK_STATUSES.has(webhookEvent.processingStatus)) {
        log('info', 'Paystack webhook duplicate ignored.', {
          eventType,
          reference,
          webhookEventId: webhookEvent.id
        });

        return {
          acknowledged: true,
          duplicate: true,
          event: eventType,
          handled: false
        };
      }

      if (eventType !== 'charge.success') {
        await paymentsRepository.updateWebhookEventStatus(webhookEvent.id, {
          processingNotes: `Unhandled event type: ${eventType}`,
          processingStatus: 'ignored'
        });
        log('info', 'Paystack webhook ignored.', {
          eventType,
          reference,
          webhookEventId: webhookEvent.id
        });

        return {
          acknowledged: true,
          event: eventType,
          handled: false
        };
      }

      if (!reference) {
        await paymentsRepository.updateWebhookEventStatus(webhookEvent.id, {
          processingNotes: 'Webhook payload did not include a transaction reference.',
          processingStatus: 'ignored'
        });
        log('warn', 'Paystack webhook ignored because no reference was present.', {
          eventType,
          webhookEventId: webhookEvent.id
        });

        return {
          acknowledged: true,
          event: eventType,
          handled: false
        };
      }

      try {
        const existingPayment = await paymentsRepository.findPaymentByReference(reference);

        if (!existingPayment) {
          await paymentsRepository.updateWebhookEventStatus(webhookEvent.id, {
            processingNotes: 'No local payment matched the Paystack reference.',
            processingStatus: 'ignored'
          });
          log('warn', 'Paystack webhook ignored because no local payment matched the reference.', {
            eventType,
            reference,
            webhookEventId: webhookEvent.id
          });

          return {
            acknowledged: true,
            event: eventType,
            handled: false
          };
        }

        const result = await reconcileVerifiedPayment(existingPayment, {
          source: 'webhook'
        });

        await paymentsRepository.updateWebhookEventStatus(webhookEvent.id, {
          processingNotes: `Payment ${result.payment.status} via webhook verification.`,
          processingStatus: 'processed'
        });
        log('info', 'Paystack webhook processed.', {
          eventType,
          orderId: result.order.id,
          paymentStatus: result.payment.status,
          reference,
          webhookEventId: webhookEvent.id
        });

        return {
          ...result,
          acknowledged: true,
          event: eventType,
          handled: true
        };
      } catch (error) {
        await paymentsRepository.updateWebhookEventStatus(webhookEvent.id, {
          processingNotes: error.message,
          processingStatus: 'failed'
        });
        throw error;
      }
    },

    async reconcilePendingPayments(payload = {}) {
      const olderThanMinutes = Math.max(
        1,
        Number(payload.olderThanMinutes || DEFAULT_RECONCILIATION_WINDOW_MINUTES)
      );
      const limit = Math.min(
        MAX_RECONCILIATION_LIMIT,
        Math.max(1, Number(payload.limit || DEFAULT_RECONCILIATION_LIMIT))
      );
      const cutoffDate = new Date(Date.now() - (olderThanMinutes * 60 * 1000));
      const pendingPayments = await paymentsRepository.listPendingPaymentsForReconciliation({
        before: cutoffDate,
        limit
      });
      const summary = {
        checkedCount: pendingPayments.length,
        errors: [],
        expiredCount: 0,
        flaggedCount: 0,
        olderThanMinutes,
        payments: [],
        pendingCount: 0,
        settledCount: 0,
        unsuccessfulCount: 0
      };

      for (const payment of pendingPayments) {
        try {
          const result = await reconcileVerifiedPayment(payment, {
            source: 'reconciliation',
            expirePending: true
          });

          summarizeReconciliationStatus(result.payment.status, summary);
          summary.payments.push({
            orderId: result.order.id,
            reference: result.payment.reference,
            status: result.payment.status
          });
        } catch (error) {
          summary.errors.push({
            message: error.message,
            reference: payment.reference
          });
          log('error', 'Pending Paystack payment reconciliation failed.', {
            error: error.message,
            reference: payment.reference
          });
        }
      }

      return summary;
    }
  };
}

module.exports = {
  createPaymentsService
};
