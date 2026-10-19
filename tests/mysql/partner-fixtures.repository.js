function createPartnerFixturesRepository(db) {
  return {
    async seed() {
      await db.beginTransaction();
      for (const [id, status, verification] of [[8001, 'active', 'verified'], [8002, 'suspended', 'verified'], [8003, 'active', 'pending']]) {
        await db.execute(`INSERT INTO users (id, role, full_name, email, phone, password_hash, account_status)
          VALUES (?, 'seller', 'Private Person', ?, ?, 'private-password', ?)`, [id, `private-${id}@test.local`, `080${id}`, status]);
        await db.execute(`INSERT INTO seller_profiles (id, user_id, business_name, rating, address, cac_number,
          contact_email, verification_status, cac_verification_response) VALUES (?, ?, ?, 4.5, 'PRIVATE ADDRESS', ?, 'private@test.local', ?, ?)`,
        [id, id, `Partner Seller ${id}`, `PARTNER-${id}`, verification, JSON.stringify({ secret: 'private-kyc' })]);
      }
      await db.execute("INSERT INTO categories (id, name, slug) VALUES (8001, 'Partner Parts', 'partner-parts')");
      for (let i = 0; i < 105; i++) {
        await db.execute(`INSERT INTO products (id, seller_id, title, description, category_id, part_number,
          \`condition\`, price_kobo, stock_qty, location, status) VALUES (?, ?, ?, 'Brake parts', 8001, ?, 'new', ?, 3, 'Lagos', ?)`,
        [8000 + i, i === 103 ? 8002 : i === 104 ? 8003 : 8001, `Partner Brake ${i}`, `PARTNER-${i}`, 100 + i, i === 102 ? 'inactive' : 'active']);
      }
    },
    async seedImages() {
      await db.execute(`INSERT INTO product_images (product_id, url, position) VALUES
        (8000, '/uploads/products/second.png', 3),
        (8000, '/uploads/products/first.jpg', 1),
        (8001, '/uploads/products/another.webp', 2)`);
    },
    async rollback() { await db.rollback(); }
  };
}
module.exports = { createPartnerFixturesRepository };
