const { ORDER_STATUSES, PAYMENT_STATUSES } = require('../config/constants');
const { sanitizeLimit } = require('./pagination.repository');

// Epoch arithmetic avoids depending on MySQL's session/system timezone or loaded timezone tables.
const LAGOS_CREATED = "TIMESTAMPADD(SECOND, UNIX_TIMESTAMP(o.created_at) + 3600, '1970-01-01 00:00:00')";
const ELIGIBLE = 'o.status = ? AND o.payment_status = ?';
const RANGE = 'o.created_at >= FROM_UNIXTIME(?) AND o.created_at < FROM_UNIXTIME(?)';
const ELIGIBLE_PARAMS = [ORDER_STATUSES.DELIVERED, PAYMENT_STATUSES.PAID];

function bucketExpression(type) {
  const date = `DATE(${LAGOS_CREATED})`;
  if (type === 'monthly') return `DATE_FORMAT(${date}, '%Y-%m-01')`;
  if (type === 'weekly') return `DATE_FORMAT(DATE_SUB(${date}, INTERVAL WEEKDAY(${date}) DAY), '%Y-%m-%d')`;
  return `DATE_FORMAT(${date}, '%Y-%m-%d')`;
}

function createAdminAnalyticsRepository({ db }) {
  return {
    async getPlatformAnalytics(window, topSellersLimit) {
      const connection = await db.getConnection();
      try {
        await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY');
        const currentParams = [...ELIGIBLE_PARAMS, window.currentFrom, window.currentTo];
        const [summary] = await connection.execute(`
          SELECT CASE WHEN o.created_at >= FROM_UNIXTIME(?) THEN 'current' ELSE 'previous' END AS period,
            COUNT(*) AS total_orders, COALESCE(SUM(o.total_kobo), 0) AS total_gmv_kobo
          FROM orders o WHERE ${ELIGIBLE} AND ${RANGE} GROUP BY period
        `, [window.currentFrom, ...ELIGIBLE_PARAMS, window.previousFrom, window.currentTo]);
        const [activeSellers] = await connection.execute(`
          SELECT CASE WHEN o.created_at >= FROM_UNIXTIME(?) THEN 'current' ELSE 'previous' END AS period,
            COUNT(DISTINCT oi.seller_id) AS active_sellers
          FROM orders o INNER JOIN order_items oi ON oi.order_id = o.id
          WHERE ${ELIGIBLE} AND ${RANGE} GROUP BY period
        `, [window.currentFrom, ...ELIGIBLE_PARAMS, window.previousFrom, window.currentTo]);
        const [gmvSeries] = await connection.execute(`
          SELECT ${bucketExpression(window.bucketType)} AS bucket, SUM(o.total_kobo) AS gmv_kobo
          FROM orders o WHERE ${ELIGIBLE} AND ${RANGE} GROUP BY bucket ORDER BY bucket
        `, currentParams);
        const [ordersByWeek] = await connection.execute(`
          SELECT ${bucketExpression('weekly')} AS bucket, COUNT(*) AS order_count
          FROM orders o WHERE ${ELIGIBLE} AND ${RANGE} GROUP BY bucket ORDER BY bucket
        `, [...ELIGIBLE_PARAMS, window.weeksFrom, window.currentTo]);
        const categoryTotals = `SELECT c.id AS category_id, c.name, COUNT(DISTINCT o.id) AS order_count,
            SUM(oi.line_total_kobo) AS revenue_kobo
          FROM orders o INNER JOIN order_items oi ON oi.order_id = o.id
          INNER JOIN products p ON p.id = oi.product_id INNER JOIN categories c ON c.id = p.category_id
          WHERE ${ELIGIBLE} AND ${RANGE}
          GROUP BY c.id, c.name`;
        const [categoryBreakdown] = await connection.execute(`
          WITH category_totals AS (${categoryTotals}), ranked AS (
            SELECT *, ROW_NUMBER() OVER (ORDER BY order_count DESC, category_id ASC) AS category_rank
            FROM category_totals
          ), grouped AS (
            SELECT CASE WHEN category_rank <= 5 THEN category_id ELSE NULL END AS category_id,
              CASE WHEN category_rank <= 5 THEN name ELSE 'Other' END AS name,
              SUM(order_count) AS order_count, MIN(category_rank) AS display_rank
            FROM ranked GROUP BY
              CASE WHEN category_rank <= 5 THEN category_id ELSE NULL END,
              CASE WHEN category_rank <= 5 THEN name ELSE 'Other' END
          ) SELECT *, SUM(order_count) OVER () AS total_count FROM grouped ORDER BY display_rank
        `, currentParams);
        const [revenueByCategory] = await connection.execute(`
          WITH category_totals AS (${categoryTotals})
          SELECT *, SUM(revenue_kobo) OVER () AS total_revenue FROM category_totals
          ORDER BY revenue_kobo DESC, category_id ASC
        `, currentParams);
        const limit = sanitizeLimit(topSellersLimit, { defaultLimit: 5, maxLimit: 20 });
        const [topSellers] = await connection.execute(`
          SELECT sp.id AS seller_id, sp.business_name, sp.address AS location, sp.rating,
            SUM(oi.line_total_kobo) AS gmv_kobo, COUNT(DISTINCT o.id) AS order_count
          FROM orders o INNER JOIN order_items oi ON oi.order_id = o.id
          INNER JOIN seller_profiles sp ON sp.id = oi.seller_id
          WHERE ${ELIGIBLE} AND ${RANGE}
          GROUP BY sp.id, sp.business_name, sp.address, sp.rating
          ORDER BY gmv_kobo DESC, order_count DESC, sp.id ASC LIMIT ${limit}
        `, currentParams);
        await connection.commit();
        return { summary, activeSellers, gmvSeries, ordersByWeek, categoryBreakdown, revenueByCategory, topSellers };
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
  };
}

module.exports = { createAdminAnalyticsRepository };
