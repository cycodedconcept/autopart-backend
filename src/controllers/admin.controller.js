const { sendSuccess } = require('../utils/responses');

function createAdminController({ adminService }) {
  return {
    async getMe(req, res) {
      return sendSuccess(res, {
        data: req.admin,
        message: 'Admin profile fetched successfully.'
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

    async updateSellerVerificationStatus(req, res) {
      const result = await adminService.updateSellerVerificationStatus({
        sellerId: req.params.id,
        verificationStatus: req.body.verificationStatus,
        rejectionReason: req.body.rejectionReason
      });

      return sendSuccess(res, {
        data: result,
        message: 'Seller verification status updated successfully.'
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
    }
  };
}

module.exports = {
  createAdminController
};
