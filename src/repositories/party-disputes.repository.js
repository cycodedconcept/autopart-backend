const { sanitizeLimitOffset } = require('./pagination.repository');
const { epochIso, jsonValue } = require('../utils/admin-reporting');

const DISPUTE_SELECT = `SELECT d.id, d.order_id, d.seller_id, d.raised_by, d.reason, d.description,
  d.status, d.buyer_evidence_summary, d.seller_evidence_summary, o.buyer_id,
  o.status AS order_status, o.total_kobo, sp.business_name,
  UNIX_TIMESTAMP(d.created_at) AS created_epoch, UNIX_TIMESTAMP(d.updated_at) AS updated_epoch,
  UNIX_TIMESTAMP(d.resolved_at) AS resolved_epoch, UNIX_TIMESTAMP(d.closed_at) AS closed_epoch
  FROM disputes d INNER JOIN orders o ON o.id = d.order_id
  LEFT JOIN seller_profiles sp ON sp.id = d.seller_id`;

function mapDispute(row) {
  if (!row) return null;
  return {
    id: Number(row.id), orderId: Number(row.order_id), buyerId: Number(row.buyer_id),
    sellerId: row.seller_id === null ? null : Number(row.seller_id), businessName: row.business_name || null,
    raisedBy: row.raised_by, reason: row.reason, description: row.description, status: row.status,
    buyerEvidenceSummary: row.buyer_evidence_summary, sellerEvidenceSummary: row.seller_evidence_summary,
    orderStatus: row.order_status, totalKobo: Number(row.total_kobo),
    createdAt: epochIso(row.created_epoch), updatedAt: epochIso(row.updated_epoch),
    resolvedAt: epochIso(row.resolved_epoch), closedAt: epochIso(row.closed_epoch)
  };
}

async function findOrderSellers(executor, orderId) {
  const [rows] = await executor.execute(`SELECT DISTINCT oi.seller_id, sp.business_name
    FROM order_items oi INNER JOIN seller_profiles sp ON sp.id = oi.seller_id
    WHERE oi.order_id = ? ORDER BY oi.seller_id`, [orderId]);
  return rows.map((row) => ({ id: Number(row.seller_id), businessName: row.business_name }));
}

async function findOrder(executor, orderId) {
  const [rows] = await executor.execute(`SELECT o.id, o.buyer_id, o.status,
    (SELECT UNIX_TIMESTAMP(MIN(h.created_at)) FROM order_status_history h
      WHERE h.order_id = o.id AND h.status = 'delivered') AS delivered_epoch
    FROM orders o WHERE o.id = ?`, [orderId]);
  if (!rows[0]) return null;
  return { id: Number(rows[0].id), buyerId: Number(rows[0].buyer_id), status: rows[0].status,
    deliveredAt: epochIso(rows[0].delivered_epoch), sellers: await findOrderSellers(executor, orderId) };
}

async function findDispute(executor, disputeId) {
  const [rows] = await executor.execute(`${DISPUTE_SELECT} WHERE d.id = ?`, [disputeId]);
  const dispute = mapDispute(rows[0]);
  if (dispute) dispute.sellers = await findOrderSellers(executor, dispute.orderId);
  return dispute;
}

async function findEvents(executor, disputeId) {
  const [rows] = await executor.execute(`SELECT id, event_type, actor_user_id, admin_id, detail,
    UNIX_TIMESTAMP(created_at) AS created_epoch FROM dispute_events WHERE dispute_id = ? ORDER BY id`, [disputeId]);
  return rows.map((row) => ({ id: Number(row.id), event: row.event_type,
    actorUserId: row.actor_user_id === null ? null : Number(row.actor_user_id),
    adminId: row.admin_id === null ? null : Number(row.admin_id),
    detail: jsonValue(row.detail, {}), timestamp: epochIso(row.created_epoch) }));
}

async function findEvidenceAndTimeline(executor, disputeId) {
  const [rows] = await executor.execute(`SELECT id, submitted_by, url, filename, file_path,
    UNIX_TIMESTAMP(uploaded_at) AS uploaded_epoch FROM dispute_attachments
    WHERE dispute_id = ? ORDER BY uploaded_at, id`, [disputeId]);
  const [rulings] = await executor.execute(`SELECT id, decision, partial_amount_kobo, require_reverse_logistics,
    UNIX_TIMESTAMP(created_at) AS created_epoch FROM dispute_rulings WHERE dispute_id = ?`, [disputeId]);
  return {
    attachments: rows.map((row) => ({ id: Number(row.id), submittedBy: row.submitted_by,
      url: row.url, filename: row.filename, filePath: row.file_path, uploadedAt: epochIso(row.uploaded_epoch) })),
    timeline: await findEvents(executor, disputeId),
    ruling: rulings.length ? { id: Number(rulings[0].id), decision: rulings[0].decision,
      partialAmountKobo: rulings[0].partial_amount_kobo === null ? null : Number(rulings[0].partial_amount_kobo),
      requireReverseLogistics: Boolean(rulings[0].require_reverse_logistics),
      createdAt: epochIso(rulings[0].created_epoch) } : null
  };
}

function transactionMethods(connection) {
  return {
    findDispute: (id) => findDispute(connection, id),
    findEvidenceAndTimeline: (id) => findEvidenceAndTimeline(connection, id),
    findEvents: (id) => findEvents(connection, id),
    async findActiveDispute(orderId, statuses) {
      const [rows] = await connection.execute(`SELECT id FROM disputes
        WHERE order_id = ? AND status IN (${statuses.map(() => '?').join(', ')}) ORDER BY id LIMIT 1 FOR UPDATE`,
      [orderId, ...statuses]);
      return rows.length ? { id: Number(rows[0].id) } : null;
    },
    async insertDispute({ orderId, sellerId, reason, description, raisedBy, status }) {
      const [result] = await connection.execute(`INSERT INTO disputes
        (order_id, seller_id, raised_by, reason, description, buyer_evidence_summary, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)`, [orderId, sellerId, raisedBy, reason, description, description, status]);
      return Number(result.insertId);
    },
    async addAttachments(disputeId, submittedBy, files) {
      const ids = [];
      for (const file of files) {
        const [result] = await connection.execute(`INSERT INTO dispute_attachments
          (dispute_id, submitted_by, url, filename, file_path) VALUES (?, ?, ?, ?, ?)`,
        [disputeId, submittedBy, file.url, file.filename, file.filePath]);
        ids.push(Number(result.insertId));
      }
      return ids;
    },
    async addEvent({ disputeId, event, userId, detail }) {
      const [result] = await connection.execute(`INSERT INTO dispute_events
        (dispute_id, event_type, actor_user_id, detail) VALUES (?, ?, ?, ?)`,
      [disputeId, event, userId, JSON.stringify(detail)]);
      return Number(result.insertId);
    },
    async updateSummary(disputeId, party, message) {
      const column = { buyer: 'buyer_evidence_summary', seller: 'seller_evidence_summary' }[party];
      if (!column) throw new Error('Unknown dispute evidence party.');
      await connection.execute(`UPDATE disputes SET ${column} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [message, disputeId]);
    }
  };
}

function createPartyDisputesRepository({ db }) {
  async function withLock(table, id, callback) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      // table is supplied only by the two methods below, never by request input.
      await connection.execute(`SELECT id FROM ${table} WHERE id = ? FOR UPDATE`, [id]);
      const context = table === 'orders'
        ? { order: await findOrder(connection, id) } : { dispute: await findDispute(connection, id) };
      const result = await callback({ ...context, ...transactionMethods(connection) });
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  return {
    findOrder: (id) => findOrder(db, id),
    findDispute: (id) => findDispute(db, id),
    findEvidenceAndTimeline: (id) => findEvidenceAndTimeline(db, id),
    withLockedOrder: (id, callback) => withLock('orders', id, callback),
    withLockedDispute: (id, callback) => withLock('disputes', id, callback),
    async findAttachmentByPath(filePath) {
      const [rows] = await db.execute(`SELECT id, dispute_id, submitted_by, file_path, filename
        FROM dispute_attachments WHERE file_path = ? LIMIT 1`, [filePath]);
      if (!rows[0]) return null;
      return { id: Number(rows[0].id), disputeId: Number(rows[0].dispute_id), submittedBy: rows[0].submitted_by,
        filePath: rows[0].file_path, filename: rows[0].filename };
    },
    async listDisputes(filters) {
      const { limit, offset } = sanitizeLimitOffset(filters);
      const where = [], params = [];
      if (filters.buyerId) { where.push('o.buyer_id = ?'); params.push(filters.buyerId); }
      if (filters.sellerId) {
        // Legacy disputes without a target are accessible only when the order has one seller.
        where.push(`EXISTS (SELECT 1 FROM order_items own_item WHERE own_item.order_id = d.order_id AND own_item.seller_id = ?)
          AND (d.seller_id = ? OR (d.seller_id IS NULL AND NOT EXISTS
            (SELECT 1 FROM order_items other_item WHERE other_item.order_id = d.order_id AND other_item.seller_id <> ?)))`);
        params.push(filters.sellerId, filters.sellerId, filters.sellerId);
      }
      if (filters.orderId) { where.push('d.order_id = ?'); params.push(filters.orderId); }
      if (filters.status && filters.status !== 'all') { where.push('d.status = ?'); params.push(filters.status); }
      if (filters.dateFrom !== undefined) { where.push('d.created_at >= FROM_UNIXTIME(?)'); params.push(filters.dateFrom); }
      if (filters.dateTo !== undefined) { where.push('d.created_at < FROM_UNIXTIME(?)'); params.push(filters.dateTo); }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const [counts] = await db.execute(`SELECT COUNT(*) AS total FROM disputes d
        INNER JOIN orders o ON o.id = d.order_id ${whereSql}`, params);
      const [rows] = await db.execute(`${DISPUTE_SELECT} ${whereSql}
        ORDER BY d.created_at DESC, d.id DESC LIMIT ${limit} OFFSET ${offset}`, params);
      return { disputes: rows.map(mapDispute), total: Number(counts[0].total) };
    }
  };
}

module.exports = { createPartyDisputesRepository };
