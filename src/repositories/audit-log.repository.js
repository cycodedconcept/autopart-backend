const { sanitizeLimitOffset } = require('./pagination.repository');

function parseJsonColumn(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
}

function mapAuditLogRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id === null || row.target_id === undefined ? null : Number(row.target_id),
    detail: parseJsonColumn(row.detail),
    createdAt: row.created_at,
    admin: {
      id: Number(row.admin_id),
      fullName: row.admin_full_name,
      email: row.admin_email
    }
  };
}

function buildAuditLogFilters(filters = {}) {
  const whereClauses = [];
  const params = [];

  if (filters.adminId) {
    whereClauses.push('al.admin_id = ?');
    params.push(filters.adminId);
  }

  if (filters.action) {
    whereClauses.push('al.action = ?');
    params.push(filters.action);
  }

  if (filters.targetType) {
    whereClauses.push('al.target_type = ?');
    params.push(filters.targetType);
  }

  if (filters.targetId) {
    whereClauses.push('al.target_id = ?');
    params.push(filters.targetId);
  }

  return {
    whereSql: whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '',
    params
  };
}

function createAuditLogRepository({ db }) {
  return {
    async createAuditLog(payload, executor = db) {
      await executor.execute(
        `
          INSERT INTO audit_logs (
            admin_id,
            action,
            target_type,
            target_id,
            detail
          )
          VALUES (?, ?, ?, ?, ?)
        `,
        [
          payload.adminId,
          payload.action,
          payload.targetType,
          payload.targetId === undefined ? null : payload.targetId,
          payload.detail === undefined ? null : JSON.stringify(payload.detail)
        ]
      );
    },

    async listAuditLogs(filters) {
      const pagination = sanitizeLimitOffset(filters);
      const auditLogFilters = buildAuditLogFilters(filters);
      const [countRows] = await db.execute(
        `
          SELECT COUNT(*) AS total
          FROM audit_logs al
          INNER JOIN admins a ON a.id = al.admin_id
          ${auditLogFilters.whereSql}
        `,
        auditLogFilters.params
      );
      const [rows] = await db.execute(
        `
          SELECT
            al.id,
            al.admin_id,
            al.action,
            al.target_type,
            al.target_id,
            al.detail,
            al.created_at,
            a.full_name AS admin_full_name,
            a.email AS admin_email
          FROM audit_logs al
          INNER JOIN admins a ON a.id = al.admin_id
          ${auditLogFilters.whereSql}
          ORDER BY al.created_at DESC, al.id DESC
          LIMIT ${pagination.limit} OFFSET ${pagination.offset}
        `,
        auditLogFilters.params
      );

      return {
        logs: rows.map(mapAuditLogRow),
        total: Number((countRows[0] && countRows[0].total) || 0)
      };
    }
  };
}

module.exports = {
  createAuditLogRepository
};
