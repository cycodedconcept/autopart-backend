const { sendSuccess } = require('../utils/responses');

function createSellerDashboardController({ sellerDashboardService }) {
  return {
    async getDashboard(req, res) {
      const result = await sellerDashboardService.getDashboard({
        userId: req.user.id,
        query: req.query
      });

      return sendSuccess(res, {
        data: result,
        message: 'Seller dashboard fetched successfully.'
      });
    }
  };
}

module.exports = {
  createSellerDashboardController
};
