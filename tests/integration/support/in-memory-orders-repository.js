const { createCatalogueFixture } = require('./catalogue-fixture');

function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

function mapOrder(order, totalItems) {
  if (!order) {
    return null;
  }

  return {
    id: order.id,
    buyerId: order.buyerId,
    status: order.status,
    paymentMethod: order.paymentMethod,
    subtotalKobo: order.subtotalKobo,
    deliveryFeeKobo: order.deliveryFeeKobo,
    totalKobo: order.totalKobo,
    deliveryAddressId: order.deliveryAddressId,
    deliveryLabel: order.deliveryLabel,
    deliveryStreet: order.deliveryStreet,
    deliveryCity: order.deliveryCity,
    deliveryState: order.deliveryState,
    deliveryPhone: order.deliveryPhone,
    paymentReference: order.paymentReference,
    paymentStatus: order.paymentStatus,
    totalItems,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  };
}

function createInMemoryOrdersRepository({ productsRepository, store }) {
  const fallbackProducts = createCatalogueFixture();

  function getOrderTotalItems(orderId) {
    return store.orderItems
      .filter((item) => item.orderId === Number(orderId))
      .reduce((sum, item) => sum + Number(item.quantity), 0);
  }

  async function resolveProduct(productId) {
    if (productsRepository && typeof productsRepository.findProductSnapshotById === 'function') {
      const product = await productsRepository.findProductSnapshotById(productId);

      if (product) {
        return product;
      }
    }

    return fallbackProducts.find((entry) => entry.id === Number(productId)) || null;
  }

  async function mapOrderItem(orderItem) {
    const product = await resolveProduct(orderItem.productId);

    return {
      id: orderItem.id,
      orderId: orderItem.orderId,
      productId: orderItem.productId,
      sellerId: orderItem.sellerId,
      quantity: Number(orderItem.quantity),
      unitPriceKobo: Number(orderItem.unitPriceKobo),
      lineTotalKobo: Number(orderItem.lineTotalKobo),
      itemStatus: orderItem.itemStatus,
      title: product ? product.title : null,
      partNumber: product ? product.partNumber : null,
      condition: product ? product.condition : null,
      location: product ? product.location : null,
      sellerBusinessName: product ? product.sellerBusinessName : null,
      sellerRating: product ? product.sellerRating : null,
      primaryImageUrl: product
        ? (product.primaryImageUrl || (product.images && product.images[0] ? product.images[0].url : null))
        : null,
      createdAt: orderItem.createdAt,
      updatedAt: orderItem.updatedAt
    };
  }

  function mapStatusHistoryEntry(entry) {
    return {
      id: entry.id,
      orderId: entry.orderId,
      status: entry.status,
      note: entry.note,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt
    };
  }

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
          itemStatus: item.itemStatus,
          createdAt: now,
          updatedAt: now
        });
        store.counters.orderItemId += 1;
      }

      store.counters.orderId += 1;
      store.orderStatusHistory.push({
        id: store.counters.orderStatusHistoryId,
        orderId: order.id,
        status: payload.status,
        note: 'Order created and awaiting payment.',
        createdAt: now,
        updatedAt: now
      });
      store.counters.orderStatusHistoryId += 1;
      store.cartItems = store.cartItems.filter((cartItem) => cartItem.cartId !== payload.cartId);

      return mapOrder(order, getOrderTotalItems(order.id));
    },

    async listOrdersForBuyer(filters) {
      const matchedOrders = store.orders
        .filter((order) => (
          order.buyerId === Number(filters.buyerId)
          && (!filters.status || order.status === filters.status)
        ))
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));

      return {
        orders: matchedOrders
          .slice(filters.offset, filters.offset + filters.limit)
          .map((order) => mapOrder(order, getOrderTotalItems(order.id))),
        total: matchedOrders.length
      };
    },

    async listOrdersForSeller(filters) {
      const matchedOrders = store.orders
        .filter((order) => {
          const sellerItems = store.orderItems.filter((item) => (
            item.orderId === order.id
            && item.sellerId === Number(filters.sellerId)
            && (!filters.itemStatus || item.itemStatus === filters.itemStatus)
          ));

          return sellerItems.length > 0;
        })
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));

      return {
        orders: matchedOrders
          .slice(filters.offset, filters.offset + filters.limit)
          .map((order) => {
            const sellerItems = store.orderItems.filter((item) => (
              item.orderId === order.id
              && item.sellerId === Number(filters.sellerId)
              && (!filters.itemStatus || item.itemStatus === filters.itemStatus)
            ));

            return {
              ...mapOrder(order, getOrderTotalItems(order.id)),
              sellerLineItems: sellerItems.length,
              sellerTotalItems: sellerItems.reduce((sum, item) => sum + Number(item.quantity), 0),
              sellerTotalKobo: sellerItems.reduce((sum, item) => sum + Number(item.lineTotalKobo), 0)
            };
          }),
        total: matchedOrders.length
      };
    },

    async findOrderByIdForBuyer(orderId, buyerId) {
      const order = store.orders.find((entry) => (
        entry.id === Number(orderId) && entry.buyerId === Number(buyerId)
      ));

      return order ? mapOrder(order, getOrderTotalItems(order.id)) : null;
    },

    async findOrderItemsByOrderId(orderId, buyerId) {
      const order = store.orders.find((entry) => (
        entry.id === Number(orderId) && entry.buyerId === Number(buyerId)
      ));

      if (!order) {
        return [];
      }

      return Promise.all(
        store.orderItems
          .filter((item) => item.orderId === order.id)
          .map(mapOrderItem)
      );
    },

    async findOrderItemsByOrderIdsForSeller(orderIds, sellerId) {
      return Promise.all(
        store.orderItems
          .filter((item) => (
            orderIds.includes(item.orderId) && item.sellerId === Number(sellerId)
          ))
          .sort((left, right) => {
            if (left.orderId !== right.orderId) {
              return right.orderId - left.orderId;
            }

            return left.id - right.id;
          })
          .map(mapOrderItem)
      );
    },

    async findSellerOrderItemById(orderItemId, sellerId) {
      const orderItem = store.orderItems.find((item) => (
        item.id === Number(orderItemId) && item.sellerId === Number(sellerId)
      ));

      if (!orderItem) {
        return null;
      }

      const order = store.orders.find((entry) => entry.id === orderItem.orderId);
      const mappedItem = await mapOrderItem(orderItem);

      return {
        ...mappedItem,
        orderStatus: order ? order.status : null,
        paymentMethod: order ? order.paymentMethod : null,
        paymentReference: order ? order.paymentReference : null,
        paymentStatus: order ? order.paymentStatus : null
      };
    },

    async findOrderStatusHistoryByOrderId(orderId, buyerId) {
      const order = store.orders.find((entry) => (
        entry.id === Number(orderId) && entry.buyerId === Number(buyerId)
      ));

      if (!order) {
        return [];
      }

      return clone(
        store.orderStatusHistory
          .filter((entry) => entry.orderId === order.id)
          .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt))
          .map(mapStatusHistoryEntry)
      );
    },

    async updateSellerOrderItemStatus(payload) {
      const orderItem = store.orderItems.find((item) => (
        item.id === Number(payload.orderItemId) && item.sellerId === Number(payload.sellerId)
      ));

      if (!orderItem) {
        return null;
      }

      orderItem.itemStatus = payload.itemStatus;
      orderItem.updatedAt = new Date().toISOString();

      return this.findSellerOrderItemById(orderItem.id, orderItem.sellerId);
    }
  };
}

module.exports = {
  createInMemoryOrdersRepository
};
