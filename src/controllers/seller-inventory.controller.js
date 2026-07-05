const { sendSuccess } = require('../utils/responses');

function createSellerInventoryController({ productsService }) {
  return {
    async bulkUpload(req, res) {
      const result = await productsService.bulkUploadSellerInventory({
        userId: req.user.id,
        csvUpload: req.uploadedInventoryCsv || null
      });

      return sendSuccess(res, {
        statusCode: 201,
        data: result,
        message: 'Seller inventory csv processed successfully.'
      });
    },

    async getInventory(req, res) {
      const result = await productsService.getSellerInventory({
        userId: req.user.id,
        query: req.query
      });

      return sendSuccess(res, {
        data: result,
        message: 'Seller inventory fetched successfully.'
      });
    }
  };
}

module.exports = {
  createSellerInventoryController
};
