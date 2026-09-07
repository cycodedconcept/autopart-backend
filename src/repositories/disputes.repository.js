const { sanitizeLimitOffset } = require('./pagination.repository');
const { epochIso, jsonValue } = require('../utils/admin-reporting');
const AppError = require('../utils/app-error');
const { ERROR_CODES } = require('../config/constants');

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
    sellerId: toNumber(row.seller_id),
    description: row.description || null,
    buyerEvidenceSummary: row.buyer_evidence_summary || null,
    sellerEvidenceSummary: row.seller_evidence_summary || null,
    closedAt: epochIso(row.closed_epoch),
    raisedBy: row.raised_by,
    reason: row.reason,
    status: row.status,
    resolutionNote: row.resolution_note,
    refundReference: row.refund_reference,
    refundAmountKobo: toNumber(row.refund_amount_kobo),
    resolvedBy: toNumber(row.resolved_by),
    resolvedAt: epochIso(row.resolved_epoch),
    createdAt: epochIso(row.created_epoch),
    updatedAt: epochIso(row.updated_epoch),
    order: {
      id: toNumber(row.order_id),
      status: row.order_status,
      paymentMethod: row.payment_method,
      paymentReference: row.payment_reference,
      paymentStatus: row.payment_status,
      totalKobo: toNumber(row.total_kobo),
      createdAt: epochIso(row.order_created_epoch),
      updatedAt: epochIso(row.order_updated_epoch)
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

  if (filters.sellerId) {
    whereClauses.push(`(d.seller_id = ? OR (d.seller_id IS NULL AND EXISTS (
      SELECT 1 FROM order_items filter_item WHERE filter_item.order_id = d.order_id AND filter_item.seller_id = ?
    )))`);
    params.push(filters.sellerId, filters.sellerId);
  }
  if (filters.dateFrom) {
    whereClauses.push('d.created_at >= FROM_UNIXTIME(?)');
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    whereClauses.push('d.created_at < FROM_UNIXTIME(?)');
    params.push(filters.dateTo);
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
        d.description, d.buyer_evidence_summary, d.seller_evidence_summary,
        UNIX_TIMESTAMP(d.closed_at) AS closed_epoch,
        UNIX_TIMESTAMP(d.resolved_at) AS resolved_epoch,
        UNIX_TIMESTAMP(d.created_at) AS created_epoch,
        UNIX_TIMESTAMP(d.updated_at) AS updated_epoch,
        UNIX_TIMESTAMP(o.created_at) AS order_created_epoch,
        UNIX_TIMESTAMP(o.updated_at) AS order_updated_epoch,
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
      const pagination = sanitizeLimitOffset(filters);
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
            UNIX_TIMESTAMP(d.closed_at) AS closed_epoch,
            UNIX_TIMESTAMP(d.resolved_at) AS resolved_epoch,
            UNIX_TIMESTAMP(d.created_at) AS created_epoch,
            UNIX_TIMESTAMP(d.updated_at) AS updated_epoch,
            UNIX_TIMESTAMP(o.created_at) AS order_created_epoch,
            UNIX_TIMESTAMP(o.updated_at) AS order_updated_epoch,
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
          LIMIT ${pagination.limit} OFFSET ${pagination.offset}
        `,
        disputeFilters.params
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

    async getDisputeStats() {
      const [rows] = await db.execute(`SELECT COUNT(*) AS total,
        COALESCE(SUM(status = 'open'), 0) AS open,
        COALESCE(SUM(status = 'in_review'), 0) AS inReview,
        COALESCE(SUM(status = 'escalated'), 0) AS escalated,
        COALESCE(SUM(status = 'resolved'), 0) AS resolved FROM disputes`);
      return Object.fromEntries(Object.entries(rows[0]).map(([key, value]) => [key, Number(value)]));
    },

    async findDisputeEvidenceAndTimeline(disputeId) {
      const [attachments] = await db.execute(`SELECT id, submitted_by, url, filename,
        UNIX_TIMESTAMP(uploaded_at) AS uploaded_epoch FROM dispute_attachments
        WHERE dispute_id = ? ORDER BY uploaded_at, id`, [disputeId]);
      const [events] = await db.execute(`SELECT e.id, e.event_type, e.admin_id, e.actor_user_id, e.detail,
        UNIX_TIMESTAMP(e.created_at) AS created_epoch, COALESCE(a.full_name, u.full_name) AS actor_name
        FROM dispute_events e LEFT JOIN admins a ON a.id = e.admin_id
        LEFT JOIN users u ON u.id = e.actor_user_id
        WHERE e.dispute_id = ? ORDER BY e.created_at, e.id`, [disputeId]);
      const [items] = await db.execute(`SELECT oi.id, oi.quantity, p.title AS part_name
        FROM order_items oi INNER JOIN products p ON p.id = oi.product_id
        INNER JOIN disputes d ON d.order_id = oi.order_id WHERE d.id = ? ORDER BY oi.id`, [disputeId]);
      const [rulings] = await db.execute(`SELECT id, admin_id, decision, notes, partial_amount_kobo,
        require_reverse_logistics, UNIX_TIMESTAMP(created_at) AS created_epoch
        FROM dispute_rulings WHERE dispute_id = ?`, [disputeId]);
      return {
        attachments: attachments.map((row) => ({ id: Number(row.id), submittedBy: row.submitted_by,
          url: row.url, filename: row.filename, uploadedAt: epochIso(row.uploaded_epoch) })),
        timeline: events.map((row) => ({ id: Number(row.id), event: row.event_type,
          actor: { id: toNumber(row.admin_id || row.actor_user_id),
            type: row.admin_id ? 'admin' : row.actor_user_id ? 'user' : 'unknown', name: row.actor_name },
          timestamp: epochIso(row.created_epoch), detail: jsonValue(row.detail, null) })),
        items: items.map((row) => ({ id: Number(row.id), partName: row.part_name, quantity: Number(row.quantity) })),
        ruling: rulings.length ? {
          id: Number(rulings[0].id), adminId: Number(rulings[0].admin_id), decision: rulings[0].decision,
          notes: rulings[0].notes, partialAmountKobo: toNumber(rulings[0].partial_amount_kobo),
          requireReverseLogistics: Boolean(rulings[0].require_reverse_logistics),
          createdAt: epochIso(rulings[0].created_epoch)
        } : null
      };
    },

    async withLockedDispute(disputeId, callback) {
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        await connection.execute('SELECT id FROM disputes WHERE id = ? FOR UPDATE', [disputeId]);
        const dispute = await findDisputeByIdWithExecutor(connection, disputeId);
        const result = await callback({
          dispute,
          executor: connection,
          async recordAction({ adminId, event, nextStatus, detail, ruling }) {
            // Also covers disputes inserted by legacy integrations after migration 040.
            await connection.execute(`INSERT INTO dispute_events (dispute_id, event_type, actor_user_id, detail, created_at)
              SELECT d.id, 'opened', CASE WHEN d.raised_by = 'buyer' THEN o.buyer_id ELSE sp.user_id END,
                JSON_OBJECT('raisedBy', d.raised_by), d.created_at
              FROM disputes d INNER JOIN orders o ON o.id = d.order_id
              LEFT JOIN seller_profiles sp ON sp.id = d.seller_id
              WHERE d.id = ? AND NOT EXISTS (SELECT 1 FROM dispute_events e WHERE e.dispute_id = d.id AND e.event_type = 'opened')`,
            [disputeId]);
            await connection.execute(`UPDATE disputes SET status = ?,
              resolution_note = CASE WHEN ? = 'resolved' THEN ? ELSE resolution_note END,
              resolved_by = CASE WHEN ? = 'resolved' THEN ? ELSE resolved_by END,
              resolved_at = CASE WHEN ? = 'resolved' THEN CURRENT_TIMESTAMP ELSE resolved_at END,
              closed_at = CASE WHEN ? = 'closed' THEN CURRENT_TIMESTAMP ELSE closed_at END
              WHERE id = ?`, [nextStatus, nextStatus, ruling ? ruling.notes : null, nextStatus, adminId,
              nextStatus, nextStatus, disputeId]);
            if (ruling) await connection.execute(`INSERT INTO dispute_rulings
              (dispute_id, admin_id, decision, notes, partial_amount_kobo, require_reverse_logistics)
              VALUES (?, ?, ?, ?, ?, ?)`, [disputeId, adminId, ruling.decision, ruling.notes,
              ruling.partialAmountKobo === undefined ? null : ruling.partialAmountKobo, ruling.requireReverseLogistics]);
            await connection.execute(`INSERT INTO dispute_events (dispute_id, event_type, admin_id, detail)
              VALUES (?, ?, ?, ?)`, [disputeId, event, adminId, JSON.stringify(detail)]);
          }
        });
        await connection.commit();
        return result;
      } catch (error) {
        await connection.rollback();
        throw error;
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

        const [updated] = await connection.execute(
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
            WHERE id = ? AND status = 'open'
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

        if (!updated.affectedRows) throw new AppError('Only open disputes can be reviewed.', {
          statusCode: 409, code: ERROR_CODES.CONFLICT
        });
        await connection.execute(`INSERT INTO dispute_events (dispute_id, event_type, admin_id, detail)
          VALUES (?, 'ruled', ?, ?)`, [disputeId, adminId,
          JSON.stringify({ legacyStatus: status, notes: resolutionNote })]);

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
