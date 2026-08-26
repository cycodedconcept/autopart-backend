const { sendSuccess } = require('../utils/responses');

function createSellerProductsController({ productsService }) {
  return {
    async createProduct(req, res) {
      let product;
      try {
        product = await productsService.createSellerProduct({
          userId: req.user.id,
          ...req.body,
          photos: req.uploadedProductImages || []
        });
      } catch (error) {
        if (req.cleanupUploadedProductImages) await req.cleanupUploadedProductImages();
        throw error;
      }

      return sendSuccess(res, {
        statusCode: 201,
        data: product,
        message: 'Seller product created successfully.'
      });
    },

    async deleteProduct(req, res) {
      const product = await productsService.deleteSellerProduct({
        userId: req.user.id,
        productId: req.params.id
      });

      return sendSuccess(res, {
        data: product,
        message: 'Seller product deleted successfully.'
      });
    },

    async listProducts(req, res) {
      const result = await productsService.listSellerProducts({
        userId: req.user.id,
        query: req.query
      });

      return sendSuccess(res, {
        data: result,
        message: 'Seller products fetched successfully.'
      });
    },

    async updateProduct(req, res) {
      let product;
      try {
        product = await productsService.updateSellerProduct({
          userId: req.user.id,
          productId: req.params.id,
          ...req.body,
          photos: req.uploadedProductImages
        });
      } catch (error) {
        if (req.cleanupUploadedProductImages) await req.cleanupUploadedProductImages();
        throw error;
      }

      return sendSuccess(res, {
        data: product,
        message: 'Seller product updated successfully.'
      });
    }
  };
}

module.exports = {
  createSellerProductsController
};
