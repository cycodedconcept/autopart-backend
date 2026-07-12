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

function mapRevenueTrendRow(row) {
  return {
    currentGrossSalesKobo: toNumber(row && row.current_gross_sales_kobo),
    previousGrossSalesKobo: toNumber(row && row.previous_gross_sales_kobo)
  };
}

function mapRevenueTimelineRow(row) {
  return {
    monthNumber: toNumber(row && row.month_number),
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
    approvedBy: row.approved_by === null || row.approved_by === undefined
      ? null
      : Number(row.approved_by),
    approvedAt: row.approved_at,
    rejectionReason: row.rejection_reason,
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

function mapAdminPayoutItemRow(row) {
  return {
    id: row.id,
    payoutId: row.payout_id,
    orderItemId: row.order_item_id,
    orderId: row.order_id,
    productId: row.product_id,
    quantity: toNumber(row.quantity),
    grossAmountKobo: toNumber(row.gross_amount_kobo),
    commissionAmountKobo: toNumber(row.commission_amount_kobo),
    netAmountKobo: toNumber(row.net_amount_kobo),
    orderStatus: row.order_status,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapAdminPayoutRow(row, items = []) {
  if (!row) {
    return null;
  }

  return {
    ...mapPayoutRow(row),
    seller: {
      id: row.seller_id,
      userId: toNumber(row.user_id),
      businessName: row.business_name,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      fullName: row.full_name,
      email: row.email,
      phone: row.phone
    },
    items
  };
}

function groupPayoutItemsByPayoutId(rows) {
  return rows.reduce((accumulator, row) => {
    const existingItems = accumulator.get(row.payout_id) || [];

    existingItems.push(mapAdminPayoutItemRow(row));
    accumulator.set(row.payout_id, existingItems);

    return accumulator;
  }, new Map());
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

async function findPayoutItemsByPayoutIdsWithConnection(connection, payoutIds) {
  if (!payoutIds.length) {
    return new Map();
  }

  const placeholders = payoutIds.map(() => '?').join(', ');
  const [rows] = await connection.execute(
    `
      SELECT
        pi.id,
        pi.payout_id,
        pi.order_item_id,
        oi.order_id,
        oi.product_id,
        oi.quantity,
        pi.gross_amount_kobo,
        pi.commission_amount_kobo,
        pi.net_amount_kobo,
        o.status AS order_status,
        paid_payments.paid_at,
        pi.created_at,
        pi.updated_at
      FROM payout_items pi
      INNER JOIN order_items oi ON oi.id = pi.order_item_id
      INNER JOIN orders o ON o.id = oi.order_id
      LEFT JOIN (
        SELECT
          order_id,
          MAX(updated_at) AS paid_at
        FROM payments
        WHERE status = ?
        GROUP BY order_id
      ) paid_payments ON paid_payments.order_id = o.id
      WHERE pi.payout_id IN (${placeholders})
      ORDER BY pi.payout_id ASC, pi.id ASC
    `,
    [PAYMENT_STATUSES.PAID, ...payoutIds]
  );

  return groupPayoutItemsByPayoutId(rows);
}

async function findPayoutByIdForAdminWithConnection(connection, payoutId) {
  const [rows] = await connection.execute(
    `
      SELECT
        p.id,
        p.seller_id,
        p.gross_amount_kobo,
        p.commission_amount_kobo,
        p.amount_kobo,
        p.status,
        p.approved_by,
        p.approved_at,
        p.rejection_reason,
        p.bank_account_ref,
        p.requested_at,
        p.settled_at,
        p.created_at,
        p.updated_at,
        (
          SELECT COUNT(*)
          FROM payout_items pi
          WHERE pi.payout_id = p.id
        ) AS item_count,
        sp.user_id,
        sp.business_name,
        sp.contact_email,
        sp.contact_phone,
        u.full_name,
        u.email,
        u.phone
      FROM payouts p
      INNER JOIN seller_profiles sp ON sp.id = p.seller_id
      INNER JOIN users u ON u.id = sp.user_id
      WHERE p.id = ?
      LIMIT 1
    `,
    [payoutId]
  );

  if (!rows[0]) {
    return null;
  }

  const itemsByPayoutId = await findPayoutItemsByPayoutIdsWithConnection(connection, [payoutId]);

  return mapAdminPayoutRow(rows[0], itemsByPayoutId.get(rows[0].id) || []);
}

function buildAdminPayoutFilters({ search, sellerId, status }) {
  const clauses = [];
  const params = [];

  if (status && status !== 'all') {
    clauses.push('p.status = ?');
    params.push(status);
  }

  if (sellerId) {
    clauses.push('p.seller_id = ?');
    params.push(sellerId);
  }

  if (search) {
    clauses.push(`(
      sp.business_name LIKE ?
      OR u.full_name LIKE ?
      OR u.email LIKE ?
      OR p.bank_account_ref LIKE ?
    )`);
    const searchPattern = `%${search}%`;

    params.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }

  return {
    clause: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params
  };
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

    async getSellerRevenueTrend({
      currentDateFrom,
      currentDateTo,
      previousDateFrom,
      previousDateTo,
      sellerId
    }) {
      const [rows] = await db.execute(
        `
          SELECT
            COALESCE(
              SUM(
                CASE
                  WHEN paid_payments.paid_at >= ?
                    AND paid_payments.paid_at < DATE_ADD(?, INTERVAL 1 DAY)
                  THEN oi.line_total_kobo
                  ELSE 0
                END
              ),
              0
            ) AS current_gross_sales_kobo,
            COALESCE(
              SUM(
                CASE
                  WHEN paid_payments.paid_at >= ?
                    AND paid_payments.paid_at < DATE_ADD(?, INTERVAL 1 DAY)
                  THEN oi.line_total_kobo
                  ELSE 0
                END
              ),
              0
            ) AS previous_gross_sales_kobo
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
        `,
        [
          currentDateFrom,
          currentDateTo,
          previousDateFrom,
          previousDateTo,
          PAYMENT_STATUSES.PAID,
          sellerId,
          PAYMENT_STATUSES.PAID,
          ORDER_STATUSES.CANCELLED,
          ORDER_ITEM_STATUSES.CANCELLED
        ]
      );

      return mapRevenueTrendRow(rows[0]);
    },

    async getSellerRevenueTimeline({ commissionRatePercent, sellerId, year }) {
      const [rows] = await db.execute(
        `
          SELECT
            MONTH(paid_payments.paid_at) AS month_number,
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
            AND YEAR(paid_payments.paid_at) = ?
          GROUP BY MONTH(paid_payments.paid_at)
          ORDER BY month_number ASC
        `,
        [
          commissionRatePercent,
          commissionRatePercent,
          PAYMENT_STATUSES.PAID,
          sellerId,
          PAYMENT_STATUSES.PAID,
          ORDER_STATUSES.CANCELLED,
          ORDER_ITEM_STATUSES.CANCELLED,
          year
        ]
      );

      return rows.map(mapRevenueTimelineRow);
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
    },

    async listPayoutsForAdmin({ limit, offset, search, sellerId, status }) {
      const filters = buildAdminPayoutFilters({
        status,
        sellerId,
        search
      });
      const [countRows] = await db.execute(
        `
          SELECT COUNT(*) AS total
          FROM payouts p
          INNER JOIN seller_profiles sp ON sp.id = p.seller_id
          INNER JOIN users u ON u.id = sp.user_id
          ${filters.clause}
        `,
        filters.params
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
            p.approved_by,
            p.approved_at,
            p.rejection_reason,
            p.bank_account_ref,
            p.requested_at,
            p.settled_at,
            p.created_at,
            p.updated_at,
            (
              SELECT COUNT(*)
              FROM payout_items pi
              WHERE pi.payout_id = p.id
            ) AS item_count,
            sp.user_id,
            sp.business_name,
            sp.contact_email,
            sp.contact_phone,
            u.full_name,
            u.email,
            u.phone
          FROM payouts p
          INNER JOIN seller_profiles sp ON sp.id = p.seller_id
          INNER JOIN users u ON u.id = sp.user_id
          ${filters.clause}
          ORDER BY p.requested_at DESC, p.id DESC
          LIMIT ? OFFSET ?
        `,
        [...filters.params, limit, offset]
      );
      const payoutIds = rows.map((row) => row.id);
      const itemsByPayoutId = await findPayoutItemsByPayoutIdsWithConnection(db, payoutIds);

      return {
        payouts: rows.map((row) => mapAdminPayoutRow(row, itemsByPayoutId.get(row.id) || [])),
        total: toNumber(countRows[0] && countRows[0].total)
      };
    },

    async findPayoutByIdForAdmin(payoutId) {
      return findPayoutByIdForAdminWithConnection(db, payoutId);
    },

    async updatePayoutStatusForAdmin({ adminId, payoutId, rejectionReason, status }) {
      const connection = await db.getConnection();

      try {
        await connection.beginTransaction();

        const existingPayout = await findPayoutByIdForAdminWithConnection(connection, payoutId);

        if (!existingPayout) {
          await connection.rollback();
          return null;
        }

        const approvedBy = status === PAYOUT_STATUSES.APPROVED
          ? Number(adminId)
          : status === PAYOUT_STATUSES.REJECTED
            ? null
            : existingPayout.approvedBy;
        const approvedAt = status === PAYOUT_STATUSES.APPROVED
          ? new Date()
          : status === PAYOUT_STATUSES.REJECTED
            ? null
            : existingPayout.approvedAt;
        const settledAt = status === PAYOUT_STATUSES.PAID
          ? new Date()
          : existingPayout.settledAt;

        await connection.execute(
          `
            UPDATE payouts
            SET
              status = ?,
              approved_by = ?,
              approved_at = ?,
              rejection_reason = ?,
              settled_at = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          [
            status,
            approvedBy,
            approvedAt,
            status === PAYOUT_STATUSES.REJECTED ? rejectionReason : null,
            settledAt,
            payoutId
          ]
        );

        const updatedPayout = await findPayoutByIdForAdminWithConnection(connection, payoutId);
        await connection.commit();

        return updatedPayout;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
  };
}

module.exports = {
  createSellerFinanceRepository
};
