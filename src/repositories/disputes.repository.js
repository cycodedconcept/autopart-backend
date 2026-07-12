function toNumber(value) {
  return value === null || value === undefined ? null : Number(value);
}

function mapDisputeSellerSummary(row, prefix = 'seller') {
  const sellerId = toNumber(row[`${prefix}_id`]);

  if (!sellerId) {
    return null;
  }

  return {
    id: sellerId,
    userId: toNumber(row[`${prefix}_user_id`]),
    businessName: row[`${prefix}_business_name`],
    contactEmail: row[`${prefix}_contact_email`],
    contactPhone: row[`${prefix}_contact_phone`],
    fullName: row[`${prefix}_full_name`],
    email: row[`${prefix}_email`],
    phone: row[`${prefix}_phone`]
  };
}

function mapDisputeRow(row, sellers = []) {
  if (!row) {
    return null;
  }

  return {
    id: toNumber(row.id),
    orderId: toNumber(row.order_id),
    raisedBy: row.raised_by,
    reason: row.reason,
    status: row.status,
    resolutionNote: row.resolution_note,
    refundReference: row.refund_reference,
    refundAmountKobo: toNumber(row.refund_amount_kobo),
    resolvedBy: toNumber(row.resolved_by),
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    order: {
      id: toNumber(row.order_id),
      status: row.order_status,
      paymentMethod: row.payment_method,
      paymentReference: row.payment_reference,
      paymentStatus: row.payment_status,
      totalKobo: toNumber(row.total_kobo),
      createdAt: row.order_created_at,
      updatedAt: row.order_updated_at
    },
    buyer: {
      id: toNumber(row.buyer_id),
      fullName: row.buyer_full_name,
      email: row.buyer_email,
      phone: row.buyer_phone
    },
    raisedBySeller: mapDisputeSellerSummary(row, 'raised_seller'),
    resolvedByAdmin: row.resolved_admin_id
      ? {
        id: toNumber(row.resolved_admin_id),
        fullName: row.resolved_admin_full_name,
        email: row.resolved_admin_email
      }
      : null,
    sellers
  };
}

function groupSellersByOrderId(rows) {
  return rows.reduce((accumulator, row) => {
    const existingSellers = accumulator.get(row.order_id) || [];

    existingSellers.push(mapDisputeSellerSummary(row));
    accumulator.set(row.order_id, existingSellers);

    return accumulator;
  }, new Map());
}

async function findOrderSellersByOrderIdsWithExecutor(executor, orderIds) {
  if (!orderIds.length) {
    return new Map();
  }

  const placeholders = orderIds.map(() => '?').join(', ');
  const [rows] = await executor.execute(
    `
      SELECT DISTINCT
        oi.order_id,
        sp.id AS seller_id,
        sp.user_id AS seller_user_id,
        sp.business_name AS seller_business_name,
        sp.contact_email AS seller_contact_email,
        sp.contact_phone AS seller_contact_phone,
        u.full_name AS seller_full_name,
        u.email AS seller_email,
        u.phone AS seller_phone
      FROM order_items oi
      INNER JOIN seller_profiles sp ON sp.id = oi.seller_id
      INNER JOIN users u ON u.id = sp.user_id
      WHERE oi.order_id IN (${placeholders})
      ORDER BY oi.order_id ASC, sp.id ASC
    `,
    orderIds
  );

  return groupSellersByOrderId(rows);
}

function buildDisputeFilters(filters = {}) {
  const whereClauses = [];
  const params = [];

  if (filters.status && filters.status !== 'all') {
    whereClauses.push('d.status = ?');
    params.push(filters.status);
  }

  if (filters.raisedBy && filters.raisedBy !== 'all') {
    whereClauses.push('d.raised_by = ?');
    params.push(filters.raisedBy);
  }

  if (filters.search) {
    const normalizedSearch = `%${filters.search.trim().toLowerCase()}%`;

    whereClauses.push(`
      (
        CAST(d.id AS CHAR) LIKE ?
        OR CAST(d.order_id AS CHAR) LIKE ?
        OR LOWER(COALESCE(o.payment_reference, '')) LIKE ?
        OR LOWER(COALESCE(buyer.full_name, '')) LIKE ?
        OR LOWER(COALESCE(buyer.email, '')) LIKE ?
        OR LOWER(COALESCE(buyer.phone, '')) LIKE ?
        OR LOWER(COALESCE(d.reason, '')) LIKE ?
      )
    `);
    params.push(
      normalizedSearch,
      normalizedSearch,
      normalizedSearch,
      normalizedSearch,
      normalizedSearch,
      normalizedSearch,
      normalizedSearch
    );
  }

  return {
    whereSql: whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '',
    params
  };
}

async function findDisputeByIdWithExecutor(executor, disputeId) {
  const [rows] = await executor.execute(
    `
      SELECT
        d.id,
        d.order_id,
        d.seller_id,
        d.raised_by,
        d.reason,
        d.status,
        d.resolution_note,
        d.refund_reference,
        d.refund_amount_kobo,
        d.resolved_by,
        d.resolved_at,
        d.created_at,
        d.updated_at,
        o.status AS order_status,
        o.payment_method,
        o.payment_reference,
        o.payment_status,
        o.total_kobo,
        o.created_at AS order_created_at,
        o.updated_at AS order_updated_at,
        buyer.id AS buyer_id,
        buyer.full_name AS buyer_full_name,
        buyer.email AS buyer_email,
        buyer.phone AS buyer_phone,
        raised_seller.id AS raised_seller_id,
        raised_seller.user_id AS raised_seller_user_id,
        raised_seller.business_name AS raised_seller_business_name,
        raised_seller.contact_email AS raised_seller_contact_email,
        raised_seller.contact_phone AS raised_seller_contact_phone,
        raised_seller_user.full_name AS raised_seller_full_name,
        raised_seller_user.email AS raised_seller_email,
        raised_seller_user.phone AS raised_seller_phone,
        resolved_admin.id AS resolved_admin_id,
        resolved_admin.full_name AS resolved_admin_full_name,
        resolved_admin.email AS resolved_admin_email
      FROM disputes d
      INNER JOIN orders o ON o.id = d.order_id
      INNER JOIN users buyer ON buyer.id = o.buyer_id
      LEFT JOIN seller_profiles raised_seller ON raised_seller.id = d.seller_id
      LEFT JOIN users raised_seller_user ON raised_seller_user.id = raised_seller.user_id
      LEFT JOIN admins resolved_admin ON resolved_admin.id = d.resolved_by
      WHERE d.id = ?
      LIMIT 1
    `,
    [disputeId]
  );

  if (!rows[0]) {
    return null;
  }

  const sellersByOrderId = await findOrderSellersByOrderIdsWithExecutor(executor, [rows[0].order_id]);

  return mapDisputeRow(rows[0], sellersByOrderId.get(rows[0].order_id) || []);
}

function createDisputesRepository({ db }) {
  return {
    async createDispute(payload) {
      const [result] = await db.execute(
        `
          INSERT INTO disputes (
            order_id,
            seller_id,
            raised_by,
            reason,
            status
          )
          VALUES (?, ?, ?, ?, ?)
        `,
        [
          payload.orderId,
          payload.sellerId || null,
          payload.raisedBy,
          payload.reason,
          payload.status || 'open'
        ]
      );

      return this.findDisputeByIdForAdmin(result.insertId);
    },

    async listDisputesForAdmin(filters) {
      const disputeFilters = buildDisputeFilters(filters);
      const [countRows] = await db.execute(
        `
          SELECT COUNT(*) AS total
          FROM disputes d
          INNER JOIN orders o ON o.id = d.order_id
          INNER JOIN users buyer ON buyer.id = o.buyer_id
          ${disputeFilters.whereSql}
        `,
        disputeFilters.params
      );
      const [rows] = await db.execute(
        `
          SELECT
            d.id,
            d.order_id,
            d.seller_id,
            d.raised_by,
            d.reason,
            d.status,
            d.resolution_note,
            d.refund_reference,
            d.refund_amount_kobo,
            d.resolved_by,
            d.resolved_at,
            d.created_at,
            d.updated_at,
            o.status AS order_status,
            o.payment_method,
            o.payment_reference,
            o.payment_status,
            o.total_kobo,
            o.created_at AS order_created_at,
            o.updated_at AS order_updated_at,
            buyer.id AS buyer_id,
            buyer.full_name AS buyer_full_name,
            buyer.email AS buyer_email,
            buyer.phone AS buyer_phone,
            raised_seller.id AS raised_seller_id,
            raised_seller.user_id AS raised_seller_user_id,
            raised_seller.business_name AS raised_seller_business_name,
            raised_seller.contact_email AS raised_seller_contact_email,
            raised_seller.contact_phone AS raised_seller_contact_phone,
            raised_seller_user.full_name AS raised_seller_full_name,
            raised_seller_user.email AS raised_seller_email,
            raised_seller_user.phone AS raised_seller_phone,
            resolved_admin.id AS resolved_admin_id,
            resolved_admin.full_name AS resolved_admin_full_name,
            resolved_admin.email AS resolved_admin_email
          FROM disputes d
          INNER JOIN orders o ON o.id = d.order_id
          INNER JOIN users buyer ON buyer.id = o.buyer_id
          LEFT JOIN seller_profiles raised_seller ON raised_seller.id = d.seller_id
          LEFT JOIN users raised_seller_user ON raised_seller_user.id = raised_seller.user_id
          LEFT JOIN admins resolved_admin ON resolved_admin.id = d.resolved_by
          ${disputeFilters.whereSql}
          ORDER BY d.created_at DESC, d.id DESC
          LIMIT ? OFFSET ?
        `,
        [...disputeFilters.params, filters.limit, filters.offset]
      );
      const orderIds = rows.map((row) => row.order_id);
      const sellersByOrderId = await findOrderSellersByOrderIdsWithExecutor(db, orderIds);

      return {
        disputes: rows.map((row) => mapDisputeRow(row, sellersByOrderId.get(row.order_id) || [])),
        total: Number((countRows[0] && countRows[0].total) || 0)
      };
    },

    async findDisputeByIdForAdmin(disputeId) {
      const connection = await db.getConnection();

      try {
        return await findDisputeByIdWithExecutor(connection, disputeId);
      } finally {
        connection.release();
      }
    },

    async updateDisputeDecision({
      adminId,
      disputeId,
      refundAmountKobo,
      refundReference,
      resolutionNote,
      status
    }) {
      const connection = await db.getConnection();

      try {
        await connection.beginTransaction();

        await connection.execute(
          `
            UPDATE disputes
            SET
              status = ?,
              resolution_note = ?,
              refund_reference = ?,
              refund_amount_kobo = ?,
              resolved_by = ?,
              resolved_at = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          [
            status,
            resolutionNote,
            refundReference || null,
            refundAmountKobo === undefined ? null : refundAmountKobo,
            adminId,
            new Date(),
            disputeId
          ]
        );

        const dispute = await findDisputeByIdWithExecutor(connection, disputeId);
        await connection.commit();

        return dispute;
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
  createDisputesRepository
};
