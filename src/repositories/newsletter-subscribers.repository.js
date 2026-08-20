const { sanitizeLimitOffset } = require('./pagination.repository');
const {
  buildUpdateStatement,
  normalizeSqlTimestamp,
  toNumber
} = require('./blog-shared.repository');

function mapNewsletterSubscriberRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: toNumber(row.id),
    email: row.email,
    unsubscribeToken: row.unsubscribe_token,
    status: row.status,
    ipAddress: row.ip_address,
    subscribedAt: row.subscribed_at,
    unsubscribedAt: row.unsubscribed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function buildSubscriberFilters(filters = {}) {
  const whereClauses = [];
  const params = [];

  if (filters.status && filters.status !== 'all') {
    whereClauses.push('ns.status = ?');
    params.push(filters.status);
  }

  if (filters.search) {
    whereClauses.push('LOWER(ns.email) LIKE ?');
    params.push(`%${filters.search.trim().toLowerCase()}%`);
  }

  return {
    params,
    whereSql: whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : ''
  };
}

function createNewsletterSubscribersRepository({ db }) {
  return {
    async createSubscriber(payload) {
      const [result] = await db.execute(
        `
          INSERT INTO newsletter_subscribers (
            email,
            unsubscribe_token,
            status,
            ip_address,
            subscribed_at,
            unsubscribed_at
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          payload.email,
          payload.unsubscribeToken,
          payload.status || 'subscribed',
          payload.ipAddress || null,
          normalizeSqlTimestamp(payload.subscribedAt) || normalizeSqlTimestamp(new Date()),
          normalizeSqlTimestamp(payload.unsubscribedAt)
        ]
      );

      return this.findById(result.insertId);
    },

    async upsertSubscriber(payload) {
      await db.execute(
        `
          INSERT INTO newsletter_subscribers (
            email,
            unsubscribe_token,
            status,
            ip_address,
            subscribed_at,
            unsubscribed_at
          )
          VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            unsubscribe_token = VALUES(unsubscribe_token),
            status = VALUES(status),
            ip_address = VALUES(ip_address),
            subscribed_at = VALUES(subscribed_at),
            unsubscribed_at = VALUES(unsubscribed_at),
            updated_at = CURRENT_TIMESTAMP
        `,
        [
          payload.email,
          payload.unsubscribeToken,
          payload.status || 'subscribed',
          payload.ipAddress || null,
          normalizeSqlTimestamp(payload.subscribedAt) || normalizeSqlTimestamp(new Date()),
          normalizeSqlTimestamp(payload.unsubscribedAt)
        ]
      );

      return this.findByEmail(payload.email);
    },

    async findById(subscriberId) {
      const [rows] = await db.execute(
        `
          SELECT
            id,
            email,
            unsubscribe_token,
            status,
            ip_address,
            subscribed_at,
            unsubscribed_at,
            created_at,
            updated_at
          FROM newsletter_subscribers
          WHERE id = ?
          LIMIT 1
        `,
        [subscriberId]
      );

      return mapNewsletterSubscriberRow(rows[0]);
    },

    async findByEmail(email) {
      const [rows] = await db.execute(
        `
          SELECT
            id,
            email,
            unsubscribe_token,
            status,
            ip_address,
            subscribed_at,
            unsubscribed_at,
            created_at,
            updated_at
          FROM newsletter_subscribers
          WHERE email = ?
          LIMIT 1
        `,
        [email]
      );

      return mapNewsletterSubscriberRow(rows[0]);
    },

    async findByUnsubscribeToken(unsubscribeToken) {
      const [rows] = await db.execute(
        `
          SELECT
            id,
            email,
            unsubscribe_token,
            status,
            ip_address,
            subscribed_at,
            unsubscribed_at,
            created_at,
            updated_at
          FROM newsletter_subscribers
          WHERE unsubscribe_token = ?
          LIMIT 1
        `,
        [unsubscribeToken]
      );

      return mapNewsletterSubscriberRow(rows[0]);
    },

    async listSubscribers(filters = {}) {
      const subscriberFilters = buildSubscriberFilters(filters);
      const shouldPaginate = filters.limit !== undefined || filters.offset !== undefined;
      const pagination = shouldPaginate ? sanitizeLimitOffset(filters) : null;
      const paginationClause = pagination
        ? `LIMIT ${pagination.limit} OFFSET ${pagination.offset}`
        : '';
      const [rows] = await db.execute(
        `
          SELECT
            ns.id,
            ns.email,
            ns.unsubscribe_token,
            ns.status,
            ns.ip_address,
            ns.subscribed_at,
            ns.unsubscribed_at,
            ns.created_at,
            ns.updated_at
          FROM newsletter_subscribers ns
          ${subscriberFilters.whereSql}
          ORDER BY ns.subscribed_at DESC, ns.id DESC
          ${paginationClause}
        `,
        subscriberFilters.params
      );

      return rows.map(mapNewsletterSubscriberRow);
    },

    async countSubscribers(filters = {}) {
      const subscriberFilters = buildSubscriberFilters(filters);
      const [rows] = await db.execute(
        `
          SELECT COUNT(*) AS total
          FROM newsletter_subscribers ns
          ${subscriberFilters.whereSql}
        `,
        subscriberFilters.params
      );

      return toNumber(rows[0] && rows[0].total) || 0;
    },

    async updateSubscriber(subscriberId, payload) {
      const updateStatement = buildUpdateStatement(payload, [
        { key: 'email', column: 'email' },
        { key: 'unsubscribeToken', column: 'unsubscribe_token' },
        { key: 'status', column: 'status' },
        { key: 'ipAddress', column: 'ip_address' },
        { key: 'subscribedAt', column: 'subscribed_at', transform: normalizeSqlTimestamp },
        { key: 'unsubscribedAt', column: 'unsubscribed_at', transform: normalizeSqlTimestamp }
      ]);

      if (!updateStatement.assignments.length) {
        return this.findById(subscriberId);
      }

      await db.execute(
        `
          UPDATE newsletter_subscribers
          SET
            ${updateStatement.assignments.join(', ')},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [...updateStatement.params, subscriberId]
      );

      return this.findById(subscriberId);
    },

    async unsubscribeByToken(unsubscribeToken, unsubscribedAt = new Date()) {
      await db.execute(
        `
          UPDATE newsletter_subscribers
          SET
            status = 'unsubscribed',
            unsubscribed_at = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE unsubscribe_token = ?
        `,
        [normalizeSqlTimestamp(unsubscribedAt), unsubscribeToken]
      );

      return this.findByUnsubscribeToken(unsubscribeToken);
    }
  };
}

module.exports = {
  createNewsletterSubscribersRepository
};
