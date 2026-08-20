const { sendSuccess } = require('../utils/responses');

function createBlogController({ blogService }) {
  return {
    async listFeaturedListings(req, res) {
      const result = await blogService.listFeaturedListings();

      return sendSuccess(res, {
        data: result,
        message: 'Featured listings fetched successfully.'
      });
    },

    async listPublicPosts(req, res) {
      const result = await blogService.listPublicPosts(req.query);

      return sendSuccess(res, {
        data: result,
        message: 'Blog posts fetched successfully.'
      });
    },

    async getPublicPostBySlug(req, res) {
      const post = await blogService.getPublicPostBySlug(req.params.slug);

      return sendSuccess(res, {
        data: post,
        message: 'Blog post fetched successfully.'
      });
    },

    async listPublicComments(req, res) {
      const result = await blogService.listPublicComments(req.params.slug);

      return sendSuccess(res, {
        data: result,
        message: 'Blog comments fetched successfully.'
      });
    },

    async listRelatedPublicPosts(req, res) {
      const relatedPosts = await blogService.listRelatedPublicPosts(req.params.slug);

      return sendSuccess(res, {
        data: {
          posts: relatedPosts
        },
        message: 'Related blog posts fetched successfully.'
      });
    },

    async listPublicCategories(req, res) {
      const categories = await blogService.listPublicCategories();

      return sendSuccess(res, {
        data: {
          categories
        },
        message: 'Blog categories fetched successfully.'
      });
    },

    async listPopularTags(req, res) {
      const tags = await blogService.listPopularTags();

      return sendSuccess(res, {
        data: {
          tags
        },
        message: 'Popular blog tags fetched successfully.'
      });
    },

    async recordPostView(req, res) {
      await blogService.recordPostView(req.params.slug);

      return res.status(204).end();
    },

    async submitPublicComment(req, res) {
      const result = await blogService.submitPublicComment({
        slug: req.params.slug,
        authorName: req.body.authorName,
        authorEmail: req.body.authorEmail,
        body: req.body.body,
        parentId: req.body.parentId,
        honeypot: req.body.honeypot,
        website: req.body.website,
        ipAddress: req.ip
      });

      return sendSuccess(res, {
        statusCode: 201,
        data: result.data,
        message: result.message
      });
    }
  };
}

module.exports = {
  createBlogController
};
