const crypto = require('crypto');
const { ERROR_CODES, PAYMENT_METHODS } = require('../config/constants');
const AppError = require('./app-error');

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

function sanitizeObject(object) {
  return Object.entries(object).reduce((result, [key, value]) => {
    if (value === null || value === undefined || value === '') {
      return result;
    }

    result[key] = value;
    return result;
  }, {});
}

function buildRequestedChannels(paymentMethod) {
  if (paymentMethod === PAYMENT_METHODS.BANK_TRANSFER) {
    return ['bank_transfer'];
  }

  if (paymentMethod === PAYMENT_METHODS.USSD) {
    return ['ussd'];
  }

  return null;
}

function sanitizePaystackTransactionData(payload = {}) {
  return sanitizeObject({
    accessCode: payload.access_code,
    amount: payload.amount !== undefined && payload.amount !== null ? Number(payload.amount) : undefined,
    authorizationUrl: payload.authorization_url,
    channel: payload.channel,
    currency: payload.currency,
    customer: payload.customer && payload.customer.email
      ? {
        email: payload.customer.email
      }
      : undefined,
    domain: payload.domain,
    gatewayResponse: payload.gateway_response,
    metadata: payload.metadata,
    paidAt: payload.paid_at,
    reference: payload.reference,
    status: payload.status
  });
}

function sanitizePaystackError(error) {
  return sanitizeObject({
    code: error.code,
    message: error.message,
    providerMessage: error.providerResponse && error.providerResponse.message
      ? error.providerResponse.message
      : undefined,
    providerStatusCode: error.providerStatusCode,
    providerStatus: error.providerResponse && typeof error.providerResponse.status === 'boolean'
      ? error.providerResponse.status
      : undefined
  });
}

function verifyWebhookSignature({ rawBody, signature, secretKey }) {
  if (!rawBody || !signature || !secretKey) {
    return false;
  }

  const computedSignature = crypto
    .createHmac('sha512', secretKey)
    .update(rawBody)
    .digest('hex');

  const expected = Buffer.from(computedSignature, 'utf8');
  const actual = Buffer.from(signature, 'utf8');

  if (expected.length !== actual.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, actual);
}

function createPaystackClient({ secretKey, fetchImpl = fetch, logger, baseUrl = PAYSTACK_BASE_URL }) {
  async function request(pathname, options = {}) {
    if (!secretKey) {
      throw new AppError('Paystack is not configured for this environment.', {
        statusCode: 500,
        code: ERROR_CODES.PAYMENT_CONFIGURATION_ERROR
      });
    }

    try {
      const response = await fetchImpl(`${baseUrl}${pathname}`, {
        method: options.method || 'GET',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json'
        },
        body: options.body ? JSON.stringify(options.body) : undefined
      });
      const responseText = await response.text();
      const payload = responseText ? JSON.parse(responseText) : {};

      if (!response.ok || payload.status === false) {
        const error = new AppError(options.errorMessage, {
          statusCode: 502,
          code: options.errorCode
        });

        error.providerStatusCode = response.status;
        error.providerResponse = payload;
        throw error;
      }

      return payload;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (logger) {
        logger.error('Paystack request failed.', {
          error: error.message,
          path: pathname
        });
      }

      throw new AppError(options.errorMessage, {
        statusCode: 502,
        code: options.errorCode
      });
    }
  }

  return {
    buildRequestedChannels,
    sanitizePaystackError,
    sanitizePaystackTransactionData,
    async initializeTransaction(payload) {
      return request('/transaction/initialize', {
        method: 'POST',
        body: {
          amount: payload.amountKobo,
          callback_url: payload.callbackUrl,
          channels: payload.channels || undefined,
          currency: 'NGN',
          email: payload.email,
          metadata: payload.metadata,
          reference: payload.reference
        },
        errorCode: ERROR_CODES.PAYMENT_INITIALIZATION_FAILED,
        errorMessage: 'Unable to initialize payment with Paystack.'
      });
    },
    async verifyTransaction(reference) {
      return request(`/transaction/verify/${encodeURIComponent(reference)}`, {
        errorCode: ERROR_CODES.PAYMENT_VERIFICATION_FAILED,
        errorMessage: 'Unable to verify payment with Paystack.'
      });
    },
    verifyWebhookSignature({ rawBody, signature }) {
      return verifyWebhookSignature({
        rawBody,
        signature,
        secretKey
      });
    }
  };
}

module.exports = {
  buildRequestedChannels,
  createPaystackClient,
  sanitizePaystackError,
  sanitizePaystackTransactionData,
  verifyWebhookSignature
};
