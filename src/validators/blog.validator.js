const Joi = require('joi');

const PUBLIC_BLOG_SORT_VALUES = ['latest', 'oldest', 'title_asc'];

const listPublicBlogPostsSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    per_page: Joi.number().integer().min(1).max(50).default(9),
    category: Joi.string().trim().min(1).optional(),
    tag: Joi.string().trim().min(1).optional(),
    search: Joi.string().trim().min(1).optional(),
    sort: Joi.string().valid(...PUBLIC_BLOG_SORT_VALUES).default('latest')
  }).default({})
});

const getPublicBlogPostBySlugSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({
    slug: Joi.string().trim().min(1).required()
  }).required(),
  query: Joi.object({}).default({})
});

const listPublicBlogCommentsSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({
    slug: Joi.string().trim().min(1).required()
  }).required(),
  query: Joi.object({}).default({})
});

const listRelatedPublicBlogPostsSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({
    slug: Joi.string().trim().min(1).required()
  }).required(),
  query: Joi.object({}).default({})
});

const submitPublicBlogCommentSchema = Joi.object({
  body: Joi.object({
    authorName: Joi.string().trim().min(2).max(120).required(),
    authorEmail: Joi.string().trim().lowercase().email({
      tlds: {
        allow: false
      }
    }).required(),
    body: Joi.string().trim().min(3).max(2000).required(),
    parentId: Joi.number().integer().positive().allow(null).optional(),
    honeypot: Joi.string().trim().allow('').optional(),
    website: Joi.string().trim().allow('').optional()
  }).required(),
  params: Joi.object({
    slug: Joi.string().trim().min(1).required()
  }).required(),
  query: Joi.object({}).default({})
});

const recordPublicBlogPostViewSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({
    slug: Joi.string().trim().min(1).required()
  }).required(),
  query: Joi.object({}).default({})
});

const listPublicBlogCategoriesSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const listPopularBlogTagsSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const listFeaturedBlogListingsSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

module.exports = {
  getPublicBlogPostBySlugSchema,
  listFeaturedBlogListingsSchema,
  listPublicBlogCommentsSchema,
  listPopularBlogTagsSchema,
  listPublicBlogCategoriesSchema,
  listPublicBlogPostsSchema,
  listRelatedPublicBlogPostsSchema,
  recordPublicBlogPostViewSchema,
  submitPublicBlogCommentSchema
};
