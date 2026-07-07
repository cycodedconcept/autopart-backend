const { sendSuccess } = require('../utils/responses');

function createAdminController({ adminService }) {
  return {
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
    }
  };
}

module.exports = {
  createAdminController
};
