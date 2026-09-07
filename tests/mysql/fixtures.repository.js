// SQL fixtures for the disposable database in compose.yaml; never use an application database.
function createFixturesRepository(db) {
  return {
    async seed() {
      await db.execute('DELETE FROM orders WHERE buyer_id = 100');
      await db.execute("DELETE FROM products WHERE part_number LIKE 'PART-%' AND seller_id IN (101, 102)");
      await db.execute("DELETE FROM categories WHERE slug LIKE 'fixture-%'");
      await db.execute("DELETE FROM admins WHERE email = 'admin@fixture.local'");
      await db.execute("DELETE FROM users WHERE email IN ('buyer@fixture.local', 'one@fixture.local', 'two@fixture.local')");
      await db.execute("INSERT INTO users (id, role, full_name, email, password_hash) VALUES (100, 'buyer', 'Test Buyer', 'buyer@fixture.local', 'unused'), (101, 'seller', 'Seller One', 'one@fixture.local', 'unused'), (102, 'seller', 'Seller Two', 'two@fixture.local', 'unused')");
      await db.execute("INSERT INTO admins (id, full_name, email, password_hash) VALUES (100, 'Test Admin', 'admin@fixture.local', 'unused')");
      await db.execute(`INSERT INTO seller_profiles (id, user_id, business_name, rating, address, cac_number, contact_email)
        VALUES (101, 101, 'One Parts', 4.5, 'Ikeja, Lagos', 'FIXTURE-1', 'one@fixture.local'),
        (102, 102, 'Two Parts', 4.2, 'Abuja', 'FIXTURE-2', 'two@fixture.local')`);
      for (let id = 1; id <= 7; id += 1) {
        await db.execute('INSERT INTO categories (id, name, slug) VALUES (?, ?, ?)', [id, `Category ${id}`, `fixture-${id}`]);
        await db.execute(`INSERT INTO products (id, seller_id, title, description, category_id, part_number,
          \`condition\`, price_kobo, stock_qty, location) VALUES (?, ?, ?, 'Fixture', ?, ?, 'new', ?, 100, 'Lagos')`,
        [id, id % 2 ? 101 : 102, `Part ${id}`, id, `PART-${id}`, id * 100]);
      }
      await this.createOrder(1, '2026-08-30T23:00:00Z', [[1, 1, 1001], [2, 2, 1000]], 300);
      await this.createOrder(2, '2026-08-30T22:59:59Z', [[1, 1, 500]], 100);
      await this.createOrder(3, '2026-09-05T12:00:00Z', Array.from({ length: 7 }, (_, i) => [i + 1, 1, (i + 1) * 100]), 70);
      await this.createOrder(4, '2026-09-06T22:59:59Z', [[1, 1, 101]], 0);
      const exclusions = [['confirmed', 'paid'], ['delivered', 'pending'], ['cancelled', 'paid'], ['disputed', 'paid']];
      for (let index = 0; index < exclusions.length; index += 1) {
        await this.createOrder(index + 5, '2026-09-02T12:00:00Z', [[1, 1, 1000000]], 0, ...exclusions[index]);
      }
      await this.createDispute(1);
      await db.execute("UPDATE disputes SET description = 'Part arrived damaged', buyer_evidence_summary = 'Damage on arrival', seller_evidence_summary = 'Packed intact' WHERE id = 1");
      await db.execute(`INSERT INTO dispute_attachments (dispute_id, submitted_by, url, filename)
        VALUES (1, 'buyer', 'https://fixture.local/damage.jpg', 'damage.jpg'),
        (1, 'seller', 'https://fixture.local/packing.jpg', 'packing.jpg')`);
      for (const [index, status] of ['in_review', 'escalated', 'resolved', 'rejected', 'closed'].entries()) {
        await this.createDispute(index + 2, status);
      }
      await db.execute(`UPDATE platform_config SET value = JSON_OBJECT('disputeReviewSlaHours', 48)
        WHERE \`key\` = 'platform_settings'`);
    },
    async createOrder(id, timestamp, items, deliveryFee, status = 'delivered', paymentStatus = 'paid') {
      const subtotal = items.reduce((sum, [, quantity, unit]) => sum + quantity * unit, 0);
      const epoch = Date.parse(timestamp) / 1000;
      await db.execute(`INSERT INTO orders (id, buyer_id, status, payment_method, subtotal_kobo,
        delivery_fee_kobo, total_kobo, delivery_label, delivery_street, delivery_city, delivery_state,
        delivery_phone, payment_status, payment_reference, created_at, updated_at)
        VALUES (?, 100, ?, 'paystack', ?, ?, ?, 'Home', '1 Test Street', 'Lagos', 'Lagos', '08000000000', ?, ?, FROM_UNIXTIME(?), FROM_UNIXTIME(?))`,
      [id, status, subtotal, deliveryFee, subtotal + deliveryFee, paymentStatus, `FIXTURE-${id}`, epoch, epoch]);
      for (const [product, quantity, unit] of items) {
        const [result] = await db.execute(`INSERT INTO order_items (order_id, product_id, seller_id, quantity,
          unit_price_kobo, line_total_kobo, item_status) VALUES (?, ?, ?, ?, ?, ?, 'delivered')`,
        [id, product, product % 2 ? 101 : 102, quantity, unit, quantity * unit]);
        await db.execute(`INSERT INTO delivery_jobs (order_id, order_item_id, seller_id, status, pickup_address, delivered_at)
          VALUES (?, ?, ?, 'delivered', 'Test warehouse', FROM_UNIXTIME(?))`,
        [id, result.insertId, product % 2 ? 101 : 102, epoch]);
      }
      await db.execute(`INSERT INTO payments (order_id, provider, reference, amount_kobo, status)
        VALUES (?, 'paystack', ?, ?, ?)`, [id, `FIXTURE-${id}`, subtotal + deliveryFee, paymentStatus]);
      await db.execute(`INSERT INTO order_status_history (order_id, status, created_at)
        VALUES (?, ?, FROM_UNIXTIME(?))`, [id, status, epoch]);
    },
    async createDispute(id, status = 'open') {
      await db.execute(`INSERT INTO disputes (id, order_id, seller_id, raised_by, reason, status, created_at)
        VALUES (?, 1, 102, 'buyer', 'Damaged item', ?, FROM_UNIXTIME(?))`,
      [id, status, Date.parse('2026-09-05T23:30:00Z') / 1000]);
    },
    async counts(disputeId) {
      const [rows] = await db.execute(`SELECT d.status,
        (SELECT COUNT(*) FROM dispute_events e WHERE e.dispute_id = d.id) AS events,
        (SELECT COUNT(*) FROM dispute_rulings r WHERE r.dispute_id = d.id) AS rulings,
        (SELECT COUNT(*) FROM audit_logs a WHERE a.target_type = 'dispute' AND a.target_id = d.id) AS audits
        FROM disputes d WHERE d.id = ?`, [disputeId]);
      return rows[0];
    },
    async deliveryCount() {
      const [rows] = await db.execute('SELECT COUNT(*) AS total FROM delivery_jobs');
      return Number(rows[0].total);
    },
    async setSessionTimezone(connection, zone) {
      await connection.query('SET time_zone = ?', [zone]);
    }
  };
}

module.exports = { createFixturesRepository };
