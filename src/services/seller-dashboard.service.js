const { ERROR_CODES } = require('../config/constants');
const AppError = require('../utils/app-error');
const {
  formatDateOnly,
  resolveSellerSalesPeriod,
  subtractDays
} = require('../utils/seller-finance');
const {
  resolveCommissionRatePercent
} = require('../utils/platform-config');

const FEATURED_PRODUCT_LIMIT = 3;
const LOW_STOCK_THRESHOLD = 5;
const TOP_CUSTOMER_LIMIT = 5;
const WEEKLY_COMPARISON_LABEL = 'Since last week';
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function mapSeller(profile) {
  return {
    id: profile.id,
    businessName: profile.businessName,
    rating: profile.rating,
    contactPhone: profile.contactPhone,
    contactEmail: profile.contactEmail,
    verificationStatus: profile.verificationStatus,
    rejectionReason: profile.rejectionReason
  };
}

function mapCompatibility(entry) {
  return {
    id: entry.id,
    make: entry.make,
    model: entry.model,
    yearFrom: entry.yearFrom,
    yearTo: entry.yearTo
  };
}

function resolveComparisonWindow(anchorDateValue) {
  const anchorDate = new Date(`${anchorDateValue}T00:00:00.000Z`);

  return {
    label: WEEKLY_COMPARISON_LABEL,
    currentPeriod: {
      dateFrom: formatDateOnly(subtractDays(anchorDate, 6)),
      dateTo: formatDateOnly(anchorDate)
    },
    previousPeriod: {
      dateFrom: formatDateOnly(subtractDays(anchorDate, 13)),
      dateTo: formatDateOnly(subtractDays(anchorDate, 7))
    }
  };
}

function buildTrend(currentValue, previousValue) {
  const delta = Number(currentValue || 0) - Number(previousValue || 0);
  let changePercent = 0;

  if (Number(previousValue || 0) === 0) {
    changePercent = Number(currentValue || 0) === 0 ? 0 : 100;
  } else {
    changePercent = Math.round((delta / Number(previousValue)) * 100);
  }

  return {
    label: WEEKLY_COMPARISON_LABEL,
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
    changePercent,
    delta,
    currentPeriodValue: Number(currentValue || 0),
    previousPeriodValue: Number(previousValue || 0)
  };
}

function buildCompatibilityLabel(entries = []) {
  if (!entries.length) {
    return 'Universal';
  }

  const first = entries[0];

  return `${first.make} ${first.model}`;
}

function mapFeaturedProduct(product, compatibility) {
  const compatibilityLabel = buildCompatibilityLabel(compatibility);

  return {
    id: product.id,
    title: product.title,
    priceKobo: product.priceKobo,
    stockQty: product.stockQty,
    stockLabel: `${product.stockQty} Units`,
    location: product.location,
    condition: product.condition,
    status: product.status,
    primaryImageUrl: product.primaryImageUrl,
    isLowStock: product.stockQty > 0 && product.stockQty <= LOW_STOCK_THRESHOLD,
    isOutOfStock: product.stockQty === 0,
    category: {
      id: product.categoryId,
      name: product.categoryName,
      slug: product.categorySlug
    },
    compatibility: compatibility.map(mapCompatibility),
    compatibilityLabel,
    tags: [
      product.categoryName,
      `${product.stockQty} Units`,
      compatibilityLabel
    ],
    createdAt: product.createdAt,
    updatedAt: product.updatedAt
  };
}

function mapTopCustomer(customer) {
  return {
    buyerId: customer.buyerId,
    fullName: customer.fullName,
    email: customer.email,
    phone: customer.phone,
    totalOrders: customer.totalOrders,
    totalItems: customer.totalItems,
    totalSpentKobo: customer.totalSpentKobo
  };
}

function buildRevenueTimeline(rows, year) {
  const byMonthNumber = new Map(rows.map((row) => [row.monthNumber, row]));

  return {
    label: 'Total Revenue',
    interval: 'monthly',
    year,
    points: MONTH_LABELS.map((label, index) => {
      const monthNumber = index + 1;
      const row = byMonthNumber.get(monthNumber);

      return {
        monthNumber,
        label,
        totalOrders: row ? row.totalOrders : 0,
        totalItems: row ? row.totalItems : 0,
        grossSalesKobo: row ? row.grossSalesKobo : 0,
        commissionKobo: row ? row.commissionKobo : 0,
        netSalesKobo: row ? row.netSalesKobo : 0
      };
    })
  };
}

function createSellerDashboardService({
  env,
  ordersRepository,
  platformConfigRepository,
  productsRepository,
  sellerFinanceRepository,
  sellersRepository
}) {
  async function ensureSellerProfile(userId) {
    const sellerAccount = await sellersRepository.findByUserId(userId);

    if (!sellerAccount) {
      throw new AppError('Seller profile was not found.', {
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND
      });
    }

    return sellerAccount;
  }

  return {
    async getDashboard(payload) {
      const sellerAccount = await ensureSellerProfile(payload.userId);
      const sellerId = sellerAccount.sellerProfile.id;
      const period = resolveSellerSalesPeriod(payload.query);
      const comparison = resolveComparisonWindow(period.dateTo);
      const commissionRatePercent = await resolveCommissionRatePercent({
        env,
        platformConfigRepository
      });
      const revenueChartYear = Number(period.dateTo.slice(0, 4));
      const [
        inventory,
        listingTrend,
        orders,
        orderTrends,
        sales,
        revenueTrend,
        revenueTimeline,
        payouts,
        topCustomers,
        sellerProducts
      ] = await Promise.all([
        productsRepository.summarizeSellerInventory({
          sellerId,
          lowStockThreshold: LOW_STOCK_THRESHOLD
        }),
        productsRepository.summarizeSellerListingTrend({
          sellerId,
          currentDateFrom: comparison.currentPeriod.dateFrom,
          currentDateTo: comparison.currentPeriod.dateTo,
          previousDateFrom: comparison.previousPeriod.dateFrom,
          previousDateTo: comparison.previousPeriod.dateTo
        }),
        ordersRepository.summarizeSellerOrders({
          sellerId
        }),
        ordersRepository.summarizeSellerOrderTrends({
          sellerId,
          currentDateFrom: comparison.currentPeriod.dateFrom,
          currentDateTo: comparison.currentPeriod.dateTo,
          previousDateFrom: comparison.previousPeriod.dateFrom,
          previousDateTo: comparison.previousPeriod.dateTo
        }),
        sellerFinanceRepository.getSellerSalesSummary({
          sellerId,
          commissionRatePercent,
          dateFrom: period.dateFrom,
          dateTo: period.dateTo
        }),
        sellerFinanceRepository.getSellerRevenueTrend({
          sellerId,
          currentDateFrom: comparison.currentPeriod.dateFrom,
          currentDateTo: comparison.currentPeriod.dateTo,
          previousDateFrom: comparison.previousPeriod.dateFrom,
          previousDateTo: comparison.previousPeriod.dateTo
        }),
        sellerFinanceRepository.getSellerRevenueTimeline({
          sellerId,
          commissionRatePercent,
          year: revenueChartYear
        }),
        // LOGISTICS-STUB: payout eligibility currently uses paid, non-cancelled seller items
        // until delivered-item settlement rules land with the logistics module.
        sellerFinanceRepository.summarizeSellerPayoutBalances({
          sellerId,
          commissionRatePercent
        }),
        ordersRepository.listSellerTopCustomers({
          sellerId,
          limit: TOP_CUSTOMER_LIMIT
        }),
        productsRepository.listSellerProducts({
          sellerId,
          status: 'all',
          lowStockOnly: false,
          lowStockThreshold: LOW_STOCK_THRESHOLD,
          limit: FEATURED_PRODUCT_LIMIT,
          offset: 0
        })
      ]);
      const featuredProducts = await Promise.all(
        sellerProducts.products.map(async (product) => {
          const compatibility = await productsRepository.findProductCompatibilityByProductId(product.id);

          return mapFeaturedProduct(product, compatibility);
        })
      );
      const healthyStockProducts = Math.max(
        inventory.totalListings - inventory.lowStockListings - inventory.outOfStockListings,
        0
      );

      return {
        seller: mapSeller(sellerAccount.sellerProfile),
        comparison,
        overviewCards: {
          productsListed: {
            label: 'Products Listed',
            value: inventory.totalListings,
            trend: buildTrend(
              listingTrend.currentPeriodListings,
              listingTrend.previousPeriodListings
            )
          },
          totalOrders: {
            label: 'Total Orders',
            value: orders.totalOrders,
            trend: buildTrend(
              orderTrends.currentPeriodOrders,
              orderTrends.previousPeriodOrders
            )
          },
          totalCustomers: {
            label: 'Total Customers',
            value: orders.totalCustomers,
            trend: buildTrend(
              orderTrends.currentPeriodCustomers,
              orderTrends.previousPeriodCustomers
            )
          },
          totalRevenue: {
            label: 'Total Revenue',
            valueKobo: sales.grossSalesKobo,
            currency: 'NGN',
            trend: buildTrend(
              revenueTrend.currentGrossSalesKobo,
              revenueTrend.previousGrossSalesKobo
            )
          }
        },
        revenueChart: buildRevenueTimeline(revenueTimeline, revenueChartYear),
        productStatus: {
          label: 'Total Products',
          totalProducts: inventory.totalListings,
          inStock: healthyStockProducts,
          lowStock: inventory.lowStockListings,
          outOfStock: inventory.outOfStockListings,
          lowStockThreshold: LOW_STOCK_THRESHOLD
        },
        featuredProducts,
        topCustomers: topCustomers.map(mapTopCustomer),
        inventory: {
          ...inventory,
          lowStockThreshold: LOW_STOCK_THRESHOLD
        },
        orders,
        sales: {
          period,
          commissionRatePercent,
          ...sales
        },
        payouts
      };
    }
  };
}

module.exports = {
  createSellerDashboardService
};
