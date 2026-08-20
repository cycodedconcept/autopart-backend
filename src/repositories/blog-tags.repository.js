const { sanitizeLimitOffset } = require('./pagination.repository');
const {
  buildPublicBlogPostVisibilitySql,
  buildUpdateStatement,
  toNumber
} = require('./blog-shared.repository');

function mapBlogTagRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: toNumber(row.id),
    name: row.name,
    slug: row.slug,
    status: row.status,
    postCount: row.post_count === undefined ? undefined : toNumber(row.post_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function buildTagFilters(filters = {}) {
  const whereClauses = [];
  const params = [];

  if (filters.status && filters.status !== 'all') {
    whereClauses.push('bt.status = ?');
    params.push(filters.status);
  }

  if (filters.search) {
    const normalizedSearch = `%${filters.search.trim().toLowerCase()}%`;

    whereClauses.push('(LOWER(bt.name) LIKE ? OR LOWER(bt.slug) LIKE ?)');
    params.push(normalizedSearch, normalizedSearch);
  }

  return {
    params,
    whereSql: whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : ''
  };
}

function createBlogTagsRepository({ db }) {
  return {
    async createTag(payload) {
      const [result] = await db.execute(
        `
          INSERT INTO blog_tags (
            name,
            slug,
            status
          )
          VALUES (?, ?, ?)
        `,
        [
          payload.name,
          payload.slug,
          payload.status || 'active'
        ]
      );

      return this.findById(result.insertId);
    },

    async findById(tagId) {
      const [rows] = await db.execute(
        `
          SELECT
            id,
            name,
            slug,
            status,
            created_at,
            updated_at
          FROM blog_tags
          WHERE id = ?
          LIMIT 1
        `,
        [tagId]
      );

      return mapBlogTagRow(rows[0]);
    },

    async findBySlug(slug) {
      const [rows] = await db.execute(
        `
          SELECT
            id,
            name,
            slug,
            status,
            created_at,
            updated_at
          FROM blog_tags
          WHERE slug = ?
          LIMIT 1
        `,
        [slug]
      );

      return mapBlogTagRow(rows[0]);
    },

    async listTags(filters = {}) {
      const tagFilters = buildTagFilters(filters);
      const shouldPaginate = filters.limit !== undefined || filters.offset !== undefined;
      const pagination = shouldPaginate ? sanitizeLimitOffset(filters) : null;
      const paginationClause = pagination
        ? `LIMIT ${pagination.limit} OFFSET ${pagination.offset}`
        : '';
      const [rows] = await db.execute(
        `
          SELECT
            bt.id,
            bt.name,
            bt.slug,
            bt.status,
            bt.created_at,
            bt.updated_at
          FROM blog_tags bt
          ${tagFilters.whereSql}
          ORDER BY bt.name ASC, bt.id ASC
          ${paginationClause}
        `,
        tagFilters.params
      );

      return rows.map(mapBlogTagRow);
    },

    async listPopularTags({ limit = 10 } = {}) {
      const [rows] = await db.execute(
        `
          SELECT
            bt.id,
            bt.name,
            bt.slug,
            bt.status,
            COUNT(DISTINCT bp.id) AS post_count,
            bt.created_at,
            bt.updated_at
          FROM blog_tags bt
          INNER JOIN blog_post_tags bpt ON bpt.tag_id = bt.id
          INNER JOIN blog_posts bp
            ON bp.id = bpt.post_id
            AND ${buildPublicBlogPostVisibilitySql('bp')}
          INNER JOIN blog_categories bc
            ON bc.id = bp.category_id
            AND bc.status = 'active'
          WHERE bt.status = 'active'
          GROUP BY
            bt.id,
            bt.name,
            bt.slug,
            bt.status,
            bt.created_at,
            bt.updated_at
          ORDER BY post_count DESC, bt.name ASC, bt.id ASC
          LIMIT ?
        `,
        [limit]
      );

      return rows.map(mapBlogTagRow);
    },

    async updateTag(tagId, payload) {
      const updateStatement = buildUpdateStatement(payload, [
        { key: 'name', column: 'name' },
        { key: 'slug', column: 'slug' },
        { key: 'status', column: 'status' }
      ]);

      if (!updateStatement.assignments.length) {
        return this.findById(tagId);
      }

      await db.execute(
        `
          UPDATE blog_tags
          SET
            ${updateStatement.assignments.join(', ')},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [...updateStatement.params, tagId]
      );

      return this.findById(tagId);
    }
  };
}

module.exports = {
  createBlogTagsRepository
};
