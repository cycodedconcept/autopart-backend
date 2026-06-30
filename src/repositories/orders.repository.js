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
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function findOrderById(connection, orderId, buyerId) {
  const [rows] = await connection.execute(
    `
      SELECT
        id,
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
        payment_status,
        created_at,
        updated_at
      FROM orders
      WHERE id = ? AND buyer_id = ?
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
                line_total_kobo
              )
              VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
              result.insertId,
              item.productId,
              item.sellerId,
              item.quantity,
              item.unitPriceKobo,
              item.lineTotalKobo
            ]
          );
        }

        await connection.execute(
          `
            DELETE FROM cart_items
            WHERE cart_id = ?
          `,
          [payload.cartId]
        );

        const order = await findOrderById(connection, result.insertId, payload.buyerId);
        await connection.commit();

        return order;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
  };
}

module.exports = {
  createOrdersRepository
};
