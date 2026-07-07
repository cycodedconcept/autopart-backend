const {
  ORDER_ITEM_STATUSES,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  PAYOUT_STATUSES
} = require('../config/constants');

const PAYOUT_HOLD_STATUSES = [
  PAYOUT_STATUSES.REQUESTED,
  PAYOUT_STATUSES.APPROVED,
  PAYOUT_STATUSES.PAID
];

function toNumber(value) {
  return value === null || value === undefined ? 0 : Number(value);
}

function mapSalesSummaryRow(row) {
  return {
    totalOrders: toNumber(row && row.total_orders),
    totalItems: toNumber(row && row.total_items),
    grossSalesKobo: toNumber(row && row.gross_sales_kobo),
    commissionKobo: toNumber(row && row.commission_kobo),
    netSalesKobo: toNumber(row && row.net_sales_kobo)
  };
}

function mapPayoutRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    sellerId: row.seller_id,
    grossAmountKobo: toNumber(row.gross_amount_kobo),
    commissionAmountKobo: toNumber(row.commission_amount_kobo),
    amountKobo: toNumber(row.amount_kobo),
    status: row.status,
    bankAccountRef: row.bank_account_ref,
    itemCount: toNumber(row.item_count),
    requestedAt: row.requested_at,
    settledAt: row.settled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapEligiblePayoutItemRow(row) {
  return {
    orderItemId: row.order_item_id,
    grossAmountKobo: toNumber(row.gross_amount_kobo),
    commissionAmountKobo: toNumber(row.commission_amount_kobo),
    netAmountKobo: toNumber(row.net_amount_kobo)
  };
}

function buildEligiblePayoutItemsQuery(options = {}) {
  const activePayoutStatusPlaceholders = PAYOUT_HOLD_STATUSES.map(() => '?').join(', ');
  const orderByClause = options.orderById ? 'ORDER BY oi.id ASC' : '';
  const forUpdateClause = options.forUpdate ? 'FOR UPDATE' : '';

  return `
    SELECT
      oi.id AS order_item_id,
      oi.line_total_kobo AS gross_amount_kobo,
      ROUND((oi.line_total_kobo * ?) / 100, 0) AS commission_amount_kobo,
      oi.line_total_kobo - ROUND((oi.line_total_kobo * ?) / 100, 0) AS net_amount_kobo
    FROM order_items oi
    INNER JOIN orders o ON o.id = oi.order_id
    INNER JOIN (
      SELECT
        order_id,
        MAX(updated_at) AS paid_at
      FROM payments
      WHERE status = ?
      GROUP BY order_id
    ) paid_payments ON paid_payments.order_id = o.id
    WHERE oi.seller_id = ?
      AND o.payment_status = ?
      AND o.status <> ?
      AND oi.item_status <> ?
      AND NOT EXISTS (
        SELECT 1
        FROM payout_items pi
        INNER JOIN payouts p ON p.id = pi.payout_id
        WHERE pi.order_item_id = oi.id
          AND p.status IN (${activePayoutStatusPlaceholders})
      )
    ${orderByClause}
    ${forUpdateClause}
  `;
}

async function findPayoutByIdWithConnection(connection, payoutId, sellerId) {
  const [rows] = await connection.execute(
    `
      SELECT
        p.id,
        p.seller_id,
        p.gross_amount_kobo,
        p.commission_amount_kobo,
        p.amount_kobo,
        p.status,
        p.bank_account_ref,
        p.requested_at,
        p.settled_at,
        p.created_at,
        p.updated_at,
        (
          SELECT COUNT(*)
          FROM payout_items pi
          WHERE pi.payout_id = p.id
        ) AS item_count
      FROM payouts p
      WHERE p.id = ? AND p.seller_id = ?
      LIMIT 1
    `,
    [payoutId, sellerId]
  );

  return mapPayoutRow(rows[0]);
}

function createSellerFinanceRepository({ db }) {
  return {
    async getSellerSalesSummary({ commissionRatePercent, dateFrom, dateTo, sellerId }) {
      const [rows] = await db.execute(
        `
          SELECT
            COUNT(DISTINCT o.id) AS total_orders,
            COALESCE(SUM(oi.quantity), 0) AS total_items,
            COALESCE(SUM(oi.line_total_kobo), 0) AS gross_sales_kobo,
            COALESCE(SUM(ROUND((oi.line_total_kobo * ?) / 100, 0)), 0) AS commission_kobo,
            COALESCE(
              SUM(oi.line_total_kobo - ROUND((oi.line_total_kobo * ?) / 100, 0)),
              0
            ) AS net_sales_kobo
          FROM order_items oi
          INNER JOIN orders o ON o.id = oi.order_id
          INNER JOIN (
            SELECT
              order_id,
              MAX(updated_at) AS paid_at
            FROM payments
            WHERE status = ?
            GROUP BY order_id
          ) paid_payments ON paid_payments.order_id = o.id
          WHERE oi.seller_id = ?
            AND o.payment_status = ?
            AND o.status <> ?
            AND oi.item_status <> ?
            AND paid_payments.paid_at >= ?
            AND paid_payments.paid_at < DATE_ADD(?, INTERVAL 1 DAY)
        `,
        [
          commissionRatePercent,
          commissionRatePercent,
          PAYMENT_STATUSES.PAID,
          sellerId,
          PAYMENT_STATUSES.PAID,
          ORDER_STATUSES.CANCELLED,
          ORDER_ITEM_STATUSES.CANCELLED,
          dateFrom,
          dateTo
        ]
      );

      return mapSalesSummaryRow(rows[0]);
    },

    async summarizeSellerPayoutBalances({ commissionRatePercent, sellerId }) {
      const [statusRows] = await db.execute(
        `
          SELECT
            status,
            COALESCE(SUM(amount_kobo), 0) AS total_amount_kobo
          FROM payouts
          WHERE seller_id = ?
          GROUP BY status
        `,
        [sellerId]
      );
      const [pendingRows] = await db.execute(
        `
          SELECT
            COALESCE(SUM(eligible.net_amount_kobo), 0) AS pending_kobo
          FROM (
            ${buildEligiblePayoutItemsQuery()}
          ) AS eligible
        `,
        [
          commissionRatePercent,
          commissionRatePercent,
          PAYMENT_STATUSES.PAID,
          sellerId,
          PAYMENT_STATUSES.PAID,
          ORDER_STATUSES.CANCELLED,
          ORDER_ITEM_STATUSES.CANCELLED,
          ...PAYOUT_HOLD_STATUSES
        ]
      );
      const byStatus = new Map(
        statusRows.map((row) => [row.status, toNumber(row.total_amount_kobo)])
      );

      return {
        pendingKobo: toNumber(pendingRows[0] && pendingRows[0].pending_kobo),
        requestedKobo: byStatus.get(PAYOUT_STATUSES.REQUESTED) || 0,
        approvedKobo: byStatus.get(PAYOUT_STATUSES.APPROVED) || 0,
        paidKobo: byStatus.get(PAYOUT_STATUSES.PAID) || 0
      };
    },

    async createSellerPayoutRequest({ bankAccountRef, commissionRatePercent, sellerId }) {
      const connection = await db.getConnection();

      try {
        await connection.beginTransaction();

        const [eligibleRows] = await connection.execute(
          buildEligiblePayoutItemsQuery({
            orderById: true,
            forUpdate: true
          }),
          [
            commissionRatePercent,
            commissionRatePercent,
            PAYMENT_STATUSES.PAID,
            sellerId,
            PAYMENT_STATUSES.PAID,
            ORDER_STATUSES.CANCELLED,
            ORDER_ITEM_STATUSES.CANCELLED,
            ...PAYOUT_HOLD_STATUSES
          ]
        );

        if (!eligibleRows.length) {
          await connection.rollback();
          return null;
        }

        const eligibleItems = eligibleRows.map(mapEligiblePayoutItemRow);
        const totals = eligibleItems.reduce((accumulator, item) => ({
          grossAmountKobo: accumulator.grossAmountKobo + item.grossAmountKobo,
          commissionAmountKobo: accumulator.commissionAmountKobo + item.commissionAmountKobo,
          amountKobo: accumulator.amountKobo + item.netAmountKobo
        }), {
          grossAmountKobo: 0,
          commissionAmountKobo: 0,
          amountKobo: 0
        });
        const [payoutResult] = await connection.execute(
          `
            INSERT INTO payouts (
              seller_id,
              gross_amount_kobo,
              commission_amount_kobo,
              amount_kobo,
              status,
              bank_account_ref
            )
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          [
            sellerId,
            totals.grossAmountKobo,
            totals.commissionAmountKobo,
            totals.amountKobo,
            PAYOUT_STATUSES.REQUESTED,
            bankAccountRef
          ]
        );

        for (const item of eligibleItems) {
          await connection.execute(
            `
              INSERT INTO payout_items (
                payout_id,
                order_item_id,
                gross_amount_kobo,
                commission_amount_kobo,
                net_amount_kobo
              )
              VALUES (?, ?, ?, ?, ?)
            `,
            [
              payoutResult.insertId,
              item.orderItemId,
              item.grossAmountKobo,
              item.commissionAmountKobo,
              item.netAmountKobo
            ]
          );
        }

        const payout = await findPayoutByIdWithConnection(connection, payoutResult.insertId, sellerId);
        await connection.commit();

        return payout;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async listSellerPayouts({ limit, offset, sellerId, status }) {
      const filters = [sellerId];
      let statusClause = '';

      if (status) {
        statusClause = 'AND p.status = ?';
        filters.push(status);
      }

      const [countRows] = await db.execute(
        `
          SELECT COUNT(*) AS total
          FROM payouts p
          WHERE p.seller_id = ?
          ${statusClause}
        `,
        filters
      );
      const [rows] = await db.execute(
        `
          SELECT
            p.id,
            p.seller_id,
            p.gross_amount_kobo,
            p.commission_amount_kobo,
            p.amount_kobo,
            p.status,
            p.bank_account_ref,
            p.requested_at,
            p.settled_at,
            p.created_at,
            p.updated_at,
            (
              SELECT COUNT(*)
              FROM payout_items pi
              WHERE pi.payout_id = p.id
            ) AS item_count
          FROM payouts p
          WHERE p.seller_id = ?
          ${statusClause}
          ORDER BY p.requested_at DESC, p.id DESC
          LIMIT ? OFFSET ?
        `,
        [...filters, limit, offset]
      );

      return {
        payouts: rows.map(mapPayoutRow),
        total: toNumber(countRows[0] && countRows[0].total)
      };
    }
  };
}

module.exports = {
  createSellerFinanceRepository
};
