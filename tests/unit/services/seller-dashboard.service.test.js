require('../../setup/jest');

const { createSellerDashboardService } = require('../../../src/services/seller-dashboard.service');

describe('seller dashboard service', () => {
  let ordersRepository;
  let productsRepository;
  let sellerFinanceRepository;
  let sellersRepository;
  let sellerDashboardService;

  beforeEach(() => {
    ordersRepository = {
      summarizeSellerOrders: jest.fn(),
      summarizeSellerOrderTrends: jest.fn(),
      listSellerTopCustomers: jest.fn()
    };
    productsRepository = {
      summarizeSellerInventory: jest.fn(),
      summarizeSellerListingTrend: jest.fn(),
      listSellerProducts: jest.fn(),
      findProductCompatibilityByProductId: jest.fn()
    };
    sellerFinanceRepository = {
      getSellerSalesSummary: jest.fn(),
      getSellerRevenueTimeline: jest.fn(),
      getSellerRevenueTrend: jest.fn(),
      summarizeSellerPayoutBalances: jest.fn()
    };
    sellersRepository = {
      findByUserId: jest.fn()
    };

    sellerDashboardService = createSellerDashboardService({
      env: {
        PLATFORM_COMMISSION_RATE_PERCENT: 12
      },
      ordersRepository,
      productsRepository,
      sellerFinanceRepository,
      sellersRepository
    });
  });

  it('returns seller dashboard summaries for the requested period', async () => {
    sellersRepository.findByUserId.mockResolvedValue({
      sellerProfile: {
        id: 71,
        businessName: 'Prime Auto Hub',
        rating: 4.7,
        contactPhone: '08012345678',
        contactEmail: 'sales@primeautohub.ng',
        verificationStatus: 'verified',
        rejectionReason: null
      }
    });
    productsRepository.summarizeSellerInventory.mockResolvedValue({
      totalListings: 3,
      activeListings: 2,
      inactiveListings: 1,
      outOfStockListings: 0,
      lowStockListings: 1,
      totalUnitsInStock: 17
    });
    productsRepository.summarizeSellerListingTrend.mockResolvedValue({
      currentPeriodListings: 2,
      previousPeriodListings: 1
    });
    productsRepository.listSellerProducts.mockResolvedValue({
      products: [
        {
          id: 90,
          title: 'Front Brake Disc',
          categoryId: 1002,
          categoryName: 'Brake System',
          categorySlug: 'brake-system',
          condition: 'new',
          priceKobo: 4500000,
          stockQty: 8,
          location: 'Lagos',
          status: 'active',
          primaryImageUrl: '/uploads/disc.png',
          createdAt: '2026-07-07T10:00:00.000Z',
          updatedAt: '2026-07-07T10:00:00.000Z'
        },
        {
          id: 91,
          title: 'Cabin Air Filter',
          categoryId: 1005,
          categoryName: 'Filters',
          categorySlug: 'filters',
          condition: 'new',
          priceKobo: 1200000,
          stockQty: 3,
          location: 'Abuja',
          status: 'active',
          primaryImageUrl: '/uploads/filter.png',
          createdAt: '2026-07-06T10:00:00.000Z',
          updatedAt: '2026-07-06T10:00:00.000Z'
        }
      ],
      total: 2
    });
    productsRepository.findProductCompatibilityByProductId
      .mockResolvedValueOnce([
        {
          id: 701,
          make: 'Toyota',
          model: 'Camry',
          yearFrom: 2007,
          yearTo: 2011
        }
      ])
      .mockResolvedValueOnce([]);
    ordersRepository.summarizeSellerOrders.mockResolvedValue({
      totalOrders: 4,
      paidOrders: 3,
      unpaidOrders: 1,
      totalCustomers: 3,
      pendingOrders: 2,
      sellerLineItems: 5,
      totalItems: 8,
      pendingLineItems: 2,
      readyForPickupLineItems: 1,
      pickedUpLineItems: 1,
      deliveredLineItems: 1,
      cancelledLineItems: 0
    });
    ordersRepository.summarizeSellerOrderTrends.mockResolvedValue({
      currentPeriodOrders: 3,
      previousPeriodOrders: 2,
      currentPeriodCustomers: 2,
      previousPeriodCustomers: 1
    });
    ordersRepository.listSellerTopCustomers.mockResolvedValue([
      {
        buyerId: 201,
        fullName: 'Buyer User',
        email: 'buyer@example.com',
        phone: '+2348011111111',
        totalOrders: 2,
        totalItems: 4,
        totalSpentKobo: 6500000
      }
    ]);
    sellerFinanceRepository.getSellerSalesSummary.mockResolvedValue({
      totalOrders: 3,
      totalItems: 6,
      grossSalesKobo: 12500000,
      commissionKobo: 1500000,
      netSalesKobo: 11000000
    });
    sellerFinanceRepository.getSellerRevenueTrend.mockResolvedValue({
      currentGrossSalesKobo: 3500000,
      previousGrossSalesKobo: 2500000
    });
    sellerFinanceRepository.getSellerRevenueTimeline.mockResolvedValue([
      {
        monthNumber: 7,
        totalOrders: 3,
        totalItems: 6,
        grossSalesKobo: 12500000,
        commissionKobo: 1500000,
        netSalesKobo: 11000000
      }
    ]);
    sellerFinanceRepository.summarizeSellerPayoutBalances.mockResolvedValue({
      pendingKobo: 8100000,
      requestedKobo: 500000,
      approvedKobo: 0,
      paidKobo: 3000000
    });

    const result = await sellerDashboardService.getDashboard({
      userId: 11,
      query: {
        dateFrom: '2026-07-01',
        dateTo: '2026-07-07'
      }
    });

    expect(sellersRepository.findByUserId).toHaveBeenCalledWith(11);
    expect(productsRepository.summarizeSellerInventory).toHaveBeenCalledWith({
      sellerId: 71,
      lowStockThreshold: 5
    });
    expect(productsRepository.summarizeSellerListingTrend).toHaveBeenCalledWith({
      sellerId: 71,
      currentDateFrom: '2026-07-01',
      currentDateTo: '2026-07-07',
      previousDateFrom: '2026-06-24',
      previousDateTo: '2026-06-30'
    });
    expect(ordersRepository.summarizeSellerOrders).toHaveBeenCalledWith({
      sellerId: 71
    });
    expect(ordersRepository.summarizeSellerOrderTrends).toHaveBeenCalledWith({
      sellerId: 71,
      currentDateFrom: '2026-07-01',
      currentDateTo: '2026-07-07',
      previousDateFrom: '2026-06-24',
      previousDateTo: '2026-06-30'
    });
    expect(ordersRepository.listSellerTopCustomers).toHaveBeenCalledWith({
      sellerId: 71,
      limit: 5
    });
    expect(sellerFinanceRepository.getSellerSalesSummary).toHaveBeenCalledWith({
      sellerId: 71,
      commissionRatePercent: 12,
      dateFrom: '2026-07-01',
      dateTo: '2026-07-07'
    });
    expect(sellerFinanceRepository.getSellerRevenueTrend).toHaveBeenCalledWith({
      sellerId: 71,
      currentDateFrom: '2026-07-01',
      currentDateTo: '2026-07-07',
      previousDateFrom: '2026-06-24',
      previousDateTo: '2026-06-30'
    });
    expect(sellerFinanceRepository.getSellerRevenueTimeline).toHaveBeenCalledWith({
      sellerId: 71,
      commissionRatePercent: 12,
      year: 2026
    });
    expect(sellerFinanceRepository.summarizeSellerPayoutBalances).toHaveBeenCalledWith({
      sellerId: 71,
      commissionRatePercent: 12
    });
    expect(result).toEqual({
      seller: {
        id: 71,
        businessName: 'Prime Auto Hub',
        rating: 4.7,
        contactPhone: '08012345678',
        contactEmail: 'sales@primeautohub.ng',
        verificationStatus: 'verified',
        rejectionReason: null
      },
      comparison: {
        label: 'Since last week',
        currentPeriod: {
          dateFrom: '2026-07-01',
          dateTo: '2026-07-07'
        },
        previousPeriod: {
          dateFrom: '2026-06-24',
          dateTo: '2026-06-30'
        }
      },
      overviewCards: {
        productsListed: {
          label: 'Products Listed',
          value: 3,
          trend: {
            label: 'Since last week',
            direction: 'up',
            changePercent: 100,
            delta: 1,
            currentPeriodValue: 2,
            previousPeriodValue: 1
          }
        },
        totalOrders: {
          label: 'Total Orders',
          value: 4,
          trend: {
            label: 'Since last week',
            direction: 'up',
            changePercent: 50,
            delta: 1,
            currentPeriodValue: 3,
            previousPeriodValue: 2
          }
        },
        totalCustomers: {
          label: 'Total Customers',
          value: 3,
          trend: {
            label: 'Since last week',
            direction: 'up',
            changePercent: 100,
            delta: 1,
            currentPeriodValue: 2,
            previousPeriodValue: 1
          }
        },
        totalRevenue: {
          label: 'Total Revenue',
          valueKobo: 12500000,
          currency: 'NGN',
          trend: {
            label: 'Since last week',
            direction: 'up',
            changePercent: 40,
            delta: 1000000,
            currentPeriodValue: 3500000,
            previousPeriodValue: 2500000
          }
        }
      },
      revenueChart: {
        label: 'Total Revenue',
        interval: 'monthly',
        year: 2026,
        points: [
          {
            monthNumber: 1,
            label: 'Jan',
            totalOrders: 0,
            totalItems: 0,
            grossSalesKobo: 0,
            commissionKobo: 0,
            netSalesKobo: 0
          },
          {
            monthNumber: 2,
            label: 'Feb',
            totalOrders: 0,
            totalItems: 0,
            grossSalesKobo: 0,
            commissionKobo: 0,
            netSalesKobo: 0
          },
          {
            monthNumber: 3,
            label: 'Mar',
            totalOrders: 0,
            totalItems: 0,
            grossSalesKobo: 0,
            commissionKobo: 0,
            netSalesKobo: 0
          },
          {
            monthNumber: 4,
            label: 'Apr',
            totalOrders: 0,
            totalItems: 0,
            grossSalesKobo: 0,
            commissionKobo: 0,
            netSalesKobo: 0
          },
          {
            monthNumber: 5,
            label: 'May',
            totalOrders: 0,
            totalItems: 0,
            grossSalesKobo: 0,
            commissionKobo: 0,
            netSalesKobo: 0
          },
          {
            monthNumber: 6,
            label: 'Jun',
            totalOrders: 0,
            totalItems: 0,
            grossSalesKobo: 0,
            commissionKobo: 0,
            netSalesKobo: 0
          },
          {
            monthNumber: 7,
            label: 'Jul',
            totalOrders: 3,
            totalItems: 6,
            grossSalesKobo: 12500000,
            commissionKobo: 1500000,
            netSalesKobo: 11000000
          },
          {
            monthNumber: 8,
            label: 'Aug',
            totalOrders: 0,
            totalItems: 0,
            grossSalesKobo: 0,
            commissionKobo: 0,
            netSalesKobo: 0
          },
          {
            monthNumber: 9,
            label: 'Sep',
            totalOrders: 0,
            totalItems: 0,
            grossSalesKobo: 0,
            commissionKobo: 0,
            netSalesKobo: 0
          },
          {
            monthNumber: 10,
            label: 'Oct',
            totalOrders: 0,
            totalItems: 0,
            grossSalesKobo: 0,
            commissionKobo: 0,
            netSalesKobo: 0
          },
          {
            monthNumber: 11,
            label: 'Nov',
            totalOrders: 0,
            totalItems: 0,
            grossSalesKobo: 0,
            commissionKobo: 0,
            netSalesKobo: 0
          },
          {
            monthNumber: 12,
            label: 'Dec',
            totalOrders: 0,
            totalItems: 0,
            grossSalesKobo: 0,
            commissionKobo: 0,
            netSalesKobo: 0
          }
        ]
      },
      productStatus: {
        label: 'Total Products',
        totalProducts: 3,
        inStock: 2,
        lowStock: 1,
        outOfStock: 0,
        lowStockThreshold: 5
      },
      featuredProducts: [
        {
          id: 90,
          title: 'Front Brake Disc',
          priceKobo: 4500000,
          stockQty: 8,
          stockLabel: '8 Units',
          location: 'Lagos',
          condition: 'new',
          status: 'active',
          primaryImageUrl: '/uploads/disc.png',
          isLowStock: false,
          isOutOfStock: false,
          category: {
            id: 1002,
            name: 'Brake System',
            slug: 'brake-system'
          },
          compatibility: [
            {
              id: 701,
              make: 'Toyota',
              model: 'Camry',
              yearFrom: 2007,
              yearTo: 2011
            }
          ],
          compatibilityLabel: 'Toyota Camry',
          tags: [
            'Brake System',
            '8 Units',
            'Toyota Camry'
          ],
          createdAt: '2026-07-07T10:00:00.000Z',
          updatedAt: '2026-07-07T10:00:00.000Z'
        },
        {
          id: 91,
          title: 'Cabin Air Filter',
          priceKobo: 1200000,
          stockQty: 3,
          stockLabel: '3 Units',
          location: 'Abuja',
          condition: 'new',
          status: 'active',
          primaryImageUrl: '/uploads/filter.png',
          isLowStock: true,
          isOutOfStock: false,
          category: {
            id: 1005,
            name: 'Filters',
            slug: 'filters'
          },
          compatibility: [],
          compatibilityLabel: 'Universal',
          tags: [
            'Filters',
            '3 Units',
            'Universal'
          ],
          createdAt: '2026-07-06T10:00:00.000Z',
          updatedAt: '2026-07-06T10:00:00.000Z'
        }
      ],
      topCustomers: [
        {
          buyerId: 201,
          fullName: 'Buyer User',
          email: 'buyer@example.com',
          phone: '+2348011111111',
          totalOrders: 2,
          totalItems: 4,
          totalSpentKobo: 6500000
        }
      ],
      inventory: {
        totalListings: 3,
        activeListings: 2,
        inactiveListings: 1,
        outOfStockListings: 0,
        lowStockListings: 1,
        totalUnitsInStock: 17,
        lowStockThreshold: 5
      },
      orders: {
        totalOrders: 4,
        paidOrders: 3,
        unpaidOrders: 1,
        totalCustomers: 3,
        pendingOrders: 2,
        sellerLineItems: 5,
        totalItems: 8,
        pendingLineItems: 2,
        readyForPickupLineItems: 1,
        pickedUpLineItems: 1,
        deliveredLineItems: 1,
        cancelledLineItems: 0
      },
      sales: {
        period: {
          dateFrom: '2026-07-01',
          dateTo: '2026-07-07'
        },
        commissionRatePercent: 12,
        totalOrders: 3,
        totalItems: 6,
        grossSalesKobo: 12500000,
        commissionKobo: 1500000,
        netSalesKobo: 11000000
      },
      payouts: {
        pendingKobo: 8100000,
        requestedKobo: 500000,
        approvedKobo: 0,
        paidKobo: 3000000
      }
    });
  });

  it('throws a not found error when the seller profile does not exist', async () => {
    sellersRepository.findByUserId.mockResolvedValue(null);

    await expect(sellerDashboardService.getDashboard({
      userId: 11,
      query: {}
    })).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND'
    });
  });
});
