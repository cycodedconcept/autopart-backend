const { sendSuccess } = require('../utils/responses');

function createProductsController({ productsService }) {
  return {
    async getProductById(req, res) {
      const product = await productsService.getProductById(req.params.id);

      return sendSuccess(res, {
        data: product,
        message: 'Product fetched successfully.'
      });
    },

    async listProducts(req, res) {
      const result = await productsService.listProducts(req.query);

      return sendSuccess(res, {
        data: result,
        message: 'Products fetched successfully.'
      });
    }
  };
}

module.exports = {
  createProductsController
};
