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
      reconcilePayment: jest.fn()
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
      paystackClient
    });
  });

  describe('initializePayment', () => {
    it('initializes a payment attempt for a pending order', async () => {
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
        email: 'buyer@example.com',
        callbackUrl: 'https://example.com/payments/callback'
      });

      expect(paymentsRepository.findOrderForBuyer).toHaveBeenCalledWith(101, 5);
      expect(paystackClient.buildRequestedChannels).toHaveBeenCalledWith('bank_transfer');
      expect(paystackClient.initializeTransaction).toHaveBeenCalledWith(expect.objectContaining({
        amountKobo: 3700000,
        callbackUrl: 'https://example.com/payments/callback',
        channels: ['bank_transfer'],
        email: 'buyer@example.com',
        metadata: {
          buyerId: 5,
          orderId: 101,
          paymentMethod: 'bank_transfer'
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

    it('rejects payment initialization when no email is available', async () => {
      paymentsRepository.findOrderForBuyer.mockResolvedValue({
        id: 101,
        status: 'pending_payment',
        paymentMethod: 'paystack',
        totalKobo: 3700000,
        paymentStatus: 'pending'
      });

      await expect(paymentsService.initializePayment({
        userId: 5,
        orderId: 101,
        email: null
      })).rejects.toMatchObject({
        statusCode: 422,
        code: 'VALIDATION_ERROR'
      });
    });
  });

  describe('verifyPaymentCallback', () => {
    it('verifies a local payment reference and confirms the order', async () => {
      paymentsRepository.findPaymentByReference.mockResolvedValue({
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

      const result = await paymentsService.verifyPaymentCallback('APT-101-REF');

      expect(paystackClient.verifyTransaction).toHaveBeenCalledWith('APT-101-REF');
      expect(paymentsRepository.reconcilePayment).toHaveBeenCalledWith('APT-101-REF', expect.objectContaining({
        paymentStatus: 'paid'
      }));
      expect(result).toEqual({
        verified: true,
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

  describe('handleWebhook', () => {
    it('rejects invalid webhook signatures', async () => {
      paystackClient.verifyWebhookSignature.mockReturnValue(false);

      await expect(paymentsService.handleWebhook({
        event: 'charge.success',
        data: {
          reference: 'APT-101-REF'
        },
        rawBody: '{"event":"charge.success"}',
        signature: 'bad-signature'
      })).rejects.toMatchObject({
        statusCode: 401,
        code: 'UNAUTHORIZED'
      });
    });

    it('acknowledges unsupported webhook events without reconciling payments', async () => {
      paystackClient.verifyWebhookSignature.mockReturnValue(true);

      const result = await paymentsService.handleWebhook({
        event: 'transfer.success',
        data: {},
        rawBody: '{"event":"transfer.success"}',
        signature: 'valid-signature'
      });

      expect(result).toEqual({
        acknowledged: true,
        event: 'transfer.success',
        handled: false
      });
      expect(paymentsRepository.findPaymentByReference).not.toHaveBeenCalled();
    });
  });
});
