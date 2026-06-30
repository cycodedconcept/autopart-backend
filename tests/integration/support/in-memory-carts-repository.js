const { createCatalogueFixture } = require('./catalogue-fixture');

function createInMemoryCartsRepository({ store }) {
  const products = createCatalogueFixture();

  function cloneCart(cart) {
    return cart ? { ...cart } : null;
  }

  function getProductById(productId) {
    return products.find((product) => product.id === Number(productId)) || null;
  }

  function mapDetailedCartItem(cartItem) {
    const product = getProductById(cartItem.productId);

    return {
      id: cartItem.id,
      cartId: cartItem.cartId,
      productId: cartItem.productId,
      quantity: cartItem.quantity,
      unitPriceKobo: cartItem.unitPriceKobo,
      lineTotalKobo: cartItem.quantity * cartItem.unitPriceKobo,
      product: {
        id: product.id,
        title: product.title,
        partNumber: product.partNumber,
        condition: product.condition,
        location: product.location,
        stockQty: product.stockQty,
        status: product.status,
        primaryImageUrl: product.images[0] ? product.images[0].url : null,
        seller: {
          id: product.sellerId,
          businessName: product.sellerBusinessName,
          rating: product.sellerRating
        }
      }
    };
  }

  function mapLookupCartItem(cartItem) {
    if (!cartItem) {
      return null;
    }

    const product = getProductById(cartItem.productId);

    return {
      id: cartItem.id,
      cartId: cartItem.cartId,
      productId: cartItem.productId,
      quantity: cartItem.quantity,
      unitPriceKobo: cartItem.unitPriceKobo,
      productStatus: product ? product.status : 'inactive',
      productStockQty: product ? product.stockQty : 0
    };
  }

  return {
    async createCart(userId) {
      const now = new Date().toISOString();
      const cart = {
        id: store.counters.cartId,
        userId,
        createdAt: now,
        updatedAt: now
      };

      store.carts.push(cart);
      store.counters.cartId += 1;

      return cloneCart(cart);
    },

    async createCartItem(payload) {
      const now = new Date().toISOString();

      store.cartItems.push({
        id: store.counters.cartItemId,
        cartId: payload.cartId,
        productId: payload.productId,
        quantity: payload.quantity,
        unitPriceKobo: payload.unitPriceKobo,
        createdAt: now,
        updatedAt: now
      });
      store.counters.cartItemId += 1;
    },

    async deleteCartItem(cartItemId) {
      store.cartItems = store.cartItems.filter((item) => item.id !== Number(cartItemId));
    },

    async ensureCartForUserId(userId) {
      const existingCart = await this.findCartByUserId(userId);

      if (existingCart) {
        return existingCart;
      }

      return this.createCart(userId);
    },

    async findCartById(cartId) {
      return cloneCart(store.carts.find((cart) => cart.id === Number(cartId)) || null);
    },

    async findCartByUserId(userId) {
      return cloneCart(store.carts.find((cart) => cart.userId === userId) || null);
    },

    async findCartItemByIdForUser(userId, cartItemId) {
      const cart = store.carts.find((entry) => entry.userId === userId);

      if (!cart) {
        return null;
      }

      return mapLookupCartItem(
        store.cartItems.find((item) => item.id === Number(cartItemId) && item.cartId === cart.id) || null
      );
    },

    async findCartItemByProductId(cartId, productId) {
      return mapLookupCartItem(
        store.cartItems.find(
          (item) => item.cartId === Number(cartId) && item.productId === Number(productId)
        ) || null
      );
    },

    async getCartByUserId(userId) {
      const cart = await this.ensureCartForUserId(userId);
      const items = store.cartItems
        .filter((item) => item.cartId === cart.id)
        .sort((left, right) => left.id - right.id)
        .map(mapDetailedCartItem);

      return {
        ...cart,
        items
      };
    },

    async updateCartItemQuantity(cartItemId, quantity) {
      const cartItem = store.cartItems.find((item) => item.id === Number(cartItemId));

      if (!cartItem) {
        return;
      }

      cartItem.quantity = quantity;
      cartItem.updatedAt = new Date().toISOString();
    }
  };
}

module.exports = {
  createInMemoryCartsRepository
};
