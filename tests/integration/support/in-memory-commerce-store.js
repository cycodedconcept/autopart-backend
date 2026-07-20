function createInMemoryCommerceStore() {
  return {
    addresses: [],
    cartItems: [],
    carts: [],
    deliveryZones: [],
    deliveryJobStatusHistory: [],
    deliveryJobs: [],
    disputes: [],
    logisticsCompanies: [],
    orderItems: [],
    orderStatusHistory: [],
    orders: [],
    payments: [],
    payoutItems: [],
    payouts: [],
    riders: [],
    counters: {
      addressId: 1,
      cartId: 1,
      cartItemId: 1,
      deliveryZoneId: 1,
      deliveryJobId: 1,
      deliveryJobStatusHistoryId: 1,
      disputeId: 1,
      logisticsCompanyId: 1,
      orderId: 1,
      orderItemId: 1,
      orderStatusHistoryId: 1,
      paymentId: 1,
      payoutId: 1,
      payoutItemId: 1,
      riderId: 1
    }
  };
}

module.exports = {
  createInMemoryCommerceStore
};
