const {
  ORDER_ITEM_STATUSES,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  PAYOUT_STATUSES,
  SELLER_VERIFICATION_STATUSES,
  USER_ACCOUNT_STATUSES
} = require('../config/constants');

function toNumber(value) {
  return value === null || value === undefined ? 0 : Number(value);
}

function mapRecentOrderRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: toNumber(row.id),
    status: row.status,
    paymentStatus: row.payment_status,
    totalKobo: toNumber(row.total_kobo),
    sellerCount: toNumber(row.seller_count),
    primarySellerBusinessName: row.primary_seller_business_name,
    createdAt: row.created_at
  };
}

function mapTopSellerRow(row) {
  if (!row) {
    return null;
  }

  return {
    sellerId: toNumber(row.seller_id),
    userId: toNumber(row.user_id),
    businessName: row.business_name,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    totalOrders: toNumber(row.total_orders),
    totalItems: toNumber(row.total_items),
    grossSalesKobo: toNumber(row.gross_sales_kobo)
  };
}

function mapPayoutQueueRow(row) {
  if (!row) {
    return null;
  }

  return {
    payoutId: toNumber(row.id),
    sellerId: toNumber(row.seller_id),
    userId: toNumber(row.user_id),
    businessName: row.business_name,
    fullName: row.full_name,
    email: row.email,
    amountKobo: toNumber(row.amount_kobo),
    status: row.status,
    requestedAt: row.requested_at,
    approvedAt: row.approved_at
  };
}

function createAdminDashboardRepository({ db }) {
  return {
    async getDashboardSummary(filters) {
      const urgentThresholdHours = Math.max(
        Number(filters.reviewSlaHours) - Number(filters.urgentWindowHours),
        0
      );
      const [
        [summaryRows],
        [currentRevenueRows],
        [previousRevenueRows],
        [currentGmvRows],
        [previousGmvRows],
        [currentActiveSellerRows],
        [previousActiveSellerRows],
        [ordersYesterdayRows]
      ] = await Promise.all([
        db.execute(
          `
            SELECT
              (
                SELECT COUNT(*)
                FROM seller_profiles sp
                INNER JOIN users u ON u.id = sp.user_id
                WHERE u.account_status = ?
                  AND sp.verification_status = ?
              ) AS active_sellers_count,
              (
                SELECT COUNT(*)
                FROM orders
                WHERE DATE(created_at) = ?
              ) AS orders_today_count,
              (
                SELECT COUNT(*)
                FROM orders
              ) AS total_orders_count,
              (
                SELECT COALESCE(SUM(total_kobo), 0)
                FROM orders
                WHERE payment_status = ?
              ) AS platform_gmv_kobo,
              (
                SELECT COALESCE(SUM(ROUND(oi.line_total_kobo * ? / 100)), 0)
                FROM order_items oi
                INNER JOIN orders o ON o.id = oi.order_id
                WHERE o.payment_status = ?
                  AND o.status <> ?
                  AND oi.item_status <> ?
              ) AS total_revenue_kobo,
              (
                SELECT COUNT(*)
                FROM disputes
                WHERE status = 'open'
              ) AS open_disputes_count,
              (
                SELECT COUNT(*)
                FROM disputes
                WHERE status = 'open'
                  AND TIMESTAMPDIFF(HOUR, created_at, CURRENT_TIMESTAMP) >= ?
              ) AS urgent_open_disputes_count,
              (
                SELECT COUNT(*)
                FROM disputes
              ) AS total_disputes_count,
              (
                SELECT COUNT(*)
                FROM disputes
                WHERE status = 'resolved'
              ) AS resolved_disputes_count,
              (
                SELECT COUNT(*)
                FROM seller_profiles sp
                WHERE sp.verification_status = ?
                  AND EXISTS (
                    SELECT 1
                    FROM seller_documents sd
                    WHERE sd.seller_id = sp.id
                  )
              ) AS pending_verifications_count,
              (
                SELECT COUNT(*)
                FROM seller_profiles
                WHERE verification_status = ?
              ) AS verified_sellers_count,
              (
                SELECT COUNT(*)
                FROM seller_profiles
                WHERE verification_status = ?
              ) AS rejected_sellers_count,
              (
                SELECT COUNT(*)
                FROM payouts
                WHERE status = ?
              ) AS payout_requests_count,
              (
                SELECT COALESCE(SUM(amount_kobo), 0)
                FROM payouts
                WHERE status = ?
              ) AS payout_requests_amount_kobo,
              (
                SELECT COUNT(*)
                FROM payouts
                WHERE status = ?
              ) AS failed_payouts_count,
              (
                SELECT COUNT(*)
                FROM payouts
              ) AS total_payouts_count,
              (
                SELECT COUNT(*)
                FROM payouts
                WHERE status = ?
              ) AS paid_payouts_count,
              (
                SELECT COALESCE(SUM(amount_kobo), 0)
                FROM payouts
                WHERE status IN (?, ?)
              ) AS pending_payout_queue_amount_kobo,
              (
                SELECT AVG(TIMESTAMPDIFF(HOUR, requested_at, settled_at)) / 24
                FROM payouts
                WHERE status = ?
                  AND settled_at IS NOT NULL
              ) AS average_payout_time_days
          `,
          [
            USER_ACCOUNT_STATUSES.ACTIVE,
            SELLER_VERIFICATION_STATUSES.VERIFIED,
            filters.todayDate,
            PAYMENT_STATUSES.PAID,
            filters.commissionRatePercent,
            PAYMENT_STATUSES.PAID,
            ORDER_STATUSES.CANCELLED,
            ORDER_ITEM_STATUSES.CANCELLED,
            urgentThresholdHours,
            SELLER_VERIFICATION_STATUSES.PENDING,
            SELLER_VERIFICATION_STATUSES.VERIFIED,
            SELLER_VERIFICATION_STATUSES.REJECTED,
            PAYOUT_STATUSES.REQUESTED,
            PAYOUT_STATUSES.REQUESTED,
            PAYOUT_STATUSES.REJECTED,
            PAYOUT_STATUSES.PAID,
            PAYOUT_STATUSES.REQUESTED,
            PAYOUT_STATUSES.APPROVED,
            PAYOUT_STATUSES.PAID
          ]
        ),
        db.execute(
          `
            SELECT COALESCE(SUM(ROUND(oi.line_total_kobo * ? / 100)), 0) AS total_revenue_kobo
            FROM order_items oi
            INNER JOIN orders o ON o.id = oi.order_id
            INNER JOIN (
              SELECT DISTINCT order_id
              FROM payments
              WHERE status = ?
                AND DATE(updated_at) BETWEEN ? AND ?
            ) paid_orders ON paid_orders.order_id = o.id
            WHERE o.status <> ?
              AND oi.item_status <> ?
          `,
          [
            filters.commissionRatePercent,
            PAYMENT_STATUSES.PAID,
            filters.currentPeriodDateFrom,
            filters.currentPeriodDateTo,
            ORDER_STATUSES.CANCELLED,
            ORDER_ITEM_STATUSES.CANCELLED
          ]
        ),
        db.execute(
          `
            SELECT COALESCE(SUM(ROUND(oi.line_total_kobo * ? / 100)), 0) AS total_revenue_kobo
            FROM order_items oi
            INNER JOIN orders o ON o.id = oi.order_id
            INNER JOIN (
              SELECT DISTINCT order_id
              FROM payments
              WHERE status = ?
                AND DATE(updated_at) BETWEEN ? AND ?
            ) paid_orders ON paid_orders.order_id = o.id
            WHERE o.status <> ?
              AND oi.item_status <> ?
          `,
          [
            filters.commissionRatePercent,
            PAYMENT_STATUSES.PAID,
            filters.previousPeriodDateFrom,
            filters.previousPeriodDateTo,
            ORDER_STATUSES.CANCELLED,
            ORDER_ITEM_STATUSES.CANCELLED
          ]
        ),
        db.execute(
          `
            SELECT COALESCE(SUM(o.total_kobo), 0) AS platform_gmv_kobo
            FROM orders o
            INNER JOIN (
              SELECT DISTINCT order_id
              FROM payments
              WHERE status = ?
                AND DATE(updated_at) BETWEEN ? AND ?
            ) paid_orders ON paid_orders.order_id = o.id
          `,
          [
            PAYMENT_STATUSES.PAID,
            filters.currentPeriodDateFrom,
            filters.currentPeriodDateTo
          ]
        ),
        db.execute(
          `
            SELECT COALESCE(SUM(o.total_kobo), 0) AS platform_gmv_kobo
            FROM orders o
            INNER JOIN (
              SELECT DISTINCT order_id
              FROM payments
              WHERE status = ?
                AND DATE(updated_at) BETWEEN ? AND ?
            ) paid_orders ON paid_orders.order_id = o.id
          `,
          [
            PAYMENT_STATUSES.PAID,
            filters.previousPeriodDateFrom,
            filters.previousPeriodDateTo
          ]
        ),
        db.execute(
          `
            SELECT COUNT(DISTINCT oi.seller_id) AS active_sellers_count
            FROM order_items oi
            INNER JOIN orders o ON o.id = oi.order_id
            INNER JOIN seller_profiles sp ON sp.id = oi.seller_id
            INNER JOIN users u ON u.id = sp.user_id
            INNER JOIN (
              SELECT DISTINCT order_id
              FROM payments
              WHERE status = ?
                AND DATE(updated_at) BETWEEN ? AND ?
            ) paid_orders ON paid_orders.order_id = o.id
            WHERE o.status <> ?
              AND oi.item_status <> ?
              AND u.account_status = ?
          `,
          [
            PAYMENT_STATUSES.PAID,
            filters.currentPeriodDateFrom,
            filters.currentPeriodDateTo,
            ORDER_STATUSES.CANCELLED,
            ORDER_ITEM_STATUSES.CANCELLED,
            USER_ACCOUNT_STATUSES.ACTIVE
          ]
        ),
        db.execute(
          `
            SELECT COUNT(DISTINCT oi.seller_id) AS active_sellers_count
            FROM order_items oi
            INNER JOIN orders o ON o.id = oi.order_id
            INNER JOIN seller_profiles sp ON sp.id = oi.seller_id
            INNER JOIN users u ON u.id = sp.user_id
            INNER JOIN (
              SELECT DISTINCT order_id
              FROM payments
              WHERE status = ?
                AND DATE(updated_at) BETWEEN ? AND ?
            ) paid_orders ON paid_orders.order_id = o.id
            WHERE o.status <> ?
              AND oi.item_status <> ?
              AND u.account_status = ?
          `,
          [
            PAYMENT_STATUSES.PAID,
            filters.previousPeriodDateFrom,
            filters.previousPeriodDateTo,
            ORDER_STATUSES.CANCELLED,
            ORDER_ITEM_STATUSES.CANCELLED,
            USER_ACCOUNT_STATUSES.ACTIVE
          ]
        ),
        db.execute(
          `
            SELECT COUNT(*) AS total_orders_count
            FROM orders
            WHERE DATE(created_at) = ?
          `,
          [filters.yesterdayDate]
        )
      ]);

      const summaryRow = summaryRows[0] || {};

      return {
        activeSellersCount: toNumber(summaryRow.active_sellers_count),
        ordersTodayCount: toNumber(summaryRow.orders_today_count),
        ordersYesterdayCount: toNumber(ordersYesterdayRows[0] && ordersYesterdayRows[0].total_orders_count),
        totalOrdersCount: toNumber(summaryRow.total_orders_count),
        platformGmvKobo: toNumber(summaryRow.platform_gmv_kobo),
        totalRevenueKobo: toNumber(summaryRow.total_revenue_kobo),
        openDisputesCount: toNumber(summaryRow.open_disputes_count),
        urgentOpenDisputesCount: toNumber(summaryRow.urgent_open_disputes_count),
        totalDisputesCount: toNumber(summaryRow.total_disputes_count),
        resolvedDisputesCount: toNumber(summaryRow.resolved_disputes_count),
        pendingVerificationsCount: toNumber(summaryRow.pending_verifications_count),
        verifiedSellersCount: toNumber(summaryRow.verified_sellers_count),
        rejectedSellersCount: toNumber(summaryRow.rejected_sellers_count),
        payoutRequestsCount: toNumber(summaryRow.payout_requests_count),
        payoutRequestsAmountKobo: toNumber(summaryRow.payout_requests_amount_kobo),
        failedPayoutsCount: toNumber(summaryRow.failed_payouts_count),
        totalPayoutsCount: toNumber(summaryRow.total_payouts_count),
        paidPayoutsCount: toNumber(summaryRow.paid_payouts_count),
        pendingPayoutQueueAmountKobo: toNumber(summaryRow.pending_payout_queue_amount_kobo),
        averagePayoutTimeDays: summaryRow.average_payout_time_days === null
          || summaryRow.average_payout_time_days === undefined
          ? null
          : Number(summaryRow.average_payout_time_days),
        currentRevenueKobo: toNumber(currentRevenueRows[0] && currentRevenueRows[0].total_revenue_kobo),
        previousRevenueKobo: toNumber(previousRevenueRows[0] && previousRevenueRows[0].total_revenue_kobo),
        currentPlatformGmvKobo: toNumber(currentGmvRows[0] && currentGmvRows[0].platform_gmv_kobo),
        previousPlatformGmvKobo: toNumber(previousGmvRows[0] && previousGmvRows[0].platform_gmv_kobo),
        currentActiveSellersCount: toNumber(
          currentActiveSellerRows[0] && currentActiveSellerRows[0].active_sellers_count
        ),
        previousActiveSellersCount: toNumber(
          previousActiveSellerRows[0] && previousActiveSellerRows[0].active_sellers_count
        )
      };
    },

    async listRecentOrders({ limit }) {
      const [countRows] = await db.execute(
        `
          SELECT COUNT(*) AS total
          FROM orders
        `
      );
      const [rows] = await db.execute(
        `
          SELECT
            o.id,
            o.status,
            o.payment_status,
            o.total_kobo,
            o.created_at,
            COUNT(DISTINCT oi.seller_id) AS seller_count,
            MIN(sp.business_name) AS primary_seller_business_name
          FROM orders o
          LEFT JOIN order_items oi ON oi.order_id = o.id
          LEFT JOIN seller_profiles sp ON sp.id = oi.seller_id
          GROUP BY
            o.id,
            o.status,
            o.payment_status,
            o.total_kobo,
            o.created_at
          ORDER BY o.created_at DESC, o.id DESC
          LIMIT ?
        `,
        [limit]
      );

      return {
        orders: rows.map(mapRecentOrderRow),
        total: toNumber(countRows[0] && countRows[0].total)
      };
    },

    async listTopSellers({ limit }) {
      const [countRows] = await db.execute(
        `
          SELECT COUNT(*) AS total
          FROM (
            SELECT oi.seller_id
            FROM order_items oi
            INNER JOIN orders o ON o.id = oi.order_id
            INNER JOIN seller_profiles sp ON sp.id = oi.seller_id
            INNER JOIN users u ON u.id = sp.user_id
            WHERE o.payment_status = ?
              AND o.status <> ?
              AND oi.item_status <> ?
              AND u.account_status = ?
            GROUP BY oi.seller_id
          ) ranked_sellers
        `,
        [
          PAYMENT_STATUSES.PAID,
          ORDER_STATUSES.CANCELLED,
          ORDER_ITEM_STATUSES.CANCELLED,
          USER_ACCOUNT_STATUSES.ACTIVE
        ]
      );
      const [rows] = await db.execute(
        `
          SELECT
            sp.id AS seller_id,
            sp.user_id,
            sp.business_name,
            u.full_name,
            u.email,
            u.phone,
            COUNT(DISTINCT o.id) AS total_orders,
            COALESCE(SUM(oi.quantity), 0) AS total_items,
            COALESCE(SUM(oi.line_total_kobo), 0) AS gross_sales_kobo
          FROM order_items oi
          INNER JOIN orders o ON o.id = oi.order_id
          INNER JOIN seller_profiles sp ON sp.id = oi.seller_id
          INNER JOIN users u ON u.id = sp.user_id
          WHERE o.payment_status = ?
            AND o.status <> ?
            AND oi.item_status <> ?
            AND u.account_status = ?
          GROUP BY
            sp.id,
            sp.user_id,
            sp.business_name,
            u.full_name,
            u.email,
            u.phone
          ORDER BY gross_sales_kobo DESC, total_orders DESC, sp.id ASC
          LIMIT ?
        `,
        [
          PAYMENT_STATUSES.PAID,
          ORDER_STATUSES.CANCELLED,
          ORDER_ITEM_STATUSES.CANCELLED,
          USER_ACCOUNT_STATUSES.ACTIVE,
          limit
        ]
      );

      return {
        sellers: rows.map(mapTopSellerRow),
        total: toNumber(countRows[0] && countRows[0].total)
      };
    },

    async listPayoutQueue({ limit }) {
      const [countRows] = await db.execute(
        `
          SELECT
            COUNT(*) AS total,
            COALESCE(SUM(amount_kobo), 0) AS pending_amount_kobo
          FROM payouts
          WHERE status IN (?, ?)
        `,
        [PAYOUT_STATUSES.REQUESTED, PAYOUT_STATUSES.APPROVED]
      );
      const [rows] = await db.execute(
        `
          SELECT
            p.id,
            p.seller_id,
            p.status,
            p.amount_kobo,
            p.requested_at,
            p.approved_at,
            sp.user_id,
            sp.business_name,
            u.full_name,
            u.email
          FROM payouts p
          INNER JOIN seller_profiles sp ON sp.id = p.seller_id
          INNER JOIN users u ON u.id = sp.user_id
          WHERE p.status IN (?, ?)
          ORDER BY p.requested_at DESC, p.id DESC
          LIMIT ?
        `,
        [PAYOUT_STATUSES.REQUESTED, PAYOUT_STATUSES.APPROVED, limit]
      );

      return {
        payouts: rows.map(mapPayoutQueueRow),
        total: toNumber(countRows[0] && countRows[0].total),
        pendingAmountKobo: toNumber(countRows[0] && countRows[0].pending_amount_kobo)
      };
    }
  };
}

module.exports = {
  createAdminDashboardRepository
};
