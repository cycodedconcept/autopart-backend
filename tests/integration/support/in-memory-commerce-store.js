function createInMemoryCommerceStore() {
  return {
    addresses: [],
    cartItems: [],
    carts: [],
    orderItems: [],
    orders: [],
    counters: {
      addressId: 1,
      cartId: 1,
      cartItemId: 1,
      orderId: 1,
      orderItemId: 1
    }
  };
}

module.exports = {
  createInMemoryCommerceStore
};
