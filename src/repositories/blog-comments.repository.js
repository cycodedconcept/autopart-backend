const { sanitizeLimitOffset } = require('./pagination.repository');
const {
  buildUpdateStatement,
  normalizeSqlTimestamp,
  toNumber
} = require('./blog-shared.repository');

function mapBlogCommentRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: toNumber(row.id),
    postId: toNumber(row.post_id),
    parentId: toNumber(row.parent_id),
    authorName: row.author_name,
    authorEmail: row.author_email,
    body: row.body,
    status: row.status,
    ipAddress: row.ip_address,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function buildCommentFilters(filters = {}) {
  const whereClauses = [];
  const params = [];

  if (filters.postId) {
    whereClauses.push('bc.post_id = ?');
    params.push(filters.postId);
  }

  if (filters.parentId !== undefined) {
    if (filters.parentId === null) {
      whereClauses.push('bc.parent_id IS NULL');
    } else {
      whereClauses.push('bc.parent_id = ?');
      params.push(filters.parentId);
    }
  }

  if (filters.status && filters.status !== 'all') {
    whereClauses.push('bc.status = ?');
    params.push(filters.status);
  }

  if (filters.search) {
    const normalizedSearch = `%${filters.search.trim().toLowerCase()}%`;

    whereClauses.push(`
      (
        LOWER(bc.author_name) LIKE ?
        OR LOWER(bc.author_email) LIKE ?
        OR LOWER(bc.body) LIKE ?
      )
    `);
    params.push(normalizedSearch, normalizedSearch, normalizedSearch);
  }

  return {
    params,
    whereSql: whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : ''
  };
}

function createBlogCommentsRepository({ db }) {
  return {
    async createComment(payload) {
      const [result] = await db.execute(
        `
          INSERT INTO blog_comments (
            post_id,
            parent_id,
            author_name,
            author_email,
            body,
            status,
            ip_address,
            approved_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          payload.postId,
          payload.parentId === undefined ? null : payload.parentId,
          payload.authorName,
          payload.authorEmail,
          payload.body,
          payload.status || 'pending',
          payload.ipAddress || null,
          normalizeSqlTimestamp(payload.approvedAt)
        ]
      );

      return this.findById(result.insertId);
    },

    async findById(commentId) {
      const [rows] = await db.execute(
        `
          SELECT
            id,
            post_id,
            parent_id,
            author_name,
            author_email,
            body,
            status,
            ip_address,
            approved_at,
            created_at,
            updated_at
          FROM blog_comments
          WHERE id = ?
          LIMIT 1
        `,
        [commentId]
      );

      return mapBlogCommentRow(rows[0]);
    },

    async listComments(filters = {}) {
      const commentFilters = buildCommentFilters(filters);
      const shouldPaginate = filters.limit !== undefined || filters.offset !== undefined;
      const pagination = shouldPaginate ? sanitizeLimitOffset(filters) : null;
      const paginationClause = pagination
        ? `LIMIT ${pagination.limit} OFFSET ${pagination.offset}`
        : '';
      const [rows] = await db.execute(
        `
          SELECT
            bc.id,
            bc.post_id,
            bc.parent_id,
            bc.author_name,
            bc.author_email,
            bc.body,
            bc.status,
            bc.ip_address,
            bc.approved_at,
            bc.created_at,
            bc.updated_at
          FROM blog_comments bc
          ${commentFilters.whereSql}
          ORDER BY bc.created_at ASC, bc.id ASC
          ${paginationClause}
        `,
        commentFilters.params
      );

      return rows.map(mapBlogCommentRow);
    },

    async countComments(filters = {}) {
      const commentFilters = buildCommentFilters(filters);
      const [rows] = await db.execute(
        `
          SELECT COUNT(*) AS total
          FROM blog_comments bc
          ${commentFilters.whereSql}
        `,
        commentFilters.params
      );

      return toNumber(rows[0] && rows[0].total) || 0;
    },

    async updateComment(commentId, payload) {
      const updateStatement = buildUpdateStatement(payload, [
        { key: 'parentId', column: 'parent_id' },
        { key: 'authorName', column: 'author_name' },
        { key: 'authorEmail', column: 'author_email' },
        { key: 'body', column: 'body' },
        { key: 'status', column: 'status' },
        { key: 'ipAddress', column: 'ip_address' },
        { key: 'approvedAt', column: 'approved_at', transform: normalizeSqlTimestamp }
      ]);

      if (!updateStatement.assignments.length) {
        return this.findById(commentId);
      }

      await db.execute(
        `
          UPDATE blog_comments
          SET
            ${updateStatement.assignments.join(', ')},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [...updateStatement.params, commentId]
      );

      return this.findById(commentId);
    },

    async deleteComment(commentId) {
      await db.execute(
        `
          DELETE FROM blog_comments
          WHERE id = ?
        `,
        [commentId]
      );
    }
  };
}

module.exports = {
  createBlogCommentsRepository
};
