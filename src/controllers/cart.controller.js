const { sendSuccess } = require('../utils/responses');

function createCartController({ cartService }) {
  return {
    async addItem(req, res) {
      const cart = await cartService.addItem({
        userId: req.user.id,
        productId: req.body.productId,
        quantity: req.body.quantity
      });

      return sendSuccess(res, {
        data: cart,
        message: 'Cart updated successfully.'
      });
    },

    async getCart(req, res) {
      const cart = await cartService.getCart(req.user.id);

      return sendSuccess(res, {
        data: cart,
        message: 'Cart fetched successfully.'
      });
    },

    async removeItem(req, res) {
      const cart = await cartService.removeItem({
        userId: req.user.id,
        cartItemId: req.params.id
      });

      return sendSuccess(res, {
        data: cart,
        message: 'Cart item removed successfully.'
      });
    },

    async updateItemQuantity(req, res) {
      const cart = await cartService.updateItemQuantity({
        userId: req.user.id,
        cartItemId: req.params.id,
        quantity: req.body.quantity
      });

      return sendSuccess(res, {
        data: cart,
        message: 'Cart updated successfully.'
      });
    }
  };
}

module.exports = {
  createCartController
};
