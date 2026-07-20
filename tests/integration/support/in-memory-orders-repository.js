const {
  ORDER_ITEM_STATUSES,
  ORDER_STATUSES,
  PAYMENT_STATUSES
} = require('../../../src/config/constants');
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

function createInMemoryOrdersRepository({ productsRepository, store, usersRepository }) {
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
      deliveryFeeKobo: Number(orderItem.deliveryFeeKobo || 0),
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

  async function mapAdminOrder(order) {
    if (!order) {
      return null;
    }

    const buyer = usersRepository && typeof usersRepository.findById === 'function'
      ? await usersRepository.findById(order.buyerId)
      : null;
    const sellerCount = new Set(
      store.orderItems
        .filter((item) => item.orderId === order.id)
        .map((item) => item.sellerId)
    ).size;

    return {
      ...mapOrder(order, getOrderTotalItems(order.id)),
      buyerFullName: buyer ? buyer.fullName : `Buyer #${order.buyerId}`,
      buyerEmail: buyer ? buyer.email : null,
      buyerPhone: buyer ? buyer.phone : null,
      sellerCount
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
          deliveryFeeKobo: item.deliveryFeeKobo || 0,
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

    async listOrdersForAdmin(filters) {
      const matchedOrders = store.orders
        .filter((order) => (
          (!filters.status || filters.status === 'all' || order.status === filters.status)
          && (
            !filters.paymentStatus
            || filters.paymentStatus === 'all'
            || order.paymentStatus === filters.paymentStatus
          )
        ))
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
      const filteredOrders = [];

      for (const order of matchedOrders) {
        const mappedOrder = await mapAdminOrder(order);

        if (!filters.search) {
          filteredOrders.push(mappedOrder);
          continue;
        }

        const search = String(filters.search).toLowerCase();
        const searchableFields = [
          String(mappedOrder.id),
          mappedOrder.paymentReference,
          mappedOrder.buyerFullName,
          mappedOrder.buyerEmail,
          mappedOrder.buyerPhone
        ];

        if (searchableFields.some((value) => String(value || '').toLowerCase().includes(search))) {
          filteredOrders.push(mappedOrder);
        }
      }

      return {
        orders: filteredOrders.slice(filters.offset, filters.offset + filters.limit),
        total: filteredOrders.length
      };
    },

    async summarizeSellerOrders({ sellerId }) {
      const matchedItems = store.orderItems.filter((item) => item.sellerId === Number(sellerId));
      const orderIds = new Set(matchedItems.map((item) => item.orderId));
      const customerIds = new Set();
      const paidOrderIds = new Set();
      const unpaidOrderIds = new Set();
      const pendingOrderIds = new Set();

      for (const orderId of orderIds) {
        const order = store.orders.find((entry) => entry.id === orderId);

        if (!order) {
          continue;
        }

        customerIds.add(order.buyerId);

        if (order.paymentStatus === PAYMENT_STATUSES.PAID) {
          paidOrderIds.add(orderId);
        } else {
          unpaidOrderIds.add(orderId);
        }
      }

      for (const item of matchedItems) {
        if (item.itemStatus === ORDER_ITEM_STATUSES.PENDING) {
          pendingOrderIds.add(item.orderId);
        }
      }

      return {
        totalOrders: orderIds.size,
        paidOrders: paidOrderIds.size,
        unpaidOrders: unpaidOrderIds.size,
        totalCustomers: customerIds.size,
        pendingOrders: pendingOrderIds.size,
        sellerLineItems: matchedItems.length,
        totalItems: matchedItems.reduce((sum, item) => sum + Number(item.quantity), 0),
        pendingLineItems: matchedItems.filter((item) => item.itemStatus === ORDER_ITEM_STATUSES.PENDING).length,
        readyForPickupLineItems: matchedItems.filter((item) => (
          item.itemStatus === ORDER_ITEM_STATUSES.READY_FOR_PICKUP
        )).length,
        pickedUpLineItems: matchedItems.filter((item) => item.itemStatus === ORDER_ITEM_STATUSES.PICKED_UP).length,
        deliveredLineItems: matchedItems.filter((item) => item.itemStatus === ORDER_ITEM_STATUSES.DELIVERED).length,
        cancelledLineItems: matchedItems.filter((item) => item.itemStatus === ORDER_ITEM_STATUSES.CANCELLED).length
      };
    },

    async summarizeSellerOrderTrends(filters) {
      const currentFromTime = Date.parse(`${filters.currentDateFrom}T00:00:00.000Z`);
      const currentToTime = Date.parse(`${filters.currentDateTo}T23:59:59.999Z`);
      const previousFromTime = Date.parse(`${filters.previousDateFrom}T00:00:00.000Z`);
      const previousToTime = Date.parse(`${filters.previousDateTo}T23:59:59.999Z`);
      const currentOrderIds = new Set();
      const previousOrderIds = new Set();
      const currentCustomerIds = new Set();
      const previousCustomerIds = new Set();

      for (const item of store.orderItems) {
        if (item.sellerId !== Number(filters.sellerId)) {
          continue;
        }

        const order = store.orders.find((entry) => entry.id === item.orderId);

        if (!order) {
          continue;
        }

        const createdAtTime = Date.parse(order.createdAt);

        if (createdAtTime >= currentFromTime && createdAtTime <= currentToTime) {
          currentOrderIds.add(order.id);
          currentCustomerIds.add(order.buyerId);
        }

        if (createdAtTime >= previousFromTime && createdAtTime <= previousToTime) {
          previousOrderIds.add(order.id);
          previousCustomerIds.add(order.buyerId);
        }
      }

      return {
        currentPeriodOrders: currentOrderIds.size,
        previousPeriodOrders: previousOrderIds.size,
        currentPeriodCustomers: currentCustomerIds.size,
        previousPeriodCustomers: previousCustomerIds.size
      };
    },

    async listSellerTopCustomers({ limit, sellerId }) {
      const paidSellerItems = store.orderItems.filter((item) => {
        if (item.sellerId !== Number(sellerId) || item.itemStatus === ORDER_ITEM_STATUSES.CANCELLED) {
          return false;
        }

        const order = store.orders.find((entry) => entry.id === item.orderId);

        return order
          && order.paymentStatus === PAYMENT_STATUSES.PAID
          && order.status !== ORDER_STATUSES.CANCELLED;
      });
      const byBuyerId = new Map();

      for (const item of paidSellerItems) {
        const order = store.orders.find((entry) => entry.id === item.orderId);

        if (!order) {
          continue;
        }

        const customer = byBuyerId.get(order.buyerId) || {
          buyerId: order.buyerId,
          totalOrders: new Set(),
          totalItems: 0,
          totalSpentKobo: 0
        };

        customer.totalOrders.add(order.id);
        customer.totalItems += Number(item.quantity);
        customer.totalSpentKobo += Number(item.lineTotalKobo);
        byBuyerId.set(order.buyerId, customer);
      }

      const customers = await Promise.all(
        Array.from(byBuyerId.values())
          .sort((left, right) => (
            right.totalSpentKobo - left.totalSpentKobo
            || right.totalOrders.size - left.totalOrders.size
            || left.buyerId - right.buyerId
          ))
          .slice(0, limit)
          .map(async (entry) => {
            const user = usersRepository && typeof usersRepository.findById === 'function'
              ? await usersRepository.findById(entry.buyerId)
              : null;

            return {
              buyerId: entry.buyerId,
              fullName: user ? user.fullName : `Customer #${entry.buyerId}`,
              email: user ? user.email : null,
              phone: user ? user.phone : null,
              totalOrders: entry.totalOrders.size,
              totalItems: entry.totalItems,
              totalSpentKobo: entry.totalSpentKobo
            };
          })
      );

      return customers;
    },

    async findOrderByIdForBuyer(orderId, buyerId) {
      const order = store.orders.find((entry) => (
        entry.id === Number(orderId) && entry.buyerId === Number(buyerId)
      ));

      return order ? mapOrder(order, getOrderTotalItems(order.id)) : null;
    },

    async findOrderByIdForAdmin(orderId) {
      const order = store.orders.find((entry) => entry.id === Number(orderId)) || null;

      return mapAdminOrder(order);
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

    async findOrderStatusHistoryByOrderIdForAdmin(orderId) {
      return clone(
        store.orderStatusHistory
          .filter((entry) => entry.orderId === Number(orderId))
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
    },

    async updateOrderStatusForAdmin(payload) {
      const order = store.orders.find((entry) => entry.id === Number(payload.orderId));

      if (!order) {
        return null;
      }

      const now = new Date().toISOString();

      order.status = payload.status;
      order.updatedAt = now;
      store.orderStatusHistory.push({
        id: store.counters.orderStatusHistoryId,
        orderId: order.id,
        status: payload.status,
        note: payload.note || null,
        createdAt: now,
        updatedAt: now
      });
      store.counters.orderStatusHistoryId += 1;

      return mapAdminOrder(order);
    }
  };
}

module.exports = {
  createInMemoryOrdersRepository
};
