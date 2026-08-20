const express = require('express');
const asyncHandler = require('../middleware/async-handler');
const {
  createBlogCommentRateLimiter,
  createBlogViewRateLimiter
} = require('../middleware/rate-limit.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const {
  getPublicBlogPostBySlugSchema,
  listFeaturedBlogListingsSchema,
  listPublicBlogCommentsSchema,
  listPopularBlogTagsSchema,
  listPublicBlogCategoriesSchema,
  listPublicBlogPostsSchema,
  listRelatedPublicBlogPostsSchema,
  recordPublicBlogPostViewSchema,
  submitPublicBlogCommentSchema
} = require('../validators/blog.validator');

function createBlogRouter({ blogController }) {
  const router = express.Router();
  const blogCommentRateLimiter = createBlogCommentRateLimiter();
  const blogViewRateLimiter = createBlogViewRateLimiter();

  router.get(
    '/featured-listings',
    validateRequest(listFeaturedBlogListingsSchema),
    asyncHandler(blogController.listFeaturedListings)
  );

  router.get(
    '/posts',
    validateRequest(listPublicBlogPostsSchema),
    asyncHandler(blogController.listPublicPosts)
  );

  router.get(
    '/posts/:slug/related',
    validateRequest(listRelatedPublicBlogPostsSchema),
    asyncHandler(blogController.listRelatedPublicPosts)
  );

  router.get(
    '/posts/:slug/comments',
    validateRequest(listPublicBlogCommentsSchema),
    asyncHandler(blogController.listPublicComments)
  );

  router.post(
    '/posts/:slug/comments',
    blogCommentRateLimiter,
    validateRequest(submitPublicBlogCommentSchema),
    asyncHandler(blogController.submitPublicComment)
  );

  router.post(
    '/posts/:slug/view',
    blogViewRateLimiter,
    validateRequest(recordPublicBlogPostViewSchema),
    asyncHandler(blogController.recordPostView)
  );

  router.get(
    '/posts/:slug',
    validateRequest(getPublicBlogPostBySlugSchema),
    asyncHandler(blogController.getPublicPostBySlug)
  );

  router.get(
    '/categories',
    validateRequest(listPublicBlogCategoriesSchema),
    asyncHandler(blogController.listPublicCategories)
  );

  router.get(
    '/tags/popular',
    validateRequest(listPopularBlogTagsSchema),
    asyncHandler(blogController.listPopularTags)
  );

  return router;
}

module.exports = {
  createBlogRouter
};
