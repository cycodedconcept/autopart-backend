const {
  ERROR_CODES,
  ORDER_ITEM_STATUSES,
  ORDER_STATUSES,
  PAYMENT_STATUSES
} = require('../config/constants');
const AppError = require('../utils/app-error');
const { calculateCartSummary, calculateLineTotalKobo } = require('../utils/cart');
const { buildPagination, normalizePagination } = require('../utils/pagination');
const { normalizeNigerianPhone } = require('../utils/phone');

const receiptCurrencyFormatter = new Intl.NumberFormat('en-NG', {
  currency: 'NGN',
  minimumFractionDigits: 2,
  style: 'currency'
});

function escapeHtml(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatKoboAsNaira(amountKobo) {
  return receiptCurrencyFormatter.format(Number(amountKobo || 0) / 100);
}

function mapCreatedOrderItem(item) {
  return {
    productId: item.product.id,
    title: item.product.title,
    partNumber: item.product.partNumber,
    condition: item.product.condition,
    location: item.product.location,
    quantity: item.quantity,
    unitPriceKobo: item.unitPriceKobo,
    lineTotalKobo: item.lineTotalKobo,
    itemStatus: ORDER_ITEM_STATUSES.PENDING,
    primaryImageUrl: item.product.primaryImageUrl || null,
    seller: {
      id: item.product.seller.id,
      businessName: item.product.seller.businessName,
      rating: item.product.seller.rating
    }
  };
}

function mapAddress(address) {
  return {
    id: address.id,
    label: address.label,
    street: address.street,
    city: address.city,
    state: address.state,
    phone: address.phone
  };
}

function mapOrderAddressFromOrder(order) {
  return {
    id: order.deliveryAddressId,
    label: order.deliveryLabel,
    street: order.deliveryStreet,
    city: order.deliveryCity,
    state: order.deliveryState,
    phone: order.deliveryPhone
  };
}

function mapStoredOrderItem(item) {
  return {
    id: item.id,
    productId: item.productId,
    title: item.title,
    partNumber: item.partNumber,
    condition: item.condition,
    location: item.location,
    quantity: item.quantity,
    unitPriceKobo: item.unitPriceKobo,
    lineTotalKobo: item.lineTotalKobo,
    itemStatus: item.itemStatus,
    primaryImageUrl: item.primaryImageUrl,
    seller: {
      id: item.sellerId,
      businessName: item.sellerBusinessName,
      rating: item.sellerRating
    }
  };
}

function mapStatusHistoryEntry(entry) {
  return {
    id: entry.id,
    status: entry.status,
    note: entry.note,
    createdAt: entry.createdAt
  };
}

function mapOrderSummary(order) {
  return {
    id: order.id,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    subtotalKobo: order.subtotalKobo,
    deliveryFeeKobo: order.deliveryFeeKobo,
    totalKobo: order.totalKobo,
    totalItems: order.totalItems,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  };
}

function mapOrderDetail(order, items, statusHistory) {
  return {
    id: order.id,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentReference: order.paymentReference,
    paymentStatus: order.paymentStatus,
    subtotalKobo: order.subtotalKobo,
    deliveryFeeKobo: order.deliveryFeeKobo,
    totalKobo: order.totalKobo,
    totalItems: order.totalItems,
    deliveryAddress: mapOrderAddressFromOrder(order),
    items: items.map(mapStoredOrderItem),
    statusHistory: statusHistory.map(mapStatusHistoryEntry),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  };
}

function mapSellerOrderSummary(order, items) {
  return {
    id: order.id,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentReference: order.paymentReference,
    paymentStatus: order.paymentStatus,
    subtotalKobo: order.subtotalKobo,
    deliveryFeeKobo: order.deliveryFeeKobo,
    totalKobo: order.totalKobo,
    totalItems: order.totalItems,
    sellerLineItems: order.sellerLineItems,
    sellerTotalItems: order.sellerTotalItems,
    sellerTotalKobo: order.sellerTotalKobo,
    deliveryAddress: mapOrderAddressFromOrder(order),
    items: items.map(mapStoredOrderItem),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  };
}

function mapSellerOrderItemState(item) {
  return {
    ...mapStoredOrderItem(item),
    order: {
      id: item.orderId,
      status: item.orderStatus,
      paymentMethod: item.paymentMethod,
      paymentReference: item.paymentReference,
      paymentStatus: item.paymentStatus
    },
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

function canTransitionSellerOrderItem(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) {
    return false;
  }

  switch (currentStatus) {
    case ORDER_ITEM_STATUSES.PENDING:
      return (
        nextStatus === ORDER_ITEM_STATUSES.READY_FOR_PICKUP
        || nextStatus === ORDER_ITEM_STATUSES.CANCELLED
      );
    case ORDER_ITEM_STATUSES.READY_FOR_PICKUP:
      return nextStatus === ORDER_ITEM_STATUSES.CANCELLED;
    default:
      return false;
  }
}

function buildReceipt(detail) {
  return {
    receiptNumber: `RCPT-${detail.id}`,
    issuedAt: new Date().toISOString(),
    orderId: detail.id,
    status: detail.status,
    paymentMethod: detail.paymentMethod,
    paymentReference: detail.paymentReference,
    paymentStatus: detail.paymentStatus,
    subtotalKobo: detail.subtotalKobo,
    deliveryFeeKobo: detail.deliveryFeeKobo,
    totalKobo: detail.totalKobo,
    totalItems: detail.totalItems,
    deliveryAddress: detail.deliveryAddress,
    items: detail.items,
    statusHistory: detail.statusHistory,
    createdAt: detail.createdAt
  };
}

function buildOrderReceiptHtml(receipt) {
  const itemRows = receipt.items.map((item) => (
    `
      <tr>
        <td>${escapeHtml(item.title)}</td>
        <td>${escapeHtml(item.partNumber || 'N/A')}</td>
        <td>${item.quantity}</td>
        <td>${escapeHtml(formatKoboAsNaira(item.unitPriceKobo))}</td>
        <td>${escapeHtml(formatKoboAsNaira(item.lineTotalKobo))}</td>
      </tr>
    `
  )).join('');
  const statusRows = receipt.statusHistory.map((entry) => (
    `
      <tr>
        <td>${escapeHtml(entry.status)}</td>
        <td>${escapeHtml(entry.note || 'Status updated.')}</td>
        <td>${escapeHtml(entry.createdAt)}</td>
      </tr>
    `
  )).join('');

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Receipt ${escapeHtml(receipt.receiptNumber)}</title>
        <style>
          body {
            background: #f4f1e8;
            color: #1b1711;
            font-family: "Segoe UI", sans-serif;
            margin: 0;
            padding: 32px;
          }

          .receipt {
            background: #fffdf8;
            border: 1px solid #d8ccb8;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(49, 36, 20, 0.08);
            margin: 0 auto;
            max-width: 920px;
            padding: 32px;
          }

          h1, h2, p {
            margin-top: 0;
          }

          .meta,
          .totals,
          .address {
            display: grid;
            gap: 8px;
            margin-bottom: 24px;
          }

          .meta {
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          }

          .totals {
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          }

          .card {
            background: #f8f3e8;
            border-radius: 14px;
            padding: 16px;
          }

          table {
            border-collapse: collapse;
            margin-bottom: 24px;
            width: 100%;
          }

          th,
          td {
            border-bottom: 1px solid #e7dcc8;
            padding: 12px 10px;
            text-align: left;
          }

          th {
            background: #f3ead8;
            font-size: 12px;
            letter-spacing: 0.04em;
            text-transform: uppercase;
          }

          .muted {
            color: #6a5a46;
          }
        </style>
      </head>
      <body>
        <main class="receipt">
          <h1>AutoParts Marketplace Receipt</h1>
          <p class="muted">Receipt ${escapeHtml(receipt.receiptNumber)}</p>

          <section class="meta">
            <div class="card">
              <strong>Order ID</strong>
              <p>${receipt.orderId}</p>
            </div>
            <div class="card">
              <strong>Order Status</strong>
              <p>${escapeHtml(receipt.status)}</p>
            </div>
            <div class="card">
              <strong>Payment Status</strong>
              <p>${escapeHtml(receipt.paymentStatus)}</p>
            </div>
            <div class="card">
              <strong>Issued At</strong>
              <p>${escapeHtml(receipt.issuedAt)}</p>
            </div>
          </section>

          <section class="address">
            <h2>Delivery Address</h2>
            <div class="card">
              <p>${escapeHtml(receipt.deliveryAddress.label)}</p>
              <p>${escapeHtml(receipt.deliveryAddress.street)}</p>
              <p>${escapeHtml(receipt.deliveryAddress.city)}, ${escapeHtml(receipt.deliveryAddress.state)}</p>
              <p>${escapeHtml(receipt.deliveryAddress.phone)}</p>
            </div>
          </section>

          <h2>Items</h2>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Part Number</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Line Total</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>

          <section class="totals">
            <div class="card">
              <strong>Subtotal</strong>
              <p>${escapeHtml(formatKoboAsNaira(receipt.subtotalKobo))}</p>
            </div>
            <div class="card">
              <strong>Delivery Fee</strong>
              <p>${escapeHtml(formatKoboAsNaira(receipt.deliveryFeeKobo))}</p>
            </div>
            <div class="card">
              <strong>Total</strong>
              <p>${escapeHtml(formatKoboAsNaira(receipt.totalKobo))}</p>
            </div>
          </section>

          <h2>Status History</h2>
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Note</th>
                <th>Recorded At</th>
              </tr>
            </thead>
            <tbody>${statusRows}</tbody>
          </table>
        </main>
      </body>
    </html>
  `;
}

function createOrdersService({
  buyerAddressesRepository,
  cartsRepository,
  ordersRepository,
  sellersRepository
}) {
  async function resolveDeliveryAddress(userId, payload) {
    if (payload.deliveryAddressId) {
      const savedAddress = await buyerAddressesRepository.findBuyerAddressByIdForUser(
        userId,
        payload.deliveryAddressId
      );

      if (!savedAddress) {
        throw new AppError('Delivery address was not found.', {
          statusCode: 404,
          code: ERROR_CODES.NOT_FOUND
        });
      }

      return savedAddress;
    }

    return buyerAddressesRepository.createBuyerAddress({
      userId,
      label: payload.deliveryAddress.label.trim(),
      street: payload.deliveryAddress.street.trim(),
      city: payload.deliveryAddress.city.trim(),
      state: payload.deliveryAddress.state.trim(),
      phone: normalizeNigerianPhone(payload.deliveryAddress.phone),
      isDefault: false
    });
  }

  async function getOrderRecordOrThrow(userId, orderId) {
    const order = await ordersRepository.findOrderByIdForBuyer(orderId, userId);

    if (!order) {
      throw new AppError('Order was not found.', {
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND
      });
    }

    return order;
  }

  async function getOrderDetailRecord(userId, orderId) {
    const order = await getOrderRecordOrThrow(userId, orderId);
    const [items, statusHistory] = await Promise.all([
      ordersRepository.findOrderItemsByOrderId(order.id, userId),
      ordersRepository.findOrderStatusHistoryByOrderId(order.id, userId)
    ]);

    return {
      items,
      order,
      statusHistory
    };
  }

  async function ensureSellerProfile(userId) {
    if (!sellersRepository) {
      throw new AppError('Seller order operations are unavailable.', {
        statusCode: 500,
        code: ERROR_CODES.INTERNAL_SERVER_ERROR
      });
    }

    const sellerAccount = await sellersRepository.findByUserId(userId);

    if (!sellerAccount) {
      throw new AppError('Seller profile was not found.', {
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND
      });
    }

    return sellerAccount;
  }

  async function createOrder(payload) {
    const cart = await cartsRepository.getCartByUserId(payload.userId);

    if (!cart.items.length) {
      throw new AppError('Cart is empty.', {
        statusCode: 400,
        code: ERROR_CODES.CART_EMPTY
      });
    }

    for (const item of cart.items) {
      if (item.product.status !== 'active') {
        throw new AppError('One or more cart items are no longer available.', {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT
        });
      }

      if (item.product.stockQty < item.quantity) {
        throw new AppError('One or more cart items exceed available stock.', {
          statusCode: 409,
          code: ERROR_CODES.OUT_OF_STOCK
        });
      }
    }

    const deliveryAddress = await resolveDeliveryAddress(payload.userId, payload);
    const summary = calculateCartSummary(cart.items, {
      // Logistics is out of scope for Milestone C, so delivery is zero-rated for now.
      deliveryFeeKobo: 0
    });
    const order = await ordersRepository.createOrder({
      buyerId: payload.userId,
      cartId: cart.id,
      status: ORDER_STATUSES.PENDING_PAYMENT,
      paymentMethod: payload.paymentMethod,
      paymentStatus: PAYMENT_STATUSES.PENDING,
      subtotalKobo: summary.subtotalKobo,
      deliveryFeeKobo: summary.deliveryFeeKobo,
      totalKobo: summary.totalKobo,
      deliveryAddressId: deliveryAddress.id,
      deliveryAddressSnapshot: {
        label: deliveryAddress.label,
        street: deliveryAddress.street,
        city: deliveryAddress.city,
        state: deliveryAddress.state,
        phone: deliveryAddress.phone
      },
      items: cart.items.map((item) => ({
        productId: item.product.id,
        sellerId: item.product.seller.id,
        quantity: item.quantity,
        unitPriceKobo: item.unitPriceKobo,
        lineTotalKobo: calculateLineTotalKobo(item.quantity, item.unitPriceKobo),
        itemStatus: ORDER_ITEM_STATUSES.PENDING
      }))
    });

    return {
      id: order.id,
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      subtotalKobo: order.subtotalKobo,
      deliveryFeeKobo: order.deliveryFeeKobo,
      totalKobo: order.totalKobo,
      deliveryAddress: mapAddress(deliveryAddress),
      items: cart.items.map(mapCreatedOrderItem),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    };
  }

  return {
    createOrder,

    async getOrderById(payload) {
      const detail = await getOrderDetailRecord(payload.userId, payload.orderId);

      return mapOrderDetail(detail.order, detail.items, detail.statusHistory);
    },

    async getOrderReceipt(payload) {
      const detail = await getOrderDetailRecord(payload.userId, payload.orderId);
      const receipt = buildReceipt(mapOrderDetail(detail.order, detail.items, detail.statusHistory));

      if (payload.format === 'html') {
        return {
          format: 'html',
          html: buildOrderReceiptHtml(receipt)
        };
      }

      return {
        format: 'json',
        receipt
      };
    },

    async getOrderStatus(payload) {
      const detail = await getOrderDetailRecord(payload.userId, payload.orderId);

      return {
        orderId: detail.order.id,
        paymentStatus: detail.order.paymentStatus,
        currentStatus: {
          status: detail.order.status,
          updatedAt: detail.order.updatedAt
        },
        history: detail.statusHistory.map(mapStatusHistoryEntry)
      };
    },

    async listOrders(payload) {
      const pagination = normalizePagination(payload, {
        defaultLimit: 10,
        maxLimit: 50
      });
      const result = await ordersRepository.listOrdersForBuyer({
        buyerId: payload.userId,
        status: payload.status || null,
        limit: pagination.limit,
        offset: pagination.offset
      });

      return {
        orders: result.orders.map(mapOrderSummary),
        pagination: buildPagination({
          page: pagination.page,
          limit: pagination.limit,
          total: result.total
        })
      };
    },

    async listSellerOrders(payload) {
      const sellerAccount = await ensureSellerProfile(payload.userId);
      const pagination = normalizePagination(payload.query, {
        defaultLimit: 10,
        maxLimit: 50
      });
      const result = await ordersRepository.listOrdersForSeller({
        sellerId: sellerAccount.sellerProfile.id,
        itemStatus: payload.query.itemStatus || null,
        limit: pagination.limit,
        offset: pagination.offset
      });
      const orderIds = result.orders.map((order) => order.id);
      const orderItems = await ordersRepository.findOrderItemsByOrderIdsForSeller(
        orderIds,
        sellerAccount.sellerProfile.id
      );
      const filteredOrderItems = payload.query.itemStatus
        ? orderItems.filter((item) => item.itemStatus === payload.query.itemStatus)
        : orderItems;
      const orderItemsById = filteredOrderItems.reduce((accumulator, item) => {
        const existingItems = accumulator.get(item.orderId) || [];
        existingItems.push(item);
        accumulator.set(item.orderId, existingItems);
        return accumulator;
      }, new Map());

      return {
        orders: result.orders.map((order) => (
          mapSellerOrderSummary(order, orderItemsById.get(order.id) || [])
        )),
        pagination: buildPagination({
          page: pagination.page,
          limit: pagination.limit,
          total: result.total
        })
      };
    },

    async updateSellerOrderItemStatus(payload) {
      const sellerAccount = await ensureSellerProfile(payload.userId);
      const existingOrderItem = await ordersRepository.findSellerOrderItemById(
        payload.orderItemId,
        sellerAccount.sellerProfile.id
      );

      if (!existingOrderItem) {
        throw new AppError('Seller order item was not found.', {
          statusCode: 404,
          code: ERROR_CODES.NOT_FOUND
        });
      }

      if (existingOrderItem.paymentStatus !== PAYMENT_STATUSES.PAID) {
        throw new AppError('Seller can only manage paid order items.', {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT
        });
      }

      if (
        existingOrderItem.orderStatus === ORDER_STATUSES.CANCELLED
        || existingOrderItem.orderStatus === ORDER_STATUSES.DELIVERED
      ) {
        throw new AppError('This order can no longer be updated by the seller.', {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT
        });
      }

      if (!canTransitionSellerOrderItem(existingOrderItem.itemStatus, payload.itemStatus)) {
        throw new AppError('This seller order item status change is not allowed.', {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT
        });
      }

      const updatedOrderItem = await ordersRepository.updateSellerOrderItemStatus({
        orderItemId: payload.orderItemId,
        sellerId: sellerAccount.sellerProfile.id,
        itemStatus: payload.itemStatus
      });

      if (payload.itemStatus === ORDER_ITEM_STATUSES.READY_FOR_PICKUP) {
        // LOGISTICS-STUB: pickup assignment and dispatch coordination land in the logistics module.
      }

      if (payload.itemStatus === ORDER_ITEM_STATUSES.CANCELLED) {
        // LOGISTICS-STUB: seller-side cancellations will later fan out to delivery/refund workflows.
      }

      return mapSellerOrderItemState(updatedOrderItem);
    }
  };
}

module.exports = {
  createOrdersService
};
