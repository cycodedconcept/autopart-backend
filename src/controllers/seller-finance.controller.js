const { sendSuccess } = require('../utils/responses');

function createSellerFinanceController({ sellerFinanceService }) {
  return {
    async getSalesSummary(req, res) {
      const result = await sellerFinanceService.getSellerSalesSummary({
        userId: req.user.id,
        query: req.query
      });

      return sendSuccess(res, {
        data: result,
        message: 'Seller sales summary fetched successfully.'
      });
    },

    async createPayoutRequest(req, res) {
      const result = await sellerFinanceService.createPayoutRequest({
        userId: req.user.id,
        bankAccountRef: req.body.bankAccountRef
      });

      return sendSuccess(res, {
        statusCode: 201,
        data: result,
        message: 'Seller payout request created successfully.'
      });
    },

    async listPayouts(req, res) {
      const result = await sellerFinanceService.listPayouts({
        userId: req.user.id,
        query: req.query
      });

      return sendSuccess(res, {
        data: result,
        message: 'Seller payout history fetched successfully.'
      });
    }
  };
}

module.exports = {
  createSellerFinanceController
};
