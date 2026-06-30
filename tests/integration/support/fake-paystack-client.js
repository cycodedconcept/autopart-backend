const {
  buildRequestedChannels,
  sanitizePaystackError,
  sanitizePaystackTransactionData
} = require('../../../src/utils/paystack');

function createFakePaystackClient() {
  const transactions = new Map();

  return {
    buildRequestedChannels,
    sanitizePaystackError,
    sanitizePaystackTransactionData,
    async initializeTransaction(payload) {
      transactions.set(payload.reference, {
        amount: payload.amountKobo,
        channel: payload.channels && payload.channels.length ? payload.channels[0] : 'card',
        currency: 'NGN',
        customer: {
          email: payload.email
        },
        gateway_response: 'Successful',
        metadata: payload.metadata,
        paid_at: '2026-06-30T12:00:00.000Z',
        reference: payload.reference,
        status: 'success'
      });

      return {
        status: true,
        message: 'Authorization URL created',
        data: {
          access_code: `ACCESS_${payload.reference}`,
          authorization_url: `https://checkout.paystack.com/${payload.reference}`,
          reference: payload.reference
        }
      };
    },
    async verifyTransaction(reference) {
      const transaction = transactions.get(reference);

      if (!transaction) {
        const error = new Error('Transaction not found');
        error.code = 'PAYMENT_VERIFICATION_FAILED';
        throw error;
      }

      return {
        status: true,
        message: 'Verification successful',
        data: transaction
      };
    },
    verifyWebhookSignature({ signature }) {
      return signature === 'valid-signature';
    }
  };
}

module.exports = {
  createFakePaystackClient
};
