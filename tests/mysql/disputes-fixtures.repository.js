// This fixture repository is restricted to the disposable dispute database.
function createDisputesFixturesRepository(db) {
  return {
    async seed() {
      const [database] = await db.execute('SELECT DATABASE() AS name');
      if (database[0].name !== 'autoparts_disputes_test') throw new Error('Use the disposable disputes database only.');
      await db.execute(`INSERT IGNORE INTO users (id, role, full_name, email, password_hash) VALUES
        (2100, 'buyer', 'Buyer One', 'buyer1@disputes.test', 'unused'),
        (2101, 'buyer', 'Buyer Two', 'buyer2@disputes.test', 'unused'),
        (2102, 'seller', 'Seller One', 'seller1@disputes.test', 'unused'),
        (2103, 'seller', 'Seller Two', 'seller2@disputes.test', 'unused'),
        (2104, 'seller', 'Seller Three', 'seller3@disputes.test', 'unused')`);
      await db.execute(`INSERT IGNORE INTO seller_profiles (id, user_id, business_name, address, cac_number, contact_email) VALUES
        (2201, 2102, 'One Parts', 'Lagos', 'DISPUTE-1', 'seller1@disputes.test'),
        (2202, 2103, 'Two Parts', 'Lagos', 'DISPUTE-2', 'seller2@disputes.test'),
        (2203, 2104, 'Three Parts', 'Lagos', 'DISPUTE-3', 'seller3@disputes.test')`);
      await db.execute("INSERT IGNORE INTO categories (id, name, slug) VALUES (2300, 'Fixture', 'disputes-fixture')");
      for (let i = 1; i <= 3; i += 1) await db.execute(`INSERT IGNORE INTO products
        (id, seller_id, title, description, category_id, part_number, \`condition\`, price_kobo, stock_qty, location)
        VALUES (?, ?, 'Dispute fixture part', 'Fixture', 2300, ?, 'new', 1000, 100, 'Lagos')`,
      [2300 + i, 2200 + i, `DISPUTE-PART-${i}`]);
      await db.execute(`INSERT IGNORE INTO admins (id, full_name, email, password_hash) VALUES
        (2100, 'Disputes Admin', 'admin@disputes.test', 'unused'),
        (2101, 'No Permission Admin', 'noaccess@disputes.test', 'unused')`);
      await db.execute("INSERT IGNORE INTO roles (id, name) VALUES (2401, 'fixture_disputes_admin')");
      await db.execute("INSERT IGNORE INTO permissions (`key`) VALUES ('disputes.resolve')");
      await db.execute(`INSERT IGNORE INTO role_permissions (role_id, permission_id)
        SELECT 2401, id FROM permissions WHERE \`key\` = 'disputes.resolve'`);
      await db.execute('INSERT IGNORE INTO admin_roles (admin_id, role_id) VALUES (2100, 2401)');
    },
    async reset() {
      await db.execute('DELETE FROM orders WHERE buyer_id IN (2100, 2101)');
      await this.setSettings({ disputeReviewSlaHours: 48 });
    },
    async setSettings(value) {
      await db.execute("UPDATE platform_config SET value = ? WHERE `key` = 'platform_settings'", [JSON.stringify(value)]);
    },
    async createOrder({ buyerId = 2100, status = 'delivered', sellers = [2201],
      deliveredAt = '2026-09-07T12:00:00Z' } = {}) {
      const [result] = await db.execute(`INSERT INTO orders (buyer_id, status, payment_method, subtotal_kobo,
        total_kobo, delivery_label, delivery_street, delivery_city, delivery_state, delivery_phone, payment_status)
        VALUES (?, ?, 'paystack', ?, ?, 'Home', '1 Test Street', 'Lagos', 'Lagos', '08000000000', 'paid')`,
      [buyerId, status, sellers.length * 1000, sellers.length * 1000]);
      const id = Number(result.insertId);
      for (const sellerId of sellers) await db.execute(`INSERT INTO order_items
        (order_id, product_id, seller_id, quantity, unit_price_kobo, line_total_kobo, item_status)
        VALUES (?, ?, ?, 1, 1000, 1000, 'delivered')`, [id, sellerId + 100, sellerId]);
      if (deliveredAt) await this.addDeliveryHistory(id, deliveredAt);
      return id;
    },
    async addDeliveryHistory(orderId, timestamp) {
      await db.execute(`INSERT INTO order_status_history (order_id, status, created_at)
        VALUES (?, 'delivered', FROM_UNIXTIME(?))`, [orderId, Date.parse(timestamp) / 1000]);
    },
    async createLegacyDispute(orderId, { sellerId = 2201, status = 'open', timestamp = '2026-09-08T12:00:00Z' } = {}) {
      const [result] = await db.execute(`INSERT INTO disputes (order_id, seller_id, raised_by, reason, status, created_at)
        VALUES (?, ?, 'buyer', 'Legacy dispute', ?, FROM_UNIXTIME(?))`, [orderId, sellerId, status, Date.parse(timestamp) / 1000]);
      return Number(result.insertId);
    },
    async addEvent(disputeId, event, detail, userId = null) {
      await db.execute('INSERT INTO dispute_events (dispute_id, event_type, actor_user_id, detail) VALUES (?, ?, ?, ?)',
        [disputeId, event, userId, JSON.stringify(detail)]);
    },
    async state(orderId) {
      const [disputes] = await db.execute('SELECT * FROM disputes WHERE order_id = ? ORDER BY id', [orderId]);
      const [events] = await db.execute(`SELECT e.* FROM dispute_events e INNER JOIN disputes d ON d.id = e.dispute_id
        WHERE d.order_id = ? ORDER BY e.id`, [orderId]);
      const [attachments] = await db.execute(`SELECT a.* FROM dispute_attachments a INNER JOIN disputes d ON d.id = a.dispute_id
        WHERE d.order_id = ? ORDER BY a.id`, [orderId]);
      return { disputes, events, attachments };
    },
    failingEventWritesDb() {
      return {
        execute: (...args) => db.execute(...args),
        async getConnection() {
          const connection = await db.getConnection();
          return new Proxy(connection, { get(target, key) {
            if (key === 'execute') return (sql, params) => {
              if (sql.includes('INSERT INTO dispute_events')) throw new Error('Injected event write failure');
              return target.execute(sql, params);
            };
            const value = target[key];
            return typeof value === 'function' ? value.bind(target) : value;
          } });
        }
      };
    }
  };
}

module.exports = { createDisputesFixturesRepository };
