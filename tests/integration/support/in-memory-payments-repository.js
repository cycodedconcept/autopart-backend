function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

function mapOrder(order) {
  if (!order) {
    return null;
  }

  return {
    id: order.id,
    buyerId: order.buyerId,
    status: order.status,
    paymentMethod: order.paymentMethod,
    totalKobo: order.totalKobo,
    paymentReference: order.paymentReference,
    paymentStatus: order.paymentStatus,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  };
}

function mapPayment(payment, order) {
  if (!payment || !order) {
    return null;
  }

  return {
    paymentId: payment.id,
    orderId: order.id,
    buyerId: order.buyerId,
    provider: payment.provider,
    reference: payment.reference,
    amountKobo: payment.amountKobo,
    paymentStatus: payment.status,
    rawResponse: clone(payment.rawResponse),
    orderStatus: order.status,
    orderPaymentMethod: order.paymentMethod,
    orderTotalKobo: order.totalKobo,
    orderPaymentReference: order.paymentReference,
    orderPaymentStatus: order.paymentStatus,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt
  };
}

function createInMemoryPaymentsRepository({ productsRepository, store }) {
  function appendOrderStatusHistory(orderId, status, note, timestamp) {
    store.orderStatusHistory.push({
      id: store.counters.orderStatusHistoryId,
      orderId,
      status,
      note,
      createdAt: timestamp,
      updatedAt: timestamp
    });
    store.counters.orderStatusHistoryId += 1;
  }

  return {
    async findOrderForBuyer(orderId, buyerId) {
      return mapOrder(
        store.orders.find((entry) => entry.id === Number(orderId) && entry.buyerId === Number(buyerId)) || null
      );
    },

    async createPaymentAttempt(payload) {
      const order = store.orders.find((entry) => entry.id === Number(payload.orderId));

      if (!order) {
        return null;
      }

      const now = new Date().toISOString();
      const payment = {
        id: store.counters.paymentId,
        orderId: order.id,
        provider: payload.provider,
        reference: payload.reference,
        amountKobo: payload.amountKobo,
        status: payload.status,
        rawResponse: clone(payload.rawResponse),
        createdAt: now,
        updatedAt: now
      };

      store.payments.push(payment);
      store.counters.paymentId += 1;
      order.paymentReference = payload.reference;
      order.paymentStatus = payload.status;
      order.updatedAt = now;

      return mapPayment(payment, order);
    },

    async updatePaymentAttempt(reference, payload) {
      const payment = store.payments.find((entry) => entry.reference === reference);

      if (!payment) {
        return null;
      }

      const order = store.orders.find((entry) => entry.id === payment.orderId);
      const now = new Date().toISOString();

      payment.status = payload.status;
      payment.rawResponse = clone(payload.rawResponse);
      payment.updatedAt = now;

      if (order && order.paymentStatus !== 'paid') {
        order.paymentReference = reference;
        order.paymentStatus = payload.status;
        order.updatedAt = now;
      }

      return mapPayment(payment, order);
    },

    async findPaymentByReference(reference) {
      const payment = store.payments.find((entry) => entry.reference === reference);

      if (!payment) {
        return null;
      }

      const order = store.orders.find((entry) => entry.id === payment.orderId);
      return mapPayment(payment, order);
    },

    async reconcilePayment(reference, payload) {
      const payment = store.payments.find((entry) => entry.reference === reference);

      if (!payment) {
        return null;
      }

      const order = store.orders.find((entry) => entry.id === payment.orderId);
      const now = new Date().toISOString();

      payment.status = payload.paymentStatus;
      payment.rawResponse = clone(payload.rawResponse);
      payment.updatedAt = now;

      if (order) {
        if (payload.paymentStatus === 'paid') {
          order.paymentReference = reference;
          order.paymentStatus = 'paid';

          if (order.status === 'pending_payment') {
            if (productsRepository && typeof productsRepository.decrementStockLevels === 'function') {
              const stockEntries = store.orderItems
                .filter((item) => item.orderId === order.id)
                .map((item) => ({
                  productId: item.productId,
                  quantity: item.quantity
                }));

              await productsRepository.decrementStockLevels(stockEntries);
            }

            order.status = 'confirmed';
            appendOrderStatusHistory(
              order.id,
              'confirmed',
              'Payment verified and order confirmed.',
              now
            );
          }
        } else if (order.paymentStatus !== 'paid') {
          order.paymentReference = reference;
          order.paymentStatus = payload.paymentStatus;
        }

        order.updatedAt = now;
      }

      return mapPayment(payment, order);
    }
  };
}

module.exports = {
  createInMemoryPaymentsRepository
};
