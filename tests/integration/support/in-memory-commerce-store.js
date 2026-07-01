function createInMemoryCommerceStore() {
  return {
    addresses: [],
    cartItems: [],
    carts: [],
    orderItems: [],
    orderStatusHistory: [],
    orders: [],
    payments: [],
    counters: {
      addressId: 1,
      cartId: 1,
      cartItemId: 1,
      orderId: 1,
      orderItemId: 1,
      orderStatusHistoryId: 1,
      paymentId: 1
    }
  };
}

module.exports = {
  createInMemoryCommerceStore
};
