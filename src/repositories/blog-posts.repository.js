const { sanitizeLimitOffset } = require('./pagination.repository');
const {
  buildPublicBlogPostVisibilitySql,
  buildUpdateStatement,
  normalizeSqlTimestamp,
  toNumber
} = require('./blog-shared.repository');

const BOOLEAN_MODE_RESERVED_PATTERN = /[+\-<>()~*"@]/g;

function mapBlogPostRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: toNumber(row.id),
    categoryId: toNumber(row.category_id),
    category: row.category_id
      ? {
        id: toNumber(row.category_id),
        name: row.category_name,
        slug: row.category_slug,
        status: row.category_status || null
      }
      : null,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    body: row.body,
    featuredImageUrl: row.featured_image_url,
    featuredImageAlt: row.featured_image_alt,
    authorDisplayName: row.author_display_name,
    authorAvatarUrl: row.author_avatar_url,
    readTimeMinutes: toNumber(row.read_time_minutes),
    status: row.status,
    publishedAt: row.published_at,
    viewCount: toNumber(row.view_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function escapeBooleanModeToken(token) {
  return token.replace(BOOLEAN_MODE_RESERVED_PATTERN, '\\$&');
}

function buildPostSearchFilter(search) {
  const trimmedSearch = String(search || '').trim();

  if (!trimmedSearch) {
    return null;
  }

  if (trimmedSearch.length < 3) {
    const likeSearch = `%${trimmedSearch.toLowerCase()}%`;

    return {
      clause: `
        (
          LOWER(bp.title) LIKE ?
          OR LOWER(COALESCE(bp.excerpt, '')) LIKE ?
          OR LOWER(bp.body) LIKE ?
        )
      `,
      params: [likeSearch, likeSearch, likeSearch]
    };
  }

  const booleanTerms = trimmedSearch
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => token.replace(/[^a-zA-Z0-9]/g, ''))
    .filter((token) => token.length >= 3)
    .map((token) => `+${escapeBooleanModeToken(token)}*`);

  if (!booleanTerms.length) {
    const likeSearch = `%${trimmedSearch.toLowerCase()}%`;

    return {
      clause: `
        (
          LOWER(bp.title) LIKE ?
          OR LOWER(COALESCE(bp.excerpt, '')) LIKE ?
          OR LOWER(bp.body) LIKE ?
        )
      `,
      params: [likeSearch, likeSearch, likeSearch]
    };
  }

  return {
    clause: 'MATCH (bp.title, bp.excerpt, bp.body) AGAINST (? IN BOOLEAN MODE)',
    params: [booleanTerms.join(' ')]
  };
}

function buildPostJoins(filters = {}) {
  const joins = [
    'INNER JOIN blog_categories bc ON bc.id = bp.category_id'
  ];

  if (filters.tagSlug) {
    joins.push('INNER JOIN blog_post_tags bpt ON bpt.post_id = bp.id');
    joins.push('INNER JOIN blog_tags bt ON bt.id = bpt.tag_id');
  }

  return joins.join('\n');
}

function buildPostFilters(filters = {}, options = {}) {
  const whereClauses = [];
  const params = [];

  if (options.publicOnly) {
    whereClauses.push(buildPublicBlogPostVisibilitySql('bp'));
    whereClauses.push('bc.status = ?');
    params.push('active');
  } else if (filters.status && filters.status !== 'all') {
    whereClauses.push('bp.status = ?');
    params.push(filters.status);
  }

  if (filters.categoryId) {
    whereClauses.push('bp.category_id = ?');
    params.push(filters.categoryId);
  }

  if (filters.categorySlug) {
    whereClauses.push('bc.slug = ?');
    params.push(filters.categorySlug);
  }

  if (filters.search) {
    const searchFilter = buildPostSearchFilter(filters.search);

    if (searchFilter) {
      whereClauses.push(searchFilter.clause);
      params.push(...searchFilter.params);
    }
  }

  if (filters.tagSlug) {
    whereClauses.push('bt.slug = ?');
    params.push(filters.tagSlug);

    if (options.publicOnly) {
      whereClauses.push('bt.status = ?');
      params.push('active');
    }
  }

  return {
    params,
    whereSql: whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : ''
  };
}

function resolveListSort(sort, options = {}) {
  if (sort === 'title_asc') {
    return 'bp.title ASC, bp.id ASC';
  }

  if (sort === 'oldest') {
    return options.publicOnly
      ? 'bp.published_at ASC, bp.id ASC'
      : 'bp.created_at ASC, bp.id ASC';
  }

  return options.publicOnly
    ? 'bp.published_at DESC, bp.id DESC'
    : 'bp.created_at DESC, bp.id DESC';
}

function buildSelectColumns() {
  return `
    bp.id,
    bp.category_id,
    bc.name AS category_name,
    bc.slug AS category_slug,
    bc.status AS category_status,
    bp.title,
    bp.slug,
    bp.excerpt,
    bp.body,
    bp.featured_image_url,
    bp.featured_image_alt,
    bp.author_display_name,
    bp.author_avatar_url,
    bp.read_time_minutes,
    bp.status,
    bp.published_at,
    bp.view_count,
    bp.created_at,
    bp.updated_at
  `;
}

function createBlogPostsRepository({ db }) {
  return {
    async createPost(payload) {
      const [result] = await db.execute(
        `
          INSERT INTO blog_posts (
            category_id,
            title,
            slug,
            excerpt,
            body,
            featured_image_url,
            featured_image_alt,
            author_display_name,
            author_avatar_url,
            read_time_minutes,
            status,
            published_at,
            view_count
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          payload.categoryId,
          payload.title,
          payload.slug,
          payload.excerpt || null,
          payload.body,
          payload.featuredImageUrl || null,
          payload.featuredImageAlt || null,
          payload.authorDisplayName,
          payload.authorAvatarUrl || null,
          payload.readTimeMinutes || 1,
          payload.status || 'draft',
          normalizeSqlTimestamp(payload.publishedAt),
          payload.viewCount || 0
        ]
      );

      return this.findById(result.insertId);
    },

    async findById(postId) {
      const [rows] = await db.execute(
        `
          SELECT
            ${buildSelectColumns()}
          FROM blog_posts bp
          INNER JOIN blog_categories bc ON bc.id = bp.category_id
          WHERE bp.id = ?
          LIMIT 1
        `,
        [postId]
      );

      return mapBlogPostRow(rows[0]);
    },

    async findBySlug(slug) {
      const [rows] = await db.execute(
        `
          SELECT
            ${buildSelectColumns()}
          FROM blog_posts bp
          INNER JOIN blog_categories bc ON bc.id = bp.category_id
          WHERE bp.slug = ?
          LIMIT 1
        `,
        [slug]
      );

      return mapBlogPostRow(rows[0]);
    },

    async findPublicPostBySlug(slug) {
      const [rows] = await db.execute(
        `
          SELECT
            ${buildSelectColumns()}
          FROM blog_posts bp
          INNER JOIN blog_categories bc ON bc.id = bp.category_id
          WHERE bp.slug = ?
            AND ${buildPublicBlogPostVisibilitySql('bp')}
            AND bc.status = 'active'
          LIMIT 1
        `,
        [slug]
      );

      return mapBlogPostRow(rows[0]);
    },

    async listPosts(filters = {}, options = {}) {
      const postFilters = buildPostFilters(filters, options);
      const joinsSql = buildPostJoins(filters);
      const shouldPaginate = (
        filters.limit !== undefined
        || filters.offset !== undefined
        || Boolean(options.pagination && options.pagination.defaultLimit)
      );
      const pagination = shouldPaginate ? sanitizeLimitOffset(filters, options.pagination) : null;
      const paginationClause = pagination
        ? `LIMIT ${pagination.limit} OFFSET ${pagination.offset}`
        : '';
      const [rows] = await db.execute(
        `
          SELECT DISTINCT
            ${buildSelectColumns()}
          FROM blog_posts bp
          ${joinsSql}
          ${postFilters.whereSql}
          ORDER BY ${resolveListSort(filters.sort, options)}
          ${paginationClause}
        `,
        postFilters.params
      );

      return rows.map(mapBlogPostRow);
    },

    async countPosts(filters = {}, options = {}) {
      const postFilters = buildPostFilters(filters, options);
      const joinsSql = buildPostJoins(filters);
      const [rows] = await db.execute(
        `
          SELECT COUNT(DISTINCT bp.id) AS total
          FROM blog_posts bp
          ${joinsSql}
          ${postFilters.whereSql}
        `,
        postFilters.params
      );

      return toNumber(rows[0] && rows[0].total) || 0;
    },

    async listPublicPosts(filters = {}) {
      return this.listPosts(filters, {
        pagination: {
          defaultLimit: 9,
          maxLimit: 50
        },
        publicOnly: true
      });
    },

    async countPublicPosts(filters = {}) {
      return this.countPosts(filters, {
        publicOnly: true
      });
    },

    async listRelatedPublicPosts({ categoryId, limit = 3, postId }) {
      const [rows] = await db.execute(
        `
          SELECT
            ${buildSelectColumns()}
          FROM blog_posts bp
          INNER JOIN blog_categories bc ON bc.id = bp.category_id
          WHERE ${buildPublicBlogPostVisibilitySql('bp')}
            AND bc.status = 'active'
            AND bp.category_id = ?
            AND bp.id <> ?
          ORDER BY bp.published_at DESC, bp.id DESC
          LIMIT ?
        `,
        [categoryId, postId, limit]
      );

      return rows.map(mapBlogPostRow);
    },

    async listRecentPublicPostsExcluding({ excludePostIds = [], limit = 3 } = {}) {
      const sanitizedExcludePostIds = Array.from(new Set(
        excludePostIds
          .map((postId) => toNumber(postId))
          .filter((postId) => Number.isInteger(postId))
      ));
      const exclusionClause = sanitizedExcludePostIds.length
        ? `AND bp.id NOT IN (${sanitizedExcludePostIds.map(() => '?').join(', ')})`
        : '';
      const [rows] = await db.execute(
        `
          SELECT
            ${buildSelectColumns()}
          FROM blog_posts bp
          INNER JOIN blog_categories bc ON bc.id = bp.category_id
          WHERE ${buildPublicBlogPostVisibilitySql('bp')}
            AND bc.status = 'active'
            ${exclusionClause}
          ORDER BY bp.published_at DESC, bp.id DESC
          LIMIT ?
        `,
        [...sanitizedExcludePostIds, limit]
      );

      return rows.map(mapBlogPostRow);
    },

    async incrementViewCount(postId) {
      await db.execute(
        `
          UPDATE blog_posts
          SET
            view_count = view_count + 1,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [postId]
      );

      return this.findById(postId);
    },

    async updatePost(postId, payload) {
      const updateStatement = buildUpdateStatement(payload, [
        { key: 'categoryId', column: 'category_id' },
        { key: 'title', column: 'title' },
        { key: 'slug', column: 'slug' },
        { key: 'excerpt', column: 'excerpt' },
        { key: 'body', column: 'body' },
        { key: 'featuredImageUrl', column: 'featured_image_url' },
        { key: 'featuredImageAlt', column: 'featured_image_alt' },
        { key: 'authorDisplayName', column: 'author_display_name' },
        { key: 'authorAvatarUrl', column: 'author_avatar_url' },
        { key: 'readTimeMinutes', column: 'read_time_minutes' },
        { key: 'status', column: 'status' },
        { key: 'publishedAt', column: 'published_at', transform: normalizeSqlTimestamp },
        { key: 'viewCount', column: 'view_count' }
      ]);

      if (!updateStatement.assignments.length) {
        return this.findById(postId);
      }

      await db.execute(
        `
          UPDATE blog_posts
          SET
            ${updateStatement.assignments.join(', ')},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [...updateStatement.params, postId]
      );

      return this.findById(postId);
    },

    async deletePost(postId) {
      await db.execute(
        `
          DELETE FROM blog_posts
          WHERE id = ?
        `,
        [postId]
      );
    }
  };
}

module.exports = {
  createBlogPostsRepository
};
