require('../../setup/jest');

const { createSellerFinanceService } = require('../../../src/services/seller-finance.service');

describe('seller finance service', () => {
  let platformConfigRepository;
  let sellerFinanceRepository;
  let sellersRepository;
  let sellerFinanceService;

  beforeEach(() => {
    platformConfigRepository = {
      findPlatformConfigByKey: jest.fn()
    };
    sellerFinanceRepository = {
      createSellerPayoutRequest: jest.fn(),
      getSellerSalesSummary: jest.fn(),
      listSellerPayouts: jest.fn(),
      summarizeSellerPayoutBalances: jest.fn()
    };

    sellersRepository = {
      findByUserId: jest.fn()
    };

    sellerFinanceService = createSellerFinanceService({
      env: {
        PLATFORM_COMMISSION_RATE_PERCENT: 10
      },
      platformConfigRepository,
      sellerFinanceRepository,
      sellersRepository
    });
  });

  describe('getSellerSalesSummary', () => {
    it('returns a seller sales summary for the requested period', async () => {
      sellersRepository.findByUserId.mockResolvedValue({
        sellerProfile: {
          id: 71
        }
      });
      sellerFinanceRepository.getSellerSalesSummary.mockResolvedValue({
        totalOrders: 2,
        totalItems: 4,
        grossSalesKobo: 12500000,
        commissionKobo: 1500000,
        netSalesKobo: 11000000
      });
      sellerFinanceRepository.summarizeSellerPayoutBalances.mockResolvedValue({
        pendingKobo: 8100000,
        requestedKobo: 0,
        approvedKobo: 0,
        paidKobo: 0
      });
      platformConfigRepository.findPlatformConfigByKey.mockResolvedValue({
        key: 'commission_rate_default',
        value: 12
      });

      const result = await sellerFinanceService.getSellerSalesSummary({
        userId: 11,
        query: {
          dateFrom: '2026-07-01',
          dateTo: '2026-07-07'
        }
      });

      expect(sellersRepository.findByUserId).toHaveBeenCalledWith(11);
      expect(sellerFinanceRepository.getSellerSalesSummary).toHaveBeenCalledWith({
        sellerId: 71,
        commissionRatePercent: 12,
        dateFrom: '2026-07-01',
        dateTo: '2026-07-07'
      });
      expect(sellerFinanceRepository.summarizeSellerPayoutBalances).toHaveBeenCalledWith({
        sellerId: 71,
        commissionRatePercent: 12
      });
      expect(result).toEqual({
        period: {
          dateFrom: '2026-07-01',
          dateTo: '2026-07-07'
        },
        commissionRatePercent: 12,
        sales: {
          totalOrders: 2,
          totalItems: 4,
          grossSalesKobo: 12500000,
          commissionKobo: 1500000,
          netSalesKobo: 11000000
        },
        payouts: {
          pendingKobo: 8100000,
          requestedKobo: 0,
          approvedKobo: 0,
          paidKobo: 0
        }
      });
    });
  });

  describe('createPayoutRequest', () => {
    it('creates a payout request for the seller', async () => {
      sellersRepository.findByUserId.mockResolvedValue({
        sellerProfile: {
          id: 71
        }
      });
      sellerFinanceRepository.createSellerPayoutRequest.mockResolvedValue({
        id: 55,
        grossAmountKobo: 9000000,
        commissionAmountKobo: 1080000,
        amountKobo: 7920000,
        status: 'requested',
        bankAccountRef: 'BANK-001',
        itemCount: 1,
        requestedAt: '2026-07-07T10:00:00.000Z',
        settledAt: null,
        createdAt: '2026-07-07T10:00:00.000Z',
        updatedAt: '2026-07-07T10:00:00.000Z'
      });
      platformConfigRepository.findPlatformConfigByKey.mockResolvedValue({
        key: 'commission_rate_default',
        value: 12
      });

      const result = await sellerFinanceService.createPayoutRequest({
        userId: 11,
        bankAccountRef: '  BANK-001  '
      });

      expect(sellerFinanceRepository.createSellerPayoutRequest).toHaveBeenCalledWith({
        sellerId: 71,
        bankAccountRef: 'BANK-001',
        commissionRatePercent: 12
      });
      expect(result).toEqual({
        id: 55,
        grossAmountKobo: 9000000,
        commissionAmountKobo: 1080000,
        amountKobo: 7920000,
        status: 'requested',
        bankAccountRef: 'BANK-001',
        itemCount: 1,
        requestedAt: '2026-07-07T10:00:00.000Z',
        approvedAt: null,
        rejectionReason: null,
        settledAt: null,
        createdAt: '2026-07-07T10:00:00.000Z',
        updatedAt: '2026-07-07T10:00:00.000Z'
      });
    });

    it('throws a conflict error when there are no eligible completed sales', async () => {
      sellersRepository.findByUserId.mockResolvedValue({
        sellerProfile: {
          id: 71
        }
      });
      sellerFinanceRepository.createSellerPayoutRequest.mockResolvedValue(null);
      platformConfigRepository.findPlatformConfigByKey.mockResolvedValue({
        key: 'commission_rate_default',
        value: 12
      });

      await expect(sellerFinanceService.createPayoutRequest({
        userId: 11,
        bankAccountRef: 'BANK-001'
      })).rejects.toMatchObject({
        statusCode: 409,
        code: 'CONFLICT'
      });
    });
  });

  describe('listPayouts', () => {
    it('returns seller payout history with pagination metadata', async () => {
      sellersRepository.findByUserId.mockResolvedValue({
        sellerProfile: {
          id: 71
        }
      });
      sellerFinanceRepository.listSellerPayouts.mockResolvedValue({
        payouts: [
          {
            id: 55,
            grossAmountKobo: 9000000,
            commissionAmountKobo: 1080000,
            amountKobo: 7920000,
            status: 'requested',
            bankAccountRef: 'BANK-001',
            itemCount: 1,
            requestedAt: '2026-07-07T10:00:00.000Z',
            approvedAt: null,
            rejectionReason: null,
            settledAt: null,
            createdAt: '2026-07-07T10:00:00.000Z',
            updatedAt: '2026-07-07T10:00:00.000Z'
          }
        ],
        total: 1
      });

      const result = await sellerFinanceService.listPayouts({
        userId: 11,
        query: {
          status: 'requested',
          page: 2,
          limit: 5
        }
      });

      expect(sellerFinanceRepository.listSellerPayouts).toHaveBeenCalledWith({
        sellerId: 71,
        status: 'requested',
        limit: 5,
        offset: 5
      });
      expect(result).toEqual({
        payouts: [
          {
            id: 55,
            grossAmountKobo: 9000000,
            commissionAmountKobo: 1080000,
            amountKobo: 7920000,
            status: 'requested',
            bankAccountRef: 'BANK-001',
            itemCount: 1,
            requestedAt: '2026-07-07T10:00:00.000Z',
            approvedAt: null,
            rejectionReason: null,
            settledAt: null,
            createdAt: '2026-07-07T10:00:00.000Z',
            updatedAt: '2026-07-07T10:00:00.000Z'
          }
        ],
        pagination: {
          page: 2,
          limit: 5,
          total: 1,
          totalPages: 1
        }
      });
    });
  });
});
