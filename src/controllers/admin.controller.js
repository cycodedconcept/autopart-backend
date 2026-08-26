const { sendSuccess } = require('../utils/responses');

function createAdminController({ adminService }) {
  return {
    async createCategory(req, res) {
      const result = await adminService.createCategory({
        name: req.body.name,
        slug: req.body.slug,
        parentId: req.body.parentId
      });

      return sendSuccess(res, {
        statusCode: 201,
        data: result,
        message: 'Category created successfully.'
      });
    },

    async createVehicleTaxonomyEntry(req, res) {
      const result = await adminService.createVehicleTaxonomyEntry({
        make: req.body.make,
        model: req.body.model,
        yearFrom: req.body.yearFrom,
        yearTo: req.body.yearTo
      });

      return sendSuccess(res, {
        statusCode: 201,
        data: result,
        message: 'Vehicle taxonomy entry created successfully.'
      });
    },

    async deleteCategory(req, res) {
      const result = await adminService.deleteCategory({
        categoryId: req.params.id
      });

      return sendSuccess(res, {
        data: result,
        message: 'Category archived successfully.'
      });
    },

    async listBlogCategories(req, res) {
      const result = await adminService.listBlogCategories({
        query: req.query
      });

      return sendSuccess(res, {
        data: result,
        message: 'Blog categories fetched successfully.'
      });
    },

    async getBlogCategory(req, res) {
      const result = await adminService.getBlogCategory({
        categoryId: req.params.id
      });

      return sendSuccess(res, {
        data: result,
        message: 'Blog category fetched successfully.'
      });
    },

    async createBlogCategory(req, res) {
      const result = await adminService.createBlogCategory({
        adminId: req.admin.id,
        name: req.body.name,
        slug: req.body.slug,
        description: req.body.description,
        status: req.body.status
      });

      return sendSuccess(res, {
        statusCode: 201,
        data: result,
        message: 'Blog category created successfully.'
      });
    },

    async updateBlogCategory(req, res) {
      const result = await adminService.updateBlogCategory({
        adminId: req.admin.id,
        categoryId: req.params.id,
        name: req.body.name,
        slug: req.body.slug,
        description: req.body.description,
        status: req.body.status
      });

      return sendSuccess(res, {
        data: result,
        message: 'Blog category updated successfully.'
      });
    },

    async deleteBlogCategory(req, res) {
      const result = await adminService.deleteBlogCategory({
        adminId: req.admin.id,
        categoryId: req.params.id
      });

      return sendSuccess(res, {
        data: result,
        message: 'Blog category archived successfully.'
      });
    },

    async listBlogTags(req, res) {
      const result = await adminService.listBlogTags({
        query: req.query
      });

      return sendSuccess(res, {
        data: result,
        message: 'Blog tags fetched successfully.'
      });
    },

    async getBlogTag(req, res) {
      const result = await adminService.getBlogTag({
        tagId: req.params.id
      });

      return sendSuccess(res, {
        data: result,
        message: 'Blog tag fetched successfully.'
      });
    },

    async createBlogTag(req, res) {
      const result = await adminService.createBlogTag({
        adminId: req.admin.id,
        name: req.body.name,
        slug: req.body.slug,
        status: req.body.status
      });

      return sendSuccess(res, {
        statusCode: 201,
        data: result,
        message: 'Blog tag created successfully.'
      });
    },

    async updateBlogTag(req, res) {
      const result = await adminService.updateBlogTag({
        adminId: req.admin.id,
        tagId: req.params.id,
        name: req.body.name,
        slug: req.body.slug,
        status: req.body.status
      });

      return sendSuccess(res, {
        data: result,
        message: 'Blog tag updated successfully.'
      });
    },

    async deleteBlogTag(req, res) {
      const result = await adminService.deleteBlogTag({
        adminId: req.admin.id,
        tagId: req.params.id
      });

      return sendSuccess(res, {
        data: result,
        message: 'Blog tag archived successfully.'
      });
    },

    async listBlogPosts(req, res) {
      const result = await adminService.listBlogPosts({
        query: req.query
      });

      return sendSuccess(res, {
        data: result,
        message: 'Blog posts fetched successfully.'
      });
    },

    async getBlogPost(req, res) {
      const result = await adminService.getBlogPost({
        postId: req.params.id
      });

      return sendSuccess(res, {
        data: result,
        message: 'Blog post fetched successfully.'
      });
    },

    async createBlogPost(req, res) {
      let result;
      try {
        result = await adminService.createBlogPost({
          adminId: req.admin.id,
          categoryId: req.body.categoryId,
          title: req.body.title,
          slug: req.body.slug,
          excerpt: req.body.excerpt,
          body: req.body.body,
          featuredImageUrl: req.uploadedBlogImage ? req.uploadedBlogImage.filePath : req.body.featuredImageUrl,
          featuredImageAlt: req.body.featuredImageAlt,
          authorDisplayName: req.body.authorDisplayName,
          authorAvatarUrl: req.body.authorAvatarUrl,
          status: req.body.status,
          publishedAt: req.body.publishedAt,
          tagIds: req.body.tagIds
        });
      } catch (error) {
        if (req.cleanupUploadedBlogImage) await req.cleanupUploadedBlogImage();
        throw error;
      }

      return sendSuccess(res, {
        statusCode: 201,
        data: result,
        message: 'Blog post created successfully.'
      });
    },

    async updateBlogPost(req, res) {
      let result;
      try {
        result = await adminService.updateBlogPost({
        adminId: req.admin.id,
        postId: req.params.id,
        categoryId: req.body.categoryId,
        title: req.body.title,
        slug: req.body.slug,
        excerpt: req.body.excerpt,
        body: req.body.body,
        featuredImageUrl: req.uploadedBlogImage ? req.uploadedBlogImage.filePath : req.body.featuredImageUrl,
        featuredImageAlt: req.body.featuredImageAlt,
        authorDisplayName: req.body.authorDisplayName,
        authorAvatarUrl: req.body.authorAvatarUrl,
        publishedAt: req.body.publishedAt,
        tagIds: req.body.tagIds,
        allowSlugOverride: req.body.allowSlugOverride
        });
      } catch (error) {
        if (req.cleanupUploadedBlogImage) await req.cleanupUploadedBlogImage();
        throw error;
      }

      return sendSuccess(res, {
        data: result,
        message: 'Blog post updated successfully.'
      });
    },

    async publishBlogPost(req, res) {
      const result = await adminService.publishBlogPost({
        adminId: req.admin.id,
        postId: req.params.id,
        publishedAt: req.body.publishedAt
      });

      return sendSuccess(res, {
        data: result,
        message: 'Blog post published successfully.'
      });
    },

    async unpublishBlogPost(req, res) {
      const result = await adminService.unpublishBlogPost({
        adminId: req.admin.id,
        postId: req.params.id
      });

      return sendSuccess(res, {
        data: result,
        message: 'Blog post unpublished successfully.'
      });
    },

    async deleteBlogPost(req, res) {
      const result = await adminService.deleteBlogPost({
        adminId: req.admin.id,
        postId: req.params.id
      });

      return sendSuccess(res, {
        data: result,
        message: 'Blog post archived successfully.'
      });
    },

    async listBlogComments(req, res) {
      const result = await adminService.listBlogComments({
        query: req.query
      });

      return sendSuccess(res, {
        data: result,
        message: 'Blog comments fetched successfully.'
      });
    },

    async updateBlogComment(req, res) {
      const result = await adminService.updateBlogComment({
        adminId: req.admin.id,
        commentId: req.params.id,
        status: req.body.status
      });

      return sendSuccess(res, {
        data: result,
        message: 'Blog comment updated successfully.'
      });
    },

    async listNewsletterSubscribers(req, res) {
      const result = await adminService.listNewsletterSubscribers({
        query: req.query
      });

      return sendSuccess(res, {
        data: result,
        message: 'Newsletter subscribers fetched successfully.'
      });
    },

    async exportNewsletterSubscribers(req, res) {
      const result = await adminService.exportNewsletterSubscribersCsv({
        adminId: req.admin.id,
        query: req.query
      });

      res.set('Content-Disposition', `attachment; filename="${result.filename}"`);
      return res.status(200).type('text/csv').send(result.csv);
    },

    async deleteVehicleTaxonomyEntry(req, res) {
      const result = await adminService.deleteVehicleTaxonomyEntry({
        vehicleTaxonomyId: req.params.id
      });

      return sendSuccess(res, {
        data: result,
        message: 'Vehicle taxonomy entry deleted successfully.'
      });
    },

    async getCategory(req, res) {
      const result = await adminService.getCategory({
        categoryId: req.params.id
      });

      return sendSuccess(res, {
        data: result,
        message: 'Category fetched successfully.'
      });
    },

    async getMe(req, res) {
      return sendSuccess(res, {
        data: req.admin,
        message: 'Admin profile fetched successfully.'
      });
    },

    async getPlatformConfig(req, res) {
      const result = await adminService.getPlatformConfig();

      return sendSuccess(res, {
        data: result,
        message: 'Platform configuration fetched successfully.'
      });
    },

    async listAuditLogs(req, res) {
      const result = await adminService.listAuditLogs({
        query: req.query
      });

      return sendSuccess(res, {
        data: result,
        message: 'Audit logs fetched successfully.'
      });
    },

    async getSellerVerificationCandidate(req, res) {
      const result = await adminService.getSellerVerificationCandidate({
        sellerId: req.params.id
      });

      return sendSuccess(res, {
        data: result,
        message: 'Seller verification profile fetched successfully.'
      });
    },

    async getVehicleTaxonomyEntry(req, res) {
      const result = await adminService.getVehicleTaxonomyEntry({
        vehicleTaxonomyId: req.params.id
      });

      return sendSuccess(res, {
        data: result,
        message: 'Vehicle taxonomy entry fetched successfully.'
      });
    },

    async listCategories(req, res) {
      const result = await adminService.listCategories({
        query: req.query
      });

      return sendSuccess(res, {
        data: result,
        message: 'Categories fetched successfully.'
      });
    },

    async listOrders(req, res) {
      const result = await adminService.listOrders({
        query: req.query
      });

      return sendSuccess(res, {
        data: result,
        message: 'Orders fetched successfully.'
      });
    },

    async reconcilePendingPayments(req, res) {
      const result = await adminService.reconcilePendingPayments({
        adminId: req.admin.id,
        limit: req.body.limit,
        olderThanMinutes: req.body.olderThanMinutes
      });

      return sendSuccess(res, {
        data: result,
        message: 'Pending payments reconciled successfully.'
      });
    },

    async listLogisticsCompanies(req, res) {
      const result = await adminService.listLogisticsCompanies({
        query: req.query
      });

      return sendSuccess(res, {
        data: result,
        message: 'Logistics companies fetched successfully.'
      });
    },

    async listLogisticsRiders(req, res) {
      const result = await adminService.listLogisticsRiders({
        query: req.query
      });

      return sendSuccess(res, {
        data: result,
        message: 'Logistics riders fetched successfully.'
      });
    },

    async listDeliveryJobs(req, res) {
      const result = await adminService.listDeliveryJobs({
        query: req.query
      });

      return sendSuccess(res, {
        data: result,
        message: 'Delivery jobs fetched successfully.'
      });
    },

    async listDisputes(req, res) {
      const result = await adminService.listDisputes({
        query: req.query
      });

      return sendSuccess(res, {
        data: result,
        message: 'Disputes fetched successfully.'
      });
    },

    async listPayouts(req, res) {
      const result = await adminService.listPayouts({
        query: req.query
      });

      return sendSuccess(res, {
        data: result,
        message: 'Payout requests fetched successfully.'
      });
    },

    async listSellerVerificationQueue(req, res) {
      const result = await adminService.listSellerVerificationQueue({
        query: req.query
      });

      return sendSuccess(res, {
        data: result,
        message: 'Seller verification review queue fetched successfully.'
      });
    },

    async listUsers(req, res) {
      const result = await adminService.listUsers({
        query: req.query
      });

      return sendSuccess(res, {
        data: result,
        message: 'Users fetched successfully.'
      });
    },

    async listVehicleTaxonomy(req, res) {
      const result = await adminService.listVehicleTaxonomy({
        query: req.query
      });

      return sendSuccess(res, {
        data: result,
        message: 'Vehicle taxonomy fetched successfully.'
      });
    },

    async login(req, res) {
      const result = await adminService.login({
        email: req.body.email,
        password: req.body.password
      });

      return sendSuccess(res, {
        data: result,
        message: 'Admin login successful.'
      });
    },

    async updateCategory(req, res) {
      const result = await adminService.updateCategory({
        categoryId: req.params.id,
        name: req.body.name,
        slug: req.body.slug,
        parentId: req.body.parentId,
        status: req.body.status
      });

      return sendSuccess(res, {
        data: result,
        message: 'Category updated successfully.'
      });
    },

    async updateSellerVerificationStatus(req, res) {
      const result = await adminService.updateSellerVerificationStatus({
        adminId: req.admin.id,
        sellerId: req.params.id,
        verificationStatus: req.body.verificationStatus,
        rejectionReason: req.body.rejectionReason
      });

      return sendSuccess(res, {
        data: result,
        message: 'Seller verification status updated successfully.'
      });
    },

    async updateOrderStatus(req, res) {
      const result = await adminService.updateOrderStatus({
        adminId: req.admin.id,
        orderId: req.params.id,
        status: req.body.status,
        note: req.body.note
      });

      return sendSuccess(res, {
        data: result,
        message: 'Order status updated successfully.'
      });
    },

    async updateLogisticsCompanyStatus(req, res) {
      const result = await adminService.updateLogisticsCompanyStatus({
        adminId: req.admin.id,
        companyId: req.params.id,
        status: req.body.status
      });

      return sendSuccess(res, {
        data: result,
        message: 'Logistics company status updated successfully.'
      });
    },

    async assignDeliveryJob(req, res) {
      const result = await adminService.assignDeliveryJob({
        adminId: req.admin.id,
        jobId: req.params.id,
        riderId: req.body.riderId,
        note: req.body.note
      });

      return sendSuccess(res, {
        data: result,
        message: 'Delivery job assigned successfully.'
      });
    },

    async updateDispute(req, res) {
      const result = await adminService.updateDispute({
        adminId: req.admin.id,
        disputeId: req.params.id,
        status: req.body.status,
        resolutionNote: req.body.resolutionNote,
        refundReference: req.body.refundReference,
        refundAmountKobo: req.body.refundAmountKobo
      });

      return sendSuccess(res, {
        data: result,
        message: 'Dispute decision recorded successfully.'
      });
    },

    async updatePayoutStatus(req, res) {
      const result = await adminService.updatePayoutStatus({
        adminId: req.admin.id,
        payoutId: req.params.id,
        status: req.body.status,
        rejectionReason: req.body.rejectionReason
      });

      return sendSuccess(res, {
        data: result,
        message: 'Payout status updated successfully.'
      });
    },

    async updatePlatformConfig(req, res) {
      const result = await adminService.updatePlatformConfig({
        adminId: req.admin.id,
        commissionRateDefault: req.body.commissionRateDefault,
        commissionRatesByCategory: req.body.commissionRatesByCategory,
        commissionRatesBySellerTier: req.body.commissionRatesBySellerTier,
        platformSettings: req.body.platformSettings
      });

      return sendSuccess(res, {
        data: result,
        message: 'Platform configuration updated successfully.'
      });
    },

    async updateUserStatus(req, res) {
      const result = await adminService.updateUserStatus({
        adminId: req.admin.id,
        userId: req.params.id,
        status: req.body.status
      });

      return sendSuccess(res, {
        data: result,
        message: 'User account status updated successfully.'
      });
    },

    async updateVehicleTaxonomyEntry(req, res) {
      const result = await adminService.updateVehicleTaxonomyEntry({
        vehicleTaxonomyId: req.params.id,
        make: req.body.make,
        model: req.body.model,
        yearFrom: req.body.yearFrom,
        yearTo: req.body.yearTo
      });

      return sendSuccess(res, {
        data: result,
        message: 'Vehicle taxonomy entry updated successfully.'
      });
    }
  };
}

module.exports = {
  createAdminController
};
