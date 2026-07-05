function mapCartItemLookupRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    cartId: row.cart_id,
    productId: row.product_id,
    quantity: row.quantity,
    unitPriceKobo: Number(row.unit_price_kobo),
    productStatus: row.product_status,
    productStockQty: row.product_stock_qty
  };
}

function mapCartRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapDetailedCartItemRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    cartId: row.cart_id,
    productId: row.product_id,
    quantity: row.quantity,
    unitPriceKobo: Number(row.unit_price_kobo),
    lineTotalKobo: Number(row.line_total_kobo),
    product: {
      id: row.product_id,
      title: row.product_title,
      partNumber: row.product_part_number,
      condition: row.product_condition,
      location: row.product_location,
      stockQty: row.product_stock_qty,
      status: row.product_status,
      primaryImageUrl: row.primary_image_url,
      seller: {
        id: row.seller_id,
        businessName: row.seller_business_name,
        rating: row.seller_rating === null ? null : Number(row.seller_rating)
      }
    }
  };
}

function createCartsRepository({ db }) {
  return {
    async createCart(userId) {
      const [result] = await db.execute(
        `
          INSERT INTO carts (user_id)
          VALUES (?)
        `,
        [userId]
      );

      return this.findCartById(result.insertId);
    },

    async createCartItem(payload) {
      await db.execute(
        `
          INSERT INTO cart_items (cart_id, product_id, quantity, unit_price_kobo)
          VALUES (?, ?, ?, ?)
        `,
        [payload.cartId, payload.productId, payload.quantity, payload.unitPriceKobo]
      );
    },

    async deleteCartItem(cartItemId) {
      await db.execute(
        `
          DELETE FROM cart_items
          WHERE id = ?
        `,
        [cartItemId]
      );
    },

    async ensureCartForUserId(userId) {
      const existingCart = await this.findCartByUserId(userId);

      if (existingCart) {
        return existingCart;
      }

      return this.createCart(userId);
    },

    async findCartById(cartId) {
      const [rows] = await db.execute(
        `
          SELECT
            id,
            user_id,
            created_at,
            updated_at
          FROM carts
          WHERE id = ?
          LIMIT 1
        `,
        [cartId]
      );

      return mapCartRow(rows[0]);
    },

    async findCartByUserId(userId) {
      const [rows] = await db.execute(
        `
          SELECT
            id,
            user_id,
            created_at,
            updated_at
          FROM carts
          WHERE user_id = ?
          LIMIT 1
        `,
        [userId]
      );

      return mapCartRow(rows[0]);
    },

    async findCartItemByIdForUser(userId, cartItemId) {
      const [rows] = await db.execute(
        `
          SELECT
            ci.id,
            ci.cart_id,
            ci.product_id,
            ci.quantity,
            ci.unit_price_kobo,
            p.status AS product_status,
            p.stock_qty AS product_stock_qty
          FROM cart_items ci
          INNER JOIN carts c ON c.id = ci.cart_id
          INNER JOIN products p ON p.id = ci.product_id
          WHERE c.user_id = ? AND ci.id = ?
          LIMIT 1
        `,
        [userId, cartItemId]
      );

      return mapCartItemLookupRow(rows[0]);
    },

    async findCartItemByProductId(cartId, productId) {
      const [rows] = await db.execute(
        `
          SELECT
            ci.id,
            ci.cart_id,
            ci.product_id,
            ci.quantity,
            ci.unit_price_kobo,
            p.status AS product_status,
            p.stock_qty AS product_stock_qty
          FROM cart_items ci
          INNER JOIN products p ON p.id = ci.product_id
          WHERE ci.cart_id = ? AND ci.product_id = ?
          LIMIT 1
        `,
        [cartId, productId]
      );

      return mapCartItemLookupRow(rows[0]);
    },

    async getCartByUserId(userId) {
      const cart = await this.ensureCartForUserId(userId);
      const [rows] = await db.execute(
        `
          SELECT
            ci.id,
            ci.cart_id,
            ci.product_id,
            ci.quantity,
            ci.unit_price_kobo,
            (ci.quantity * ci.unit_price_kobo) AS line_total_kobo,
            p.title AS product_title,
            p.part_number AS product_part_number,
            p.\`condition\` AS product_condition,
            p.location AS product_location,
            p.stock_qty AS product_stock_qty,
            p.status AS product_status,
            p.seller_id,
            sp.business_name AS seller_business_name,
            sp.rating AS seller_rating,
            (
              SELECT pi.url
              FROM product_images pi
              WHERE pi.product_id = p.id
              ORDER BY pi.position ASC, pi.id ASC
              LIMIT 1
            ) AS primary_image_url
          FROM cart_items ci
          INNER JOIN products p ON p.id = ci.product_id
          INNER JOIN seller_profiles sp ON sp.id = p.seller_id
          WHERE ci.cart_id = ?
          ORDER BY ci.created_at ASC, ci.id ASC
        `,
        [cart.id]
      );

      return {
        ...cart,
        items: rows.map(mapDetailedCartItemRow)
      };
    },

    async updateCartItemQuantity(cartItemId, quantity) {
      await db.execute(
        `
          UPDATE cart_items
          SET quantity = ?
          WHERE id = ?
        `,
        [quantity, cartItemId]
      );
    }
  };
}

module.exports = {
  createCartsRepository
};
