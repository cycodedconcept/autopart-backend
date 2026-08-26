const {
  BLOG_COMMENT_STATUSES,
  ERROR_CODES
} = require('../config/constants');
const AppError = require('../utils/app-error');
const { buildPagination, normalizePagination } = require('../utils/pagination');
const { buildPublicUrl } = require('../utils/product-image-files');

const DEFAULT_POSTS_PER_PAGE = 9;
const FEATURED_LISTING_LIMIT = 3;
const MAX_POSTS_PER_PAGE = 50;
const LINK_PATTERN = /(https?:\/\/\S+|www\.\S+)/gi;
const POPULAR_TAG_LIMIT = 10;
const RELATED_POST_LIMIT = 3;

function mapPublicCategory(category) {
  if (!category) {
    return null;
  }

  return {
    id: category.id,
    name: category.name,
    slug: category.slug
  };
}

function mapPublicAuthor(post) {
  return {
    displayName: post.authorDisplayName,
    avatarUrl: post.authorAvatarUrl
  };
}

function mapPublicPostListItem(post, baseUrl) {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    featuredImageUrl: buildPublicUrl(baseUrl, post.featuredImageUrl),
    featuredImageAlt: post.featuredImageAlt,
    author: mapPublicAuthor(post),
    category: mapPublicCategory(post.category),
    readTimeMinutes: post.readTimeMinutes,
    publishedAt: post.publishedAt
  };
}

function mapPublicPostTag(postTag) {
  if (!postTag || !postTag.tag) {
    return null;
  }

  return {
    id: postTag.tag.id,
    name: postTag.tag.name,
    slug: postTag.tag.slug
  };
}

function mapPublicPostDetail(post, { commentCount, tags }, baseUrl) {
  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    body: post.body,
    featuredImageUrl: buildPublicUrl(baseUrl, post.featuredImageUrl),
    featuredImageAlt: post.featuredImageAlt,
    author: mapPublicAuthor(post),
    category: mapPublicCategory(post.category),
    tags: tags.map(mapPublicPostTag).filter(Boolean),
    readTimeMinutes: post.readTimeMinutes,
    publishedAt: post.publishedAt,
    commentCount,
    viewCount: post.viewCount
  };
}

function mapPublicCategorySummary(category) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    postCount: category.postCount || 0
  };
}

function mapPopularTag(tag) {
  return {
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    postCount: tag.postCount || 0
  };
}

function mapPublicComment(comment) {
  return {
    id: comment.id,
    parentId: comment.parentId,
    authorName: comment.authorName,
    body: comment.body,
    createdAt: comment.createdAt,
    replies: []
  };
}

function buildPublicPostFilters(query, pagination) {
  return {
    categorySlug: query.category || null,
    tagSlug: query.tag || null,
    search: query.search || null,
    sort: query.sort || 'latest',
    page: pagination.page,
    limit: pagination.limit,
    offset: pagination.offset
  };
}

function buildThreadedPublicComments(comments = []) {
  const commentNodesById = new Map();
  const topLevelComments = [];

  comments.forEach((comment) => {
    commentNodesById.set(comment.id, mapPublicComment(comment));
  });

  comments.forEach((comment) => {
    const node = commentNodesById.get(comment.id);

    if (!node) {
      return;
    }

    if (comment.parentId === null || comment.parentId === undefined) {
      topLevelComments.push(node);
      return;
    }

    const parentNode = commentNodesById.get(comment.parentId);

    if (parentNode && parentNode.parentId === null) {
      parentNode.replies.push(node);
    }
  });

  return topLevelComments;
}

function isLinkOnlyCommentBody(body) {
  const bodyWithoutLinks = String(body || '').replace(LINK_PATTERN, ' ');
  const remainingText = bodyWithoutLinks.replace(/[^a-z0-9]/gi, '');

  return remainingText.length === 0;
}

function normalizeEmail(email) {
  return email ? String(email).trim().toLowerCase() : null;
}

function resolveHoneypotValue(payload = {}) {
  if (payload.honeypot && String(payload.honeypot).trim()) {
    return String(payload.honeypot).trim();
  }

  if (payload.website && String(payload.website).trim()) {
    return String(payload.website).trim();
  }

  return '';
}

function createBlogService({
  blogCategoriesRepository,
  blogCommentsRepository,
  blogPostTagsRepository,
  blogPostsRepository,
  blogTagsRepository,
  env = {},
  productsService
}) {
  async function findPublicPostOrThrow(slug) {
    const post = await blogPostsRepository.findPublicPostBySlug(slug);

    if (!post) {
      throw new AppError('Blog post was not found.', {
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND
      });
    }

    return post;
  }

  function buildPendingCommentSubmissionResult() {
    return {
      data: {
        status: BLOG_COMMENT_STATUSES.PENDING
      },
      message: 'Comment submitted successfully and is awaiting moderation.'
    };
  }

  return {
    async listFeaturedListings() {
      if (!productsService || typeof productsService.listProducts !== 'function') {
        throw new AppError('Featured listings are unavailable.', {
          statusCode: 500,
          code: ERROR_CODES.INTERNAL_SERVER_ERROR
        });
      }

      const result = await productsService.listProducts({
        page: 1,
        limit: FEATURED_LISTING_LIMIT
      });

      return {
        products: result.products
      };
    },

    async listPublicPosts(query = {}) {
      const pagination = normalizePagination({
        page: query.page,
        limit: query.per_page
      }, {
        defaultLimit: DEFAULT_POSTS_PER_PAGE,
        maxLimit: MAX_POSTS_PER_PAGE
      });
      const filters = buildPublicPostFilters(query, pagination);
      const [posts, total] = await Promise.all([
        blogPostsRepository.listPublicPosts(filters),
        blogPostsRepository.countPublicPosts(filters)
      ]);

      return {
        posts: posts.map((post) => mapPublicPostListItem(post, env.BASE_URL)),
        pagination: buildPagination({
          page: pagination.page,
          limit: pagination.limit,
          total
        })
      };
    },

    async getPublicPostBySlug(slug) {
      const post = await findPublicPostOrThrow(slug);
      const [tags, commentCount] = await Promise.all([
        blogPostTagsRepository.listTagsForPost(post.id),
        blogCommentsRepository.countComments({
          postId: post.id,
          status: 'approved'
        })
      ]);

      return mapPublicPostDetail(post, {
        commentCount,
        tags
      }, env.BASE_URL);
    },

    async listRelatedPublicPosts(slug) {
      const post = await findPublicPostOrThrow(slug);
      const sameCategoryPosts = await blogPostsRepository.listRelatedPublicPosts({
        categoryId: post.categoryId,
        limit: RELATED_POST_LIMIT,
        postId: post.id
      });

      if (sameCategoryPosts.length >= RELATED_POST_LIMIT) {
        return sameCategoryPosts.map((post) => mapPublicPostListItem(post, env.BASE_URL));
      }

      const recentPosts = await blogPostsRepository.listRecentPublicPostsExcluding({
        excludePostIds: [
          post.id,
          ...sameCategoryPosts.map((relatedPost) => relatedPost.id)
        ],
        limit: RELATED_POST_LIMIT - sameCategoryPosts.length
      });

      return [...sameCategoryPosts, ...recentPosts]
        .map((post) => mapPublicPostListItem(post, env.BASE_URL));
    },

    async listPublicCategories() {
      const categories = await blogCategoriesRepository.listPublicCategoriesWithPostCounts();

      return categories
        .filter((category) => (category.postCount || 0) > 0)
        .map(mapPublicCategorySummary);
    },

    async listPopularTags() {
      const tags = await blogTagsRepository.listPopularTags({
        limit: POPULAR_TAG_LIMIT
      });

      return tags.map(mapPopularTag);
    },

    async listPublicComments(slug) {
      const post = await findPublicPostOrThrow(slug);
      const comments = await blogCommentsRepository.listComments({
        postId: post.id,
        status: BLOG_COMMENT_STATUSES.APPROVED
      });

      return {
        comments: buildThreadedPublicComments(comments)
      };
    },

    async submitPublicComment(payload) {
      const post = await findPublicPostOrThrow(payload.slug);
      const honeypotValue = resolveHoneypotValue(payload);

      if (honeypotValue) {
        return buildPendingCommentSubmissionResult();
      }

      if (isLinkOnlyCommentBody(payload.body)) {
        throw new AppError('Comment body must contain meaningful text and cannot contain only links.', {
          statusCode: 422,
          code: ERROR_CODES.VALIDATION_ERROR
        });
      }

      let parentId = null;

      if (payload.parentId !== undefined && payload.parentId !== null) {
        const parentComment = await blogCommentsRepository.findById(payload.parentId);

        if (
          !parentComment
          || parentComment.postId !== post.id
          || parentComment.status !== BLOG_COMMENT_STATUSES.APPROVED
        ) {
          throw new AppError('Parent comment was not found.', {
            statusCode: 404,
            code: ERROR_CODES.NOT_FOUND
          });
        }

        if (parentComment.parentId !== null) {
          throw new AppError('Replies can only target top-level comments.', {
            statusCode: 422,
            code: ERROR_CODES.VALIDATION_ERROR
          });
        }

        parentId = parentComment.id;
      }

      await blogCommentsRepository.createComment({
        postId: post.id,
        parentId,
        authorName: payload.authorName.trim(),
        authorEmail: normalizeEmail(payload.authorEmail),
        body: payload.body.trim(),
        status: BLOG_COMMENT_STATUSES.PENDING,
        ipAddress: payload.ipAddress || null
      });

      return buildPendingCommentSubmissionResult();
    },

    async recordPostView(slug) {
      const post = await findPublicPostOrThrow(slug);

      await blogPostsRepository.incrementViewCount(post.id);
    }
  };
}

module.exports = {
  createBlogService
};
