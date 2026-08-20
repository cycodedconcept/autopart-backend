require('../../setup/jest');

const { createPaymentsService } = require('../../../src/services/payments.service');

describe('payments service', () => {
  let paymentsRepository;
  let paystackClient;
  let paymentsService;

  beforeEach(() => {
    paymentsRepository = {
      findOrderForBuyer: jest.fn(),
      createPaymentAttempt: jest.fn(),
      updatePaymentAttempt: jest.fn(),
      findPaymentByReference: jest.fn(),
      reconcilePayment: jest.fn(),
      recordWebhookEvent: jest.fn(),
      updateWebhookEventStatus: jest.fn(),
      listPendingPaymentsForReconciliation: jest.fn()
    };

    paystackClient = {
      buildRequestedChannels: jest.fn(),
      sanitizePaystackError: jest.fn(),
      sanitizePaystackTransactionData: jest.fn(),
      initializeTransaction: jest.fn(),
      verifyTransaction: jest.fn(),
      verifyWebhookSignature: jest.fn()
    };

    paymentsService = createPaymentsService({
      paymentsRepository,
      paystackClient,
      env: {
        APP_URL: 'https://autoparts.example.com'
      }
    });
  });

  describe('initializePayment', () => {
    it('initializes a payment attempt with callback fallback and Paystack metadata', async () => {
      paymentsRepository.findOrderForBuyer.mockResolvedValue({
        id: 101,
        status: 'pending_payment',
        paymentMethod: 'bank_transfer',
        totalKobo: 3700000,
        paymentStatus: 'pending'
      });
      paymentsRepository.createPaymentAttempt.mockResolvedValue({});
      paystackClient.buildRequestedChannels.mockReturnValue(['bank_transfer']);
      paystackClient.initializeTransaction.mockResolvedValue({
        data: {
          access_code: 'ACCESS_123',
          authorization_url: 'https://checkout.paystack.com/abc123',
          reference: 'APT-101-REF'
        }
      });
      paystackClient.sanitizePaystackTransactionData.mockReturnValue({
        accessCode: 'ACCESS_123',
        authorizationUrl: 'https://checkout.paystack.com/abc123',
        reference: 'APT-101-REF'
      });
      paymentsRepository.updatePaymentAttempt.mockResolvedValue({
        orderId: 101,
        orderStatus: 'pending_payment',
        orderPaymentMethod: 'bank_transfer',
        orderPaymentStatus: 'pending',
        orderTotalKobo: 3700000,
        provider: 'paystack',
        reference: 'APT-101-REF',
        amountKobo: 3700000,
        paymentStatus: 'pending'
      });

      const result = await paymentsService.initializePayment({
        userId: 5,
        orderId: 101,
        email: 'buyer@example.com'
      });

      expect(paystackClient.initializeTransaction).toHaveBeenCalledWith(expect.objectContaining({
        amountKobo: 3700000,
        callbackUrl: 'https://autoparts.example.com/payments/callback',
        channels: ['bank_transfer'],
        email: 'buyer@example.com',
        metadata: {
          order_id: 101,
          payment_method: 'bank_transfer',
          user_id: 5
        }
      }));
      expect(result).toEqual({
        accessCode: 'ACCESS_123',
        authorizationUrl: 'https://checkout.paystack.com/abc123',
        channels: ['bank_transfer'],
        order: {
          id: 101,
          paymentMethod: 'bank_transfer',
          paymentStatus: 'pending',
          status: 'pending_payment',
          totalKobo: 3700000
        },
        payment: {
          amountKobo: 3700000,
          provider: 'paystack',
          reference: 'APT-101-REF',
          status: 'pending'
        }
      });
    });

    it('rejects initialization for flagged orders', async () => {
      paymentsRepository.findOrderForBuyer.mockResolvedValue({
        id: 101,
        status: 'pending_payment',
        paymentMethod: 'paystack',
        totalKobo: 3700000,
        paymentStatus: 'flagged'
      });

      await expect(paymentsService.initializePayment({
        userId: 5,
        orderId: 101,
        email: 'buyer@example.com'
      })).rejects.toMatchObject({
        statusCode: 409,
        code: 'CONFLICT'
      });
    });
  });

  describe('verifyPayment', () => {
    it('verifies a buyer-owned payment reference and confirms the order', async () => {
      paymentsRepository.findPaymentByReference.mockResolvedValue({
        buyerId: 5,
        orderId: 101,
        orderStatus: 'pending_payment',
        orderPaymentMethod: 'paystack',
        orderPaymentStatus: 'pending',
        orderTotalKobo: 3700000,
        provider: 'paystack',
        reference: 'APT-101-REF',
        amountKobo: 3700000,
        paymentStatus: 'pending',
        rawResponse: {
          initialize: {
            reference: 'APT-101-REF'
          }
        }
      });
      paystackClient.verifyTransaction.mockResolvedValue({
        data: {
          amount: 3700000,
          currency: 'NGN',
          reference: 'APT-101-REF',
          status: 'success'
        }
      });
      paystackClient.sanitizePaystackTransactionData.mockReturnValue({
        amount: 3700000,
        currency: 'NGN',
        reference: 'APT-101-REF',
        status: 'success'
      });
      paymentsRepository.reconcilePayment.mockResolvedValue({
        orderId: 101,
        orderStatus: 'confirmed',
        orderPaymentMethod: 'paystack',
        orderPaymentStatus: 'paid',
        orderTotalKobo: 3700000,
        provider: 'paystack',
        reference: 'APT-101-REF',
        amountKobo: 3700000,
        paymentStatus: 'paid'
      });

      const result = await paymentsService.verifyPayment({
        reference: 'APT-101-REF',
        userId: 5
      });

      expect(paystackClient.verifyTransaction).toHaveBeenCalledWith('APT-101-REF');
      expect(paymentsRepository.reconcilePayment).toHaveBeenCalledWith('APT-101-REF', expect.objectContaining({
        paymentStatus: 'paid'
      }));
      expect(result).toEqual({
        verified: true,
        source: 'redirect',
        settled: true,
        order: {
          id: 101,
          paymentMethod: 'paystack',
          paymentStatus: 'paid',
          status: 'confirmed',
          totalKobo: 3700000
        },
        payment: {
          amountKobo: 3700000,
          provider: 'paystack',
          reference: 'APT-101-REF',
          status: 'paid'
        }
      });
    });
  });

  describe('processWebhook', () => {
    it('acknowledges unsupported webhook events without reconciling payments', async () => {
      paymentsRepository.recordWebhookEvent.mockResolvedValue({
        id: 88,
        processingStatus: 'received'
      });

      const result = await paymentsService.processWebhook({
        rawBody: Buffer.from(JSON.stringify({
          event: 'transfer.success',
          data: {
            id: 90
          }
        }), 'utf8'),
        requestIp: '127.0.0.1'
      });

      expect(result).toEqual({
        acknowledged: true,
        event: 'transfer.success',
        handled: false
      });
      expect(paymentsRepository.updateWebhookEventStatus).toHaveBeenCalledWith(88, expect.objectContaining({
        processingStatus: 'ignored'
      }));
      expect(paymentsRepository.findPaymentByReference).not.toHaveBeenCalled();
    });
  });

  describe('reconcilePendingPayments', () => {
    it('expires stale unresolved payments during reconciliation', async () => {
      paymentsRepository.listPendingPaymentsForReconciliation.mockResolvedValue([
        {
          buyerId: 5,
          orderId: 101,
          orderStatus: 'pending_payment',
          orderPaymentMethod: 'paystack',
          orderPaymentStatus: 'pending',
          orderTotalKobo: 3700000,
          provider: 'paystack',
          reference: 'APT-101-REF',
          amountKobo: 3700000,
          paymentStatus: 'pending',
          rawResponse: {
            initialize: {
              reference: 'APT-101-REF'
            }
          }
        }
      ]);
      paystackClient.verifyTransaction.mockResolvedValue({
        data: {
          amount: 3700000,
          currency: 'NGN',
          reference: 'APT-101-REF',
          status: 'pending'
        }
      });
      paystackClient.sanitizePaystackTransactionData.mockReturnValue({
        amount: 3700000,
        currency: 'NGN',
        reference: 'APT-101-REF',
        status: 'pending'
      });
      paymentsRepository.reconcilePayment.mockResolvedValue({
        orderId: 101,
        orderStatus: 'pending_payment',
        orderPaymentMethod: 'paystack',
        orderPaymentStatus: 'expired',
        orderTotalKobo: 3700000,
        provider: 'paystack',
        reference: 'APT-101-REF',
        amountKobo: 3700000,
        paymentStatus: 'expired'
      });

      const result = await paymentsService.reconcilePendingPayments({
        olderThanMinutes: 20,
        limit: 10
      });

      expect(result.checkedCount).toBe(1);
      expect(result.expiredCount).toBe(1);
      expect(result.settledCount).toBe(0);
      expect(result.payments).toEqual([
        {
          orderId: 101,
          reference: 'APT-101-REF',
          status: 'expired'
        }
      ]);
    });
  });
});
