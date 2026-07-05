const { sendSuccess } = require('../utils/responses');

function createSellerOrdersController({ ordersService }) {
  return {
    async listOrders(req, res) {
      const result = await ordersService.listSellerOrders({
        userId: req.user.id,
        query: req.query
      });

      return sendSuccess(res, {
        data: result,
        message: 'Seller orders fetched successfully.'
      });
    },

    async updateOrderItemStatus(req, res) {
      const result = await ordersService.updateSellerOrderItemStatus({
        userId: req.user.id,
        orderItemId: req.params.id,
        itemStatus: req.body.itemStatus
      });

      return sendSuccess(res, {
        data: result,
        message: 'Seller order item status updated successfully.'
      });
    }
  };
}

module.exports = {
  createSellerOrdersController
};
