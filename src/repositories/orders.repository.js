function mapOrderRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    buyerId: row.buyer_id,
    status: row.status,
    paymentMethod: row.payment_method,
    subtotalKobo: Number(row.subtotal_kobo),
    deliveryFeeKobo: Number(row.delivery_fee_kobo),
    totalKobo: Number(row.total_kobo),
    deliveryAddressId: row.delivery_address_id,
    deliveryLabel: row.delivery_label,
    deliveryStreet: row.delivery_street,
    deliveryCity: row.delivery_city,
    deliveryState: row.delivery_state,
    deliveryPhone: row.delivery_phone,
    paymentReference: row.payment_reference,
    paymentStatus: row.payment_status,
    totalItems: row.total_items === undefined || row.total_items === null
      ? 0
      : Number(row.total_items),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSellerOrderRow(row) {
  const order = mapOrderRow(row);

  if (!order) {
    return null;
  }

  return {
    ...order,
    sellerLineItems: row.seller_line_items === undefined || row.seller_line_items === null
      ? 0
      : Number(row.seller_line_items),
    sellerTotalItems: row.seller_total_items === undefined || row.seller_total_items === null
      ? 0
      : Number(row.seller_total_items),
    sellerTotalKobo: row.seller_total_kobo === undefined || row.seller_total_kobo === null
      ? 0
      : Number(row.seller_total_kobo)
  };
}

function mapOrderItemRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    orderId: row.order_id,
    productId: row.product_id,
    sellerId: row.seller_id,
    quantity: Number(row.quantity),
    unitPriceKobo: Number(row.unit_price_kobo),
    lineTotalKobo: Number(row.line_total_kobo),
    itemStatus: row.item_status,
    title: row.title,
    partNumber: row.part_number,
    condition: row.condition,
    location: row.location,
    sellerBusinessName: row.seller_business_name,
    sellerRating: row.seller_rating === null ? null : Number(row.seller_rating),
    primaryImageUrl: row.primary_image_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapSellerOrderItemStateRow(row) {
  const item = mapOrderItemRow(row);

  if (!item) {
    return null;
  }

  return {
    ...item,
    orderStatus: row.order_status,
    paymentMethod: row.payment_method,
    paymentReference: row.payment_reference,
    paymentStatus: row.payment_status
  };
}

function mapOrderStatusHistoryRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    orderId: row.order_id,
    status: row.status,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function insertOrderStatusHistoryWithConnection(connection, payload) {
  await connection.execute(
    `
      INSERT INTO order_status_history (
        order_id,
        status,
        note
      )
      VALUES (?, ?, ?)
    `,
    [payload.orderId, payload.status, payload.note || null]
  );
}

async function findOrderByIdForBuyerWithConnection(connection, orderId, buyerId) {
  const [rows] = await connection.execute(
    `
      SELECT
        o.id,
        o.buyer_id,
        o.status,
        o.payment_method,
        o.subtotal_kobo,
        o.delivery_fee_kobo,
        o.total_kobo,
        o.delivery_address_id,
        o.delivery_label,
        o.delivery_street,
        o.delivery_city,
        o.delivery_state,
        o.delivery_phone,
        o.payment_reference,
        o.payment_status,
        (
          SELECT COALESCE(SUM(oi.quantity), 0)
          FROM order_items oi
          WHERE oi.order_id = o.id
        ) AS total_items,
        o.created_at,
        o.updated_at
      FROM orders o
      WHERE o.id = ? AND o.buyer_id = ?
      LIMIT 1
    `,
    [orderId, buyerId]
  );

  return mapOrderRow(rows[0]);
}

function createOrdersRepository({ db }) {
  return {
    async createOrder(payload) {
      const connection = await db.getConnection();

      try {
        await connection.beginTransaction();

        const [result] = await connection.execute(
          `
            INSERT INTO orders (
              buyer_id,
              status,
              payment_method,
              subtotal_kobo,
              delivery_fee_kobo,
              total_kobo,
              delivery_address_id,
              delivery_label,
              delivery_street,
              delivery_city,
              delivery_state,
              delivery_phone,
              payment_reference,
              payment_status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            payload.buyerId,
            payload.status,
            payload.paymentMethod,
            payload.subtotalKobo,
            payload.deliveryFeeKobo,
            payload.totalKobo,
            payload.deliveryAddressId,
            payload.deliveryAddressSnapshot.label,
            payload.deliveryAddressSnapshot.street,
            payload.deliveryAddressSnapshot.city,
            payload.deliveryAddressSnapshot.state,
            payload.deliveryAddressSnapshot.phone,
            payload.paymentReference || null,
            payload.paymentStatus
          ]
        );

        for (const item of payload.items) {
          await connection.execute(
            `
              INSERT INTO order_items (
                order_id,
                product_id,
                seller_id,
                quantity,
                unit_price_kobo,
                line_total_kobo,
                item_status
              )
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
            [
              result.insertId,
              item.productId,
              item.sellerId,
              item.quantity,
              item.unitPriceKobo,
              item.lineTotalKobo,
              item.itemStatus
            ]
          );
        }

        await insertOrderStatusHistoryWithConnection(connection, {
          orderId: result.insertId,
          status: payload.status,
          note: 'Order created and awaiting payment.'
        });

        await connection.execute(
          `
            DELETE FROM cart_items
            WHERE cart_id = ?
          `,
          [payload.cartId]
        );

        const order = await findOrderByIdForBuyerWithConnection(
          connection,
          result.insertId,
          payload.buyerId
        );
        await connection.commit();

        return order;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async listOrdersForBuyer(filters) {
      const whereClauses = ['buyer_id = ?'];
      const params = [filters.buyerId];

      if (filters.status) {
        whereClauses.push('status = ?');
        params.push(filters.status);
      }

      const [countRows] = await db.execute(
        `
          SELECT COUNT(*) AS total
          FROM orders
          WHERE ${whereClauses.join(' AND ')}
        `,
        params
      );
      const [rows] = await db.execute(
        `
          SELECT
            o.id,
            o.buyer_id,
            o.status,
            o.payment_method,
            o.subtotal_kobo,
            o.delivery_fee_kobo,
            o.total_kobo,
            o.delivery_address_id,
            o.delivery_label,
            o.delivery_street,
            o.delivery_city,
            o.delivery_state,
            o.delivery_phone,
            o.payment_reference,
            o.payment_status,
            (
              SELECT COALESCE(SUM(oi.quantity), 0)
              FROM order_items oi
              WHERE oi.order_id = o.id
            ) AS total_items,
            o.created_at,
            o.updated_at
          FROM orders o
          WHERE ${whereClauses.map((clause) => `o.${clause}`).join(' AND ')}
          ORDER BY o.created_at DESC, o.id DESC
          LIMIT ? OFFSET ?
        `,
        [...params, filters.limit, filters.offset]
      );

      return {
        orders: rows.map(mapOrderRow),
        total: Number(countRows[0].total)
      };
    },

    async listOrdersForSeller(filters) {
      const whereClauses = ['oi.seller_id = ?'];
      const params = [filters.sellerId];

      if (filters.itemStatus) {
        whereClauses.push('oi.item_status = ?');
        params.push(filters.itemStatus);
      }

      const [countRows] = await db.execute(
        `
          SELECT COUNT(DISTINCT o.id) AS total
          FROM orders o
          INNER JOIN order_items oi ON oi.order_id = o.id
          WHERE ${whereClauses.join(' AND ')}
        `,
        params
      );

      const [rows] = await db.execute(
        `
          SELECT
            o.id,
            o.buyer_id,
            o.status,
            o.payment_method,
            o.subtotal_kobo,
            o.delivery_fee_kobo,
            o.total_kobo,
            o.delivery_address_id,
            o.delivery_label,
            o.delivery_street,
            o.delivery_city,
            o.delivery_state,
            o.delivery_phone,
            o.payment_reference,
            o.payment_status,
            (
              SELECT COALESCE(SUM(all_items.quantity), 0)
              FROM order_items all_items
              WHERE all_items.order_id = o.id
            ) AS total_items,
            COUNT(oi.id) AS seller_line_items,
            COALESCE(SUM(oi.quantity), 0) AS seller_total_items,
            COALESCE(SUM(oi.line_total_kobo), 0) AS seller_total_kobo,
            o.created_at,
            o.updated_at
          FROM orders o
          INNER JOIN order_items oi ON oi.order_id = o.id
          WHERE ${whereClauses.join(' AND ')}
          GROUP BY
            o.id,
            o.buyer_id,
            o.status,
            o.payment_method,
            o.subtotal_kobo,
            o.delivery_fee_kobo,
            o.total_kobo,
            o.delivery_address_id,
            o.delivery_label,
            o.delivery_street,
            o.delivery_city,
            o.delivery_state,
            o.delivery_phone,
            o.payment_reference,
            o.payment_status,
            o.created_at,
            o.updated_at
          ORDER BY o.created_at DESC, o.id DESC
          LIMIT ? OFFSET ?
        `,
        [...params, filters.limit, filters.offset]
      );

      return {
        orders: rows.map(mapSellerOrderRow),
        total: Number(countRows[0].total)
      };
    },

    async findOrderByIdForBuyer(orderId, buyerId) {
      const connection = await db.getConnection();

      try {
        return await findOrderByIdForBuyerWithConnection(connection, orderId, buyerId);
      } finally {
        connection.release();
      }
    },

    async findOrderItemsByOrderId(orderId, buyerId) {
      const [rows] = await db.execute(
        `
          SELECT
            oi.id,
            oi.order_id,
            oi.product_id,
            oi.seller_id,
            oi.quantity,
            oi.unit_price_kobo,
            oi.line_total_kobo,
            oi.item_status,
            p.title,
            p.part_number,
            p.\`condition\` AS \`condition\`,
            p.location,
            sp.business_name AS seller_business_name,
            sp.rating AS seller_rating,
            (
              SELECT pi.url
              FROM product_images pi
              WHERE pi.product_id = p.id
              ORDER BY pi.position ASC, pi.id ASC
              LIMIT 1
            ) AS primary_image_url,
            oi.created_at,
            oi.updated_at
          FROM order_items oi
          INNER JOIN orders o ON o.id = oi.order_id
          INNER JOIN products p ON p.id = oi.product_id
          INNER JOIN seller_profiles sp ON sp.id = oi.seller_id
          WHERE oi.order_id = ? AND o.buyer_id = ?
          ORDER BY oi.id ASC
        `,
        [orderId, buyerId]
      );

      return rows.map(mapOrderItemRow);
    },

    async findOrderItemsByOrderIdsForSeller(orderIds, sellerId) {
      if (!orderIds.length) {
        return [];
      }

      const placeholders = orderIds.map(() => '?').join(', ');
      const [rows] = await db.execute(
        `
          SELECT
            oi.id,
            oi.order_id,
            oi.product_id,
            oi.seller_id,
            oi.quantity,
            oi.unit_price_kobo,
            oi.line_total_kobo,
            oi.item_status,
            p.title,
            p.part_number,
            p.\`condition\` AS \`condition\`,
            p.location,
            sp.business_name AS seller_business_name,
            sp.rating AS seller_rating,
            (
              SELECT pi.url
              FROM product_images pi
              WHERE pi.product_id = p.id
              ORDER BY pi.position ASC, pi.id ASC
              LIMIT 1
            ) AS primary_image_url,
            oi.created_at,
            oi.updated_at
          FROM order_items oi
          INNER JOIN products p ON p.id = oi.product_id
          INNER JOIN seller_profiles sp ON sp.id = oi.seller_id
          WHERE oi.seller_id = ? AND oi.order_id IN (${placeholders})
          ORDER BY oi.order_id DESC, oi.id ASC
        `,
        [sellerId, ...orderIds]
      );

      return rows.map(mapOrderItemRow);
    },

    async findSellerOrderItemById(orderItemId, sellerId) {
      const [rows] = await db.execute(
        `
          SELECT
            oi.id,
            oi.order_id,
            oi.product_id,
            oi.seller_id,
            oi.quantity,
            oi.unit_price_kobo,
            oi.line_total_kobo,
            oi.item_status,
            p.title,
            p.part_number,
            p.\`condition\` AS \`condition\`,
            p.location,
            sp.business_name AS seller_business_name,
            sp.rating AS seller_rating,
            (
              SELECT pi.url
              FROM product_images pi
              WHERE pi.product_id = p.id
              ORDER BY pi.position ASC, pi.id ASC
              LIMIT 1
            ) AS primary_image_url,
            o.status AS order_status,
            o.payment_method,
            o.payment_reference,
            o.payment_status,
            oi.created_at,
            oi.updated_at
          FROM order_items oi
          INNER JOIN orders o ON o.id = oi.order_id
          INNER JOIN products p ON p.id = oi.product_id
          INNER JOIN seller_profiles sp ON sp.id = oi.seller_id
          WHERE oi.id = ? AND oi.seller_id = ?
          LIMIT 1
        `,
        [orderItemId, sellerId]
      );

      return mapSellerOrderItemStateRow(rows[0]);
    },

    async findOrderStatusHistoryByOrderId(orderId, buyerId) {
      const [rows] = await db.execute(
        `
          SELECT
            osh.id,
            osh.order_id,
            osh.status,
            osh.note,
            osh.created_at,
            osh.updated_at
          FROM order_status_history osh
          INNER JOIN orders o ON o.id = osh.order_id
          WHERE osh.order_id = ? AND o.buyer_id = ?
          ORDER BY osh.created_at ASC, osh.id ASC
        `,
        [orderId, buyerId]
      );

      return rows.map(mapOrderStatusHistoryRow);
    },

    async updateSellerOrderItemStatus(payload) {
      await db.execute(
        `
          UPDATE order_items
          SET item_status = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND seller_id = ?
        `,
        [payload.itemStatus, payload.orderItemId, payload.sellerId]
      );

      return this.findSellerOrderItemById(payload.orderItemId, payload.sellerId);
    }
  };
}

module.exports = {
  createOrdersRepository
};
