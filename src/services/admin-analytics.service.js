const { analyticsWindow } = require('../utils/admin-reporting');
const { serializeCsvRows } = require('../utils/csv');

function metric(value, previousValue) {
  return {
    value,
    changePercent: previousValue === null || previousValue === 0 || value === null
      ? null : Math.round((value - previousValue) / previousValue * 10000) / 100
  };
}

// Allocate hundredths by largest remainder so displayed percentages total exactly 100.
// Inputs are category aggregates returned by SQL, never individual orders/items.
function percentages(rows, field, total) {
  if (!total) return rows.map((row) => ({ ...row, percentage: 0 }));
  const shares = rows.map((row, index) => {
    const exact = row[field] / total * 10000;
    return { index, units: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  const remaining = 10000 - shares.reduce((sum, share) => sum + share.units, 0);
  const ranked = [...shares].sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let index = 0; index < remaining; index += 1) ranked[index].units += 1;
  return rows.map((row, index) => ({ ...row, percentage: shares[index].units / 100 }));
}

function createAdminAnalyticsService({ adminAnalyticsRepository, now = () => new Date() }) {
  async function getPlatformAnalytics({ period = '30d', topSellersLimit = 5 } = {}) {
    const window = analyticsWindow(period, now());
    const result = await adminAnalyticsRepository.getPlatformAnalytics(window, topSellersLimit);
    const totals = (periodName) => {
      const row = result.summary.find((entry) => entry.period === periodName) || {};
      const sellers = result.activeSellers.find((entry) => entry.period === periodName) || {};
      const totalGmvKobo = Number(row.total_gmv_kobo || 0);
      const totalOrders = Number(row.total_orders || 0);
      return {
        totalGmvKobo, totalOrders, activeSellers: Number(sellers.active_sellers || 0),
        avgOrderValueKobo: totalOrders ? Math.round(totalGmvKobo / totalOrders) : null
      };
    };
    const current = totals('current');
    const previous = totals('previous');
    const breakdown = result.categoryBreakdown.map((row) => ({
      categoryId: row.category_id === null ? null : Number(row.category_id), name: row.name, orderCount: Number(row.order_count)
    }));
    const series = new Map(result.gmvSeries.map((row) => [row.bucket, Number(row.gmv_kobo)]));
    const weeks = new Map(result.ordersByWeek.map((row) => [row.bucket, Number(row.order_count)]));
    return {
      period, timezone: 'Africa/Lagos',
      dateFrom: window.dateFrom, dateToExclusive: window.dateTo,
      summary: Object.fromEntries(Object.keys(current).map((key) => [key, metric(current[key], previous[key])])),
      gmvSeries: window.buckets.map((bucket) => ({ bucket, gmvKobo: series.get(bucket) || 0 })),
      ordersByWeek: window.weeks.map((weekLabel) => ({ weekLabel, orderCount: weeks.get(weekLabel) || 0 })),
      categoryBreakdown: percentages(breakdown, 'orderCount', Number(result.categoryBreakdown[0]?.total_count || 0)),
      revenueByCategory: percentages(result.revenueByCategory.map((row) => ({
        categoryId: Number(row.category_id), name: row.name, revenueKobo: Number(row.revenue_kobo)
      })), 'revenueKobo', Number(result.revenueByCategory[0]?.total_revenue || 0)),
      topSellers: result.topSellers.map((row, index) => ({
        rank: index + 1, sellerId: Number(row.seller_id), businessName: row.business_name,
        location: row.location, gmvKobo: Number(row.gmv_kobo), orderCount: Number(row.order_count),
        rating: row.rating === null ? null : Number(row.rating)
      }))
    };
  }

  return {
    getPlatformAnalytics,
    async exportPlatformAnalytics(query) {
      const data = await getPlatformAnalytics(query);
      const rows = [
        ...['period', 'timezone', 'dateFrom', 'dateToExclusive'].map((key) => ({ section: 'metadata', metric: key, value: data[key] })),
        ...Object.entries(data.summary).map(([key, value]) => ({ section: 'summary', metric: key, ...value })),
        ...['gmvSeries', 'ordersByWeek', 'categoryBreakdown', 'revenueByCategory', 'topSellers']
          .flatMap((section) => data[section].map((row) => ({ section, ...row })))
      ];
      const fields = ['section', 'metric', 'value', 'changePercent', 'bucket', 'gmvKobo', 'weekLabel',
        'orderCount', 'categoryId', 'name', 'percentage', 'revenueKobo', 'rank', 'sellerId',
        'businessName', 'location', 'rating'];
      return {
        filename: `platform-analytics-${data.period}-${data.dateFrom}.csv`,
        csv: serializeCsvRows(fields.map((key) => ({ key, label: key })), rows)
      };
    }
  };
}

module.exports = { createAdminAnalyticsService };
