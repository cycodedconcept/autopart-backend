const { sendSuccess } = require('../utils/responses');

function createOrdersController({ ordersService }) {
  return {
    async createOrder(req, res) {
      const order = await ordersService.createOrder({
        userId: req.user.id,
        paymentMethod: req.body.paymentMethod,
        deliveryAddressId: req.body.deliveryAddressId,
        deliveryAddress: req.body.deliveryAddress
      });

      return sendSuccess(res, {
        statusCode: 201,
        data: order,
        message: 'Order created successfully.'
      });
    },

    async getOrderById(req, res) {
      const order = await ordersService.getOrderById({
        userId: req.user.id,
        orderId: req.params.id
      });

      return sendSuccess(res, {
        data: order,
        message: 'Order fetched successfully.'
      });
    },

    async getOrderReceipt(req, res) {
      const result = await ordersService.getOrderReceipt({
        userId: req.user.id,
        orderId: req.params.id,
        format: req.query.format || 'json'
      });

      if (result.format === 'html') {
        return res.status(200).type('html').send(result.html);
      }

      return sendSuccess(res, {
        data: result.receipt,
        message: 'Order receipt fetched successfully.'
      });
    },

    async getOrderStatus(req, res) {
      const status = await ordersService.getOrderStatus({
        userId: req.user.id,
        orderId: req.params.id
      });

      return sendSuccess(res, {
        data: status,
        message: 'Order status fetched successfully.'
      });
    },

    async listOrders(req, res) {
      const result = await ordersService.listOrders({
        userId: req.user.id,
        status: req.query.status,
        page: req.query.page,
        limit: req.query.limit
      });

      return sendSuccess(res, {
        data: result,
        message: 'Orders fetched successfully.'
      });
    }
  };
}

module.exports = {
  createOrdersController
};
