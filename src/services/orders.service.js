const {
  ERROR_CODES,
  ORDER_STATUSES,
  PAYMENT_STATUSES
} = require('../config/constants');
const AppError = require('../utils/app-error');
const { calculateCartSummary, calculateLineTotalKobo } = require('../utils/cart');
const { normalizeNigerianPhone } = require('../utils/phone');

function mapOrderItem(item) {
  return {
    productId: item.product.id,
    title: item.product.title,
    quantity: item.quantity,
    unitPriceKobo: item.unitPriceKobo,
    lineTotalKobo: item.lineTotalKobo,
    // SELLER-STUB public seller info is projected from the product record for buyer reads.
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

function createOrdersService({ buyerAddressesRepository, cartsRepository, ordersRepository }) {
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
        lineTotalKobo: calculateLineTotalKobo(item.quantity, item.unitPriceKobo)
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
      items: cart.items.map(mapOrderItem),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt
    };
  }

  return {
    createOrder
  };
}

module.exports = {
  createOrdersService
};
