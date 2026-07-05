const { sendSuccess } = require('../utils/responses');

function createSellerController({ sellersService }) {
  return {
    async getMe(req, res) {
      const sellerAccount = await sellersService.getSellerProfile(req.user.id);

      return sendSuccess(res, {
        data: sellerAccount,
        message: 'Seller profile fetched successfully.'
      });
    },

    async register(req, res) {
      const result = await sellersService.registerSeller(req.body);

      return sendSuccess(res, {
        statusCode: 201,
        data: result,
        message: 'Seller account created successfully.'
      });
    },

    async uploadDocuments(req, res) {
      const result = await sellersService.uploadDocuments({
        userId: req.user.id,
        documents: req.uploadedSellerDocuments || {}
      });

      return sendSuccess(res, {
        data: result,
        message: 'Seller documents uploaded successfully.'
      });
    }
  };
}

module.exports = {
  createSellerController
};
