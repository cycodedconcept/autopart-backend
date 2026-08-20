const { sanitizeLimitOffset } = require('./pagination.repository');
const {
  buildPublicBlogPostVisibilitySql,
  buildUpdateStatement,
  toNumber
} = require('./blog-shared.repository');

function mapBlogCategoryRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: toNumber(row.id),
    name: row.name,
    slug: row.slug,
    description: row.description,
    status: row.status,
    postCount: row.post_count === undefined ? undefined : toNumber(row.post_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function buildCategoryFilters(filters = {}) {
  const whereClauses = [];
  const params = [];

  if (filters.status && filters.status !== 'all') {
    whereClauses.push('bc.status = ?');
    params.push(filters.status);
  }

  if (filters.search) {
    const normalizedSearch = `%${filters.search.trim().toLowerCase()}%`;

    whereClauses.push(`
      (
        LOWER(bc.name) LIKE ?
        OR LOWER(bc.slug) LIKE ?
        OR LOWER(COALESCE(bc.description, '')) LIKE ?
      )
    `);
    params.push(normalizedSearch, normalizedSearch, normalizedSearch);
  }

  return {
    params,
    whereSql: whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : ''
  };
}

function createBlogCategoriesRepository({ db }) {
  return {
    async createCategory(payload) {
      const [result] = await db.execute(
        `
          INSERT INTO blog_categories (
            name,
            slug,
            description,
            status
          )
          VALUES (?, ?, ?, ?)
        `,
        [
          payload.name,
          payload.slug,
          payload.description || null,
          payload.status || 'active'
        ]
      );

      return this.findById(result.insertId);
    },

    async findById(categoryId) {
      const [rows] = await db.execute(
        `
          SELECT
            id,
            name,
            slug,
            description,
            status,
            created_at,
            updated_at
          FROM blog_categories
          WHERE id = ?
          LIMIT 1
        `,
        [categoryId]
      );

      return mapBlogCategoryRow(rows[0]);
    },

    async findBySlug(slug) {
      const [rows] = await db.execute(
        `
          SELECT
            id,
            name,
            slug,
            description,
            status,
            created_at,
            updated_at
          FROM blog_categories
          WHERE slug = ?
          LIMIT 1
        `,
        [slug]
      );

      return mapBlogCategoryRow(rows[0]);
    },

    async listCategories(filters = {}) {
      const categoryFilters = buildCategoryFilters(filters);
      const shouldPaginate = filters.limit !== undefined || filters.offset !== undefined;
      const pagination = shouldPaginate ? sanitizeLimitOffset(filters) : null;
      const paginationClause = pagination
        ? `LIMIT ${pagination.limit} OFFSET ${pagination.offset}`
        : '';
      const [rows] = await db.execute(
        `
          SELECT
            bc.id,
            bc.name,
            bc.slug,
            bc.description,
            bc.status,
            bc.created_at,
            bc.updated_at
          FROM blog_categories bc
          ${categoryFilters.whereSql}
          ORDER BY bc.name ASC, bc.id ASC
          ${paginationClause}
        `,
        categoryFilters.params
      );

      return rows.map(mapBlogCategoryRow);
    },

    async listPublicCategoriesWithPostCounts() {
      const [rows] = await db.execute(
        `
          SELECT
            bc.id,
            bc.name,
            bc.slug,
            bc.description,
            bc.status,
            COUNT(bp.id) AS post_count,
            bc.created_at,
            bc.updated_at
          FROM blog_categories bc
          LEFT JOIN blog_posts bp
            ON bp.category_id = bc.id
            AND ${buildPublicBlogPostVisibilitySql('bp')}
          WHERE bc.status = 'active'
          GROUP BY
            bc.id,
            bc.name,
            bc.slug,
            bc.description,
            bc.status,
            bc.created_at,
            bc.updated_at
          ORDER BY bc.name ASC, bc.id ASC
        `
      );

      return rows.map(mapBlogCategoryRow);
    },

    async updateCategory(categoryId, payload) {
      const updateStatement = buildUpdateStatement(payload, [
        { key: 'name', column: 'name' },
        { key: 'slug', column: 'slug' },
        { key: 'description', column: 'description' },
        { key: 'status', column: 'status' }
      ]);

      if (!updateStatement.assignments.length) {
        return this.findById(categoryId);
      }

      await db.execute(
        `
          UPDATE blog_categories
          SET
            ${updateStatement.assignments.join(', ')},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [...updateStatement.params, categoryId]
      );

      return this.findById(categoryId);
    }
  };
}

module.exports = {
  createBlogCategoriesRepository
};
