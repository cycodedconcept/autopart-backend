function createInMemoryOrdersRepository({ store }) {
  return {
    async createOrder(payload) {
      const now = new Date().toISOString();
      const order = {
        id: store.counters.orderId,
        buyerId: payload.buyerId,
        status: payload.status,
        paymentMethod: payload.paymentMethod,
        subtotalKobo: payload.subtotalKobo,
        deliveryFeeKobo: payload.deliveryFeeKobo,
        totalKobo: payload.totalKobo,
        deliveryAddressId: payload.deliveryAddressId,
        deliveryLabel: payload.deliveryAddressSnapshot.label,
        deliveryStreet: payload.deliveryAddressSnapshot.street,
        deliveryCity: payload.deliveryAddressSnapshot.city,
        deliveryState: payload.deliveryAddressSnapshot.state,
        deliveryPhone: payload.deliveryAddressSnapshot.phone,
        paymentReference: payload.paymentReference || null,
        paymentStatus: payload.paymentStatus,
        createdAt: now,
        updatedAt: now
      };

      store.orders.push(order);

      for (const item of payload.items) {
        store.orderItems.push({
          id: store.counters.orderItemId,
          orderId: order.id,
          productId: item.productId,
          sellerId: item.sellerId,
          quantity: item.quantity,
          unitPriceKobo: item.unitPriceKobo,
          lineTotalKobo: item.lineTotalKobo,
          createdAt: now,
          updatedAt: now
        });
        store.counters.orderItemId += 1;
      }

      store.counters.orderId += 1;
      store.cartItems = store.cartItems.filter((cartItem) => cartItem.cartId !== payload.cartId);

      return {
        ...order
      };
    }
  };
}

module.exports = {
  createInMemoryOrdersRepository
};
