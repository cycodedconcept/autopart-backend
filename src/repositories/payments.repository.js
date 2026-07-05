function parseJsonColumn(value) {
  if (!value) {
    return null;
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
}

function mapOrderRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    buyerId: row.buyer_id,
    status: row.status,
    paymentMethod: row.payment_method,
    totalKobo: Number(row.total_kobo),
    paymentReference: row.payment_reference,
    paymentStatus: row.payment_status,
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

async function decrementProductStockForOrderWithConnection(connection, orderId) {
  await connection.execute(
    `
      UPDATE products p
      INNER JOIN (
        SELECT
          oi.product_id,
          SUM(oi.quantity) AS total_quantity
        FROM order_items oi
        WHERE oi.order_id = ?
        GROUP BY oi.product_id
      ) order_stock ON order_stock.product_id = p.id
      SET
        p.stock_qty = p.stock_qty - order_stock.total_quantity,
        p.updated_at = CURRENT_TIMESTAMP
    `,
    [orderId]
  );
}

function mapPaymentRow(row) {
  if (!row) {
    return null;
  }

  return {
    paymentId: row.payment_id,
    orderId: row.order_id,
    buyerId: row.buyer_id,
    provider: row.provider,
    reference: row.reference,
    amountKobo: Number(row.amount_kobo),
    paymentStatus: row.payment_status,
    rawResponse: parseJsonColumn(row.raw_response),
    orderStatus: row.order_status,
    orderPaymentMethod: row.order_payment_method,
    orderTotalKobo: Number(row.order_total_kobo),
    orderPaymentReference: row.order_payment_reference,
    orderPaymentStatus: row.order_payment_status,
    createdAt: row.payment_created_at,
    updatedAt: row.payment_updated_at
  };
}

async function findPaymentByReferenceWithConnection(connection, reference, options = {}) {
  const forUpdateClause = options.forUpdate ? 'FOR UPDATE' : '';
  const [rows] = await connection.execute(
    `
      SELECT
        p.id AS payment_id,
        p.order_id,
        p.provider,
        p.reference,
        p.amount_kobo,
        p.status AS payment_status,
        p.raw_response,
        p.created_at AS payment_created_at,
        p.updated_at AS payment_updated_at,
        o.buyer_id,
        o.status AS order_status,
        o.payment_method AS order_payment_method,
        o.total_kobo AS order_total_kobo,
        o.payment_reference AS order_payment_reference,
        o.payment_status AS order_payment_status
      FROM payments p
      INNER JOIN orders o ON o.id = p.order_id
      WHERE p.reference = ?
      LIMIT 1
      ${forUpdateClause}
    `,
    [reference]
  );

  return mapPaymentRow(rows[0]);
}

function createPaymentsRepository({ db }) {
  return {
    async findOrderForBuyer(orderId, buyerId) {
      const [rows] = await db.execute(
        `
          SELECT
            id,
            buyer_id,
            status,
            payment_method,
            total_kobo,
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
    },

    async createPaymentAttempt(payload) {
      const connection = await db.getConnection();

      try {
        await connection.beginTransaction();

        await connection.execute(
          `
            INSERT INTO payments (
              order_id,
              provider,
              reference,
              amount_kobo,
              status,
              raw_response
            )
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          [
            payload.orderId,
            payload.provider,
            payload.reference,
            payload.amountKobo,
            payload.status,
            payload.rawResponse ? JSON.stringify(payload.rawResponse) : null
          ]
        );

        await connection.execute(
          `
            UPDATE orders
            SET payment_reference = ?, payment_status = ?
            WHERE id = ?
          `,
          [payload.reference, payload.status, payload.orderId]
        );

        const payment = await findPaymentByReferenceWithConnection(connection, payload.reference);
        await connection.commit();

        return payment;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async updatePaymentAttempt(reference, payload) {
      const connection = await db.getConnection();

      try {
        await connection.beginTransaction();

        const existingPayment = await findPaymentByReferenceWithConnection(connection, reference, {
          forUpdate: true
        });

        if (!existingPayment) {
          await connection.rollback();
          return null;
        }

        await connection.execute(
          `
            UPDATE payments
            SET status = ?, raw_response = ?
            WHERE reference = ?
          `,
          [
            payload.status,
            payload.rawResponse ? JSON.stringify(payload.rawResponse) : null,
            reference
          ]
        );

        if (existingPayment.orderPaymentStatus !== 'paid') {
          await connection.execute(
            `
              UPDATE orders
              SET payment_reference = ?, payment_status = ?
              WHERE id = ?
            `,
            [reference, payload.status, existingPayment.orderId]
          );
        }

        const updatedPayment = await findPaymentByReferenceWithConnection(connection, reference);
        await connection.commit();

        return updatedPayment;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async findPaymentByReference(reference) {
      const connection = await db.getConnection();

      try {
        return findPaymentByReferenceWithConnection(connection, reference);
      } finally {
        connection.release();
      }
    },

    async reconcilePayment(reference, payload) {
      const connection = await db.getConnection();

      try {
        await connection.beginTransaction();

        const existingPayment = await findPaymentByReferenceWithConnection(connection, reference, {
          forUpdate: true
        });

        if (!existingPayment) {
          await connection.rollback();
          return null;
        }

        await connection.execute(
          `
            UPDATE payments
            SET status = ?, raw_response = ?
            WHERE reference = ?
          `,
          [
            payload.paymentStatus,
            payload.rawResponse ? JSON.stringify(payload.rawResponse) : null,
            reference
          ]
        );

        if (payload.paymentStatus === 'paid') {
          if (existingPayment.orderPaymentStatus !== 'paid') {
            await connection.execute(
              `
                UPDATE orders
                SET
                  payment_reference = ?,
                  payment_status = ?,
                  status = CASE
                    WHEN status = 'pending_payment' THEN 'confirmed'
                    ELSE status
                  END
                WHERE id = ?
              `,
              [reference, payload.paymentStatus, existingPayment.orderId]
            );

            if (existingPayment.orderStatus === 'pending_payment') {
              await decrementProductStockForOrderWithConnection(connection, existingPayment.orderId);
              await insertOrderStatusHistoryWithConnection(connection, {
                orderId: existingPayment.orderId,
                status: 'confirmed',
                note: 'Payment verified and order confirmed.'
              });
            }
          }
        } else if (existingPayment.orderPaymentStatus !== 'paid') {
          await connection.execute(
            `
              UPDATE orders
              SET payment_reference = ?, payment_status = ?
              WHERE id = ?
            `,
            [reference, payload.paymentStatus, existingPayment.orderId]
          );
        }

        const updatedPayment = await findPaymentByReferenceWithConnection(connection, reference);
        await connection.commit();

        return updatedPayment;
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
  createPaymentsRepository
};
