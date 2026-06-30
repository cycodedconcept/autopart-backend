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
    }
  };
}

module.exports = {
  createOrdersController
};
