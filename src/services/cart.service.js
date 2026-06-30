const { ERROR_CODES } = require('../config/constants');
const AppError = require('../utils/app-error');
const { calculateCartSummary } = require('../utils/cart');

function mapCartItem(item) {
  return {
    id: item.id,
    quantity: item.quantity,
    unitPriceKobo: item.unitPriceKobo,
    lineTotalKobo: item.lineTotalKobo,
    product: {
      id: item.product.id,
      title: item.product.title,
      partNumber: item.product.partNumber,
      condition: item.product.condition,
      location: item.product.location,
      stockQty: item.product.stockQty,
      status: item.product.status,
      primaryImageUrl: item.product.primaryImageUrl,
      // SELLER-STUB public seller info is projected from the product record for buyer reads.
      seller: {
        id: item.product.seller.id,
        businessName: item.product.seller.businessName,
        rating: item.product.seller.rating
      }
    }
  };
}

function mapCart(cart) {
  const items = cart.items.map(mapCartItem);
  const summary = calculateCartSummary(items);

  return {
    id: cart.id,
    items,
    summary
  };
}

function createCartService({ cartsRepository, productsRepository }) {
  async function addItem(payload) {
    const product = await productsRepository.findProductById(payload.productId);

    if (!product) {
      throw new AppError('Product was not found.', {
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND
      });
    }

    const cart = await cartsRepository.ensureCartForUserId(payload.userId);
    const existingCartItem = await cartsRepository.findCartItemByProductId(cart.id, payload.productId);
    const nextQuantity = existingCartItem
      ? existingCartItem.quantity + payload.quantity
      : payload.quantity;

    if (product.stockQty < nextQuantity) {
      throw new AppError('Requested quantity exceeds available stock.', {
        statusCode: 409,
        code: ERROR_CODES.OUT_OF_STOCK
      });
    }

    if (existingCartItem) {
      await cartsRepository.updateCartItemQuantity(existingCartItem.id, nextQuantity);
    } else {
      await cartsRepository.createCartItem({
        cartId: cart.id,
        productId: payload.productId,
        quantity: payload.quantity,
        unitPriceKobo: product.priceKobo
      });
    }

    return mapCart(await cartsRepository.getCartByUserId(payload.userId));
  }

  async function getCart(userId) {
    return mapCart(await cartsRepository.getCartByUserId(userId));
  }

  async function removeItem(payload) {
    const existingCartItem = await cartsRepository.findCartItemByIdForUser(
      payload.userId,
      payload.cartItemId
    );

    if (!existingCartItem) {
      throw new AppError('Cart item was not found.', {
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND
      });
    }

    await cartsRepository.deleteCartItem(payload.cartItemId);

    return mapCart(await cartsRepository.getCartByUserId(payload.userId));
  }

  async function updateItemQuantity(payload) {
    const existingCartItem = await cartsRepository.findCartItemByIdForUser(
      payload.userId,
      payload.cartItemId
    );

    if (!existingCartItem) {
      throw new AppError('Cart item was not found.', {
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND
      });
    }

    const product = await productsRepository.findProductById(existingCartItem.productId);

    if (!product) {
      throw new AppError('Product is no longer available.', {
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND
      });
    }

    if (product.stockQty < payload.quantity) {
      throw new AppError('Requested quantity exceeds available stock.', {
        statusCode: 409,
        code: ERROR_CODES.OUT_OF_STOCK
      });
    }

    await cartsRepository.updateCartItemQuantity(payload.cartItemId, payload.quantity);

    return mapCart(await cartsRepository.getCartByUserId(payload.userId));
  }

  return {
    addItem,
    getCart,
    removeItem,
    updateItemQuantity
  };
}

module.exports = {
  createCartService
};
