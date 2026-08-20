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

function mapWebhookEvent(event) {
  if (!event) {
    return null;
  }

  return {
    attemptCount: event.attemptCount,
    createdAt: event.createdAt,
    eventKey: event.eventKey,
    eventType: event.eventType,
    id: event.id,
    lastReceivedAt: event.lastReceivedAt,
    processedAt: event.processedAt,
    processingNotes: event.processingNotes,
    processingStatus: event.processingStatus,
    provider: event.provider,
    rawPayload: clone(event.rawPayload),
    receivedAt: event.receivedAt,
    reference: event.reference,
    updatedAt: event.updatedAt
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
          if (order.paymentStatus !== 'paid') {
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
          }
        } else if (order.paymentStatus !== 'paid') {
          order.paymentReference = reference;
          order.paymentStatus = payload.paymentStatus;
        }

        order.updatedAt = now;
      }

      return mapPayment(payment, order);
    },

    async recordWebhookEvent(payload) {
      const existingWebhookEvent = store.paymentWebhookEvents.find((entry) => (
        entry.provider === payload.provider
        && entry.eventType === payload.eventType
        && entry.eventKey === payload.eventKey
      ));
      const now = new Date().toISOString();

      if (existingWebhookEvent) {
        existingWebhookEvent.attemptCount += 1;
        existingWebhookEvent.lastReceivedAt = now;
        existingWebhookEvent.reference = payload.reference || existingWebhookEvent.reference;
        existingWebhookEvent.rawPayload = payload.payload ? clone(payload.payload) : existingWebhookEvent.rawPayload;
        existingWebhookEvent.updatedAt = now;

        return mapWebhookEvent(existingWebhookEvent);
      }

      const webhookEvent = {
        id: store.counters.paymentWebhookEventId,
        provider: payload.provider,
        eventType: payload.eventType,
        eventKey: payload.eventKey,
        reference: payload.reference || null,
        processingStatus: 'received',
        processingNotes: null,
        rawPayload: payload.payload ? clone(payload.payload) : null,
        attemptCount: 1,
        receivedAt: now,
        lastReceivedAt: now,
        processedAt: null,
        createdAt: now,
        updatedAt: now
      };

      store.paymentWebhookEvents.push(webhookEvent);
      store.counters.paymentWebhookEventId += 1;

      return mapWebhookEvent(webhookEvent);
    },

    async updateWebhookEventStatus(id, payload) {
      const webhookEvent = store.paymentWebhookEvents.find((entry) => entry.id === Number(id));

      if (!webhookEvent) {
        return null;
      }

      const now = new Date().toISOString();

      webhookEvent.processingStatus = payload.processingStatus;
      webhookEvent.processingNotes = payload.processingNotes || null;
      webhookEvent.processedAt = (
        payload.processingStatus === 'processed' || payload.processingStatus === 'ignored'
      )
        ? now
        : null;
      webhookEvent.updatedAt = now;

      return mapWebhookEvent(webhookEvent);
    },

    async listPendingPaymentsForReconciliation(payload) {
      const cutoffTime = Date.parse(payload.before);

      return store.payments
        .filter((payment) => payment.status === 'pending' && Date.parse(payment.createdAt) <= cutoffTime)
        .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt))
        .slice(0, payload.limit)
        .map((payment) => {
          const order = store.orders.find((entry) => entry.id === payment.orderId);

          if (!order || order.paymentStatus !== 'pending') {
            return null;
          }

          return mapPayment(payment, order);
        })
        .filter(Boolean);
    }
  };
}

module.exports = {
  createInMemoryPaymentsRepository
};
