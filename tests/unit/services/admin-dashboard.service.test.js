require('../../setup/jest');

const { createAdminDashboardService } = require('../../../src/services/admin-dashboard.service');

function buildSellerAccount(overrides = {}) {
  return {
    user: {
      id: 21,
      role: 'seller',
      fullName: 'Uche Okafor',
      email: 'uche@example.com',
      phone: '+2348012345678',
      isVerified: false,
      accountStatus: 'active',
      createdAt: '2026-07-07T09:00:00.000Z',
      updatedAt: '2026-07-07T09:00:00.000Z'
    },
    sellerProfile: {
      id: 101,
      userId: 21,
      businessName: 'Prime Auto Hub',
      rating: 0,
      contactPhone: '+2348012345678',
      contactEmail: 'sales@primeautohub.ng',
      address: '12 Sapara Williams Close, Victoria Island, Lagos',
      cacNumber: 'RC-123456',
      verificationStatus: 'pending',
      rejectionReason: null,
      documents: [
        { id: 1, type: 'cac', filePath: '/uploads/cac.pdf' }
      ],
      createdAt: '2026-07-07T09:00:00.000Z',
      updatedAt: '2026-07-10T09:05:00.000Z'
    },
    ...overrides
  };
}

function buildDispute(overrides = {}) {
  return {
    id: 301,
    orderId: 5001,
    raisedBy: 'buyer',
    reason: 'Buyer reported a damaged part on delivery.',
    status: 'open',
    resolutionNote: null,
    refundReference: null,
    refundAmountKobo: null,
    resolvedBy: null,
    resolvedAt: null,
    createdAt: '2026-07-12T06:00:00.000Z',
    updatedAt: '2026-07-12T06:00:00.000Z',
    order: {
      id: 5001,
      status: 'disputed',
      paymentMethod: 'paystack',
      paymentReference: 'APT-5001-REF',
      paymentStatus: 'paid',
      totalKobo: 3700000,
      createdAt: '2026-07-07T09:00:00.000Z',
      updatedAt: '2026-07-12T06:00:00.000Z'
    },
    buyer: {
      id: 11,
      fullName: 'Bola Adeniran',
      email: 'bola@example.com',
      phone: '+2348012345678'
    },
    sellers: [
      {
        id: 101,
        userId: 21,
        businessName: 'Prime Auto Hub',
        contactEmail: 'sales@primeautohub.ng',
        contactPhone: '+2348012345678',
        fullName: 'Uche Okafor',
        email: 'uche@example.com',
        phone: '+2348012345678'
      }
    ],
    ...overrides
  };
}

describe('admin dashboard service', () => {
  let adminDashboardRepository;
  let adminRepository;
  let auditLogRepository;
  let disputesRepository;
  let platformConfigRepository;
  let adminDashboardService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-07-12T10:00:00.000Z'));

    adminDashboardRepository = {
      getDashboardSummary: jest.fn(),
      listRecentOrders: jest.fn(),
      listTopSellers: jest.fn(),
      listPayoutQueue: jest.fn()
    };
    adminRepository = {
      listSellerVerificationQueue: jest.fn()
    };
    auditLogRepository = {
      listAuditLogs: jest.fn()
    };
    disputesRepository = {
      listDisputesForAdmin: jest.fn()
    };
    platformConfigRepository = {
      findPlatformConfigByKey: jest.fn()
    };

    adminDashboardService = createAdminDashboardService({
      adminDashboardRepository,
      adminRepository,
      auditLogRepository,
      disputesRepository,
      env: {
        PLATFORM_COMMISSION_RATE_PERCENT: 10
      },
      platformConfigRepository
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the admin dashboard payload with alerts, cards, and queue previews', async () => {
    platformConfigRepository.findPlatformConfigByKey.mockResolvedValue({
      key: 'commission_rate_default',
      value: 12
    });
    adminDashboardRepository.getDashboardSummary.mockResolvedValue({
      activeSellersCount: 4,
      ordersTodayCount: 12,
      ordersYesterdayCount: 9,
      totalOrdersCount: 120,
      platformGmvKobo: 150000000,
      totalRevenueKobo: 18000000,
      openDisputesCount: 3,
      urgentOpenDisputesCount: 1,
      totalDisputesCount: 10,
      resolvedDisputesCount: 7,
      pendingVerificationsCount: 2,
      verifiedSellersCount: 8,
      rejectedSellersCount: 2,
      payoutRequestsCount: 5,
      payoutRequestsAmountKobo: 3200000,
      failedPayoutsCount: 1,
      totalPayoutsCount: 8,
      paidPayoutsCount: 4,
      pendingPayoutQueueAmountKobo: 5400000,
      averagePayoutTimeDays: 1.8,
      currentRevenueKobo: 3000000,
      previousRevenueKobo: 2000000,
      currentPlatformGmvKobo: 25000000,
      previousPlatformGmvKobo: 20000000,
      currentActiveSellersCount: 4,
      previousActiveSellersCount: 3
    });
    adminDashboardRepository.listRecentOrders.mockResolvedValue({
      total: 12,
      orders: [
        {
          id: 5001,
          status: 'completed',
          paymentStatus: 'paid',
          totalKobo: 3700000,
          sellerCount: 1,
          primarySellerBusinessName: 'Prime Auto Hub',
          createdAt: '2026-07-12T08:00:00.000Z'
        }
      ]
    });
    adminDashboardRepository.listTopSellers.mockResolvedValue({
      total: 1,
      sellers: [
        {
          sellerId: 101,
          userId: 21,
          businessName: 'Prime Auto Hub',
          fullName: 'Uche Okafor',
          email: 'uche@example.com',
          phone: '+2348012345678',
          totalOrders: 12,
          totalItems: 18,
          grossSalesKobo: 42000000
        }
      ]
    });
    adminDashboardRepository.listPayoutQueue.mockResolvedValue({
      total: 2,
      pendingAmountKobo: 5400000,
      payouts: [
        {
          payoutId: 901,
          sellerId: 101,
          userId: 21,
          businessName: 'Prime Auto Hub',
          fullName: 'Uche Okafor',
          email: 'uche@example.com',
          amountKobo: 3200000,
          status: 'requested',
          requestedAt: '2026-07-10T10:00:00.000Z',
          approvedAt: null
        }
      ]
    });
    adminRepository.listSellerVerificationQueue.mockResolvedValue({
      total: 2,
      sellers: [
        buildSellerAccount()
      ]
    });
    disputesRepository.listDisputesForAdmin.mockResolvedValue({
      total: 3,
      disputes: [
        buildDispute()
      ]
    });
    auditLogRepository.listAuditLogs.mockResolvedValue({
      total: 1,
      logs: [
        {
          id: 1,
          action: 'seller_verification.verified',
          targetType: 'seller',
          targetId: 101,
          detail: {
            nextStatus: 'verified'
          },
          createdAt: '2026-07-12T09:00:00.000Z',
          admin: {
            id: 5,
            fullName: 'Super Admin',
            email: 'superadmin@example.com'
          }
        }
      ]
    });

    const result = await adminDashboardService.getDashboard();

    expect(result.commissionRatePercent).toBe(12);
    expect(result.alerts.openDisputes.count).toBe(3);
    expect(result.alerts.payoutRequests.pendingAmountKobo).toBe(3200000);
    expect(result.overviewCards.totalRevenue.valueKobo).toBe(18000000);
    expect(result.overviewCards.totalRevenue.trend.direction).toBe('up');
    expect(result.operationalCards.failedPayouts.status).toBe('critical');
    expect(result.sellerVerificationQueue.total).toBe(2);
    expect(result.sellerVerificationQueue.items[0].businessName).toBe('Prime Auto Hub');
    expect(result.openDisputes.items[0].orderCode).toBe('#ORD-5001');
    expect(result.recentOrders.items[0].sellerLabel).toBe('Prime Auto Hub');
    expect(result.topSellers.items[0].rank).toBe(1);
    expect(result.payoutQueue.items[0].waitDays).toBe(2);
    expect(result.recentActivity[0].summary).toBe('Seller #101 approved.');
    expect(result.platformHealth.metrics.disputeResolutionRatePercent).toBe(70);
  });
});
