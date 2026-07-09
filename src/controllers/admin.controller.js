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
        message: 'Category deleted successfully.'
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
      const result = await adminService.listCategories();

      return sendSuccess(res, {
        data: result,
        message: 'Categories fetched successfully.'
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
        parentId: req.body.parentId
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
