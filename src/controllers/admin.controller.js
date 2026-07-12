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
