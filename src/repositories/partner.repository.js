const { sanitizeLimitOffset } = require('./pagination.repository');
const eligibility = "sp.verification_status = 'verified' AND u.account_status = 'active' AND u.role = 'seller'";
const sellerColumns = `sp.id AS seller_id, sp.business_name, sp.rating,
  sp.verification_status, sp.created_at AS seller_created_at`;
function mapSeller(row) {
  return { id: row.seller_id, businessName: row.business_name, city: null, state: null,
    verificationStatus: row.verification_status, rating: Number(row.rating), createdAt: row.seller_created_at };
}
function productFilters(filters) {
  const clauses = [eligibility, "p.status = 'active'"];
  const params = [];
  if (filters.search) {
    clauses.push('(p.title LIKE ? OR p.description LIKE ? OR p.part_number LIKE ?)');
    params.push(...Array(3).fill(`%${filters.search}%`));
  }
  if (filters.category !== undefined) {
    if (typeof filters.category === 'number') { clauses.push('c.id = ?'); params.push(filters.category); }
    else { clauses.push('(c.slug = ? OR c.name = ?)'); params.push(filters.category, filters.category); }
  }
  if (filters.sellerId !== undefined) { clauses.push('sp.id = ?'); params.push(filters.sellerId); }
  if (filters.minPrice !== undefined) { clauses.push('p.price_kobo >= ?'); params.push(filters.minPrice); }
  if (filters.maxPrice !== undefined) { clauses.push('p.price_kobo <= ?'); params.push(filters.maxPrice); }
  return { where: clauses.join(' AND '), params };
}
function createPartnerRepository({ db }) {
  return {
    async listProducts(filters) {
      const { limit, offset } = sanitizeLimitOffset(filters, { maxLimit: 100 });
      const { where, params } = productFilters(filters);
      const from = `FROM products p JOIN seller_profiles sp ON sp.id = p.seller_id
        JOIN users u ON u.id = sp.user_id JOIN categories c ON c.id = p.category_id WHERE ${where}`;
      const [counts] = await db.execute(`SELECT COUNT(*) AS total ${from}`, params);
      const [rows] = await db.execute(`SELECT p.id, p.title, p.description, p.part_number,
        p.price_kobo, p.stock_qty, p.location, p.\`condition\`, p.created_at,
        c.id AS category_id, c.name AS category_name, c.slug AS category_slug, ${sellerColumns}
        ${from} ORDER BY ${filters.sort === 'price' ? 'p.price_kobo ASC, p.id ASC' : 'p.created_at DESC, p.id DESC'}
        LIMIT ${limit} OFFSET ${offset}`, params);
      return { total: Number(counts[0].total), products: rows.map((row) => ({
        id: row.id, title: row.title, description: row.description, partNumber: row.part_number,
        priceKobo: Number(row.price_kobo), stockQty: Number(row.stock_qty), location: row.location,
        condition: row.condition, createdAt: row.created_at,
        category: { id: row.category_id, name: row.category_name, slug: row.category_slug }, seller: mapSeller(row)
      })) };
    },
    async findImagesByProductIds(productIds) {
      if (!productIds.length) return [];
      const placeholders = productIds.map(() => '?').join(', ');
      const [rows] = await db.execute(`SELECT product_id, url, position FROM product_images
        WHERE product_id IN (${placeholders}) ORDER BY product_id ASC, position ASC, id ASC`, productIds);
      return rows.map((row) => ({ productId: row.product_id, url: row.url, position: Number(row.position) }));
    },
    async listSellers(filters) {
      const { limit, offset } = sanitizeLimitOffset(filters, { maxLimit: 100 });
      const from = `FROM seller_profiles sp JOIN users u ON u.id = sp.user_id WHERE ${eligibility}`;
      const [counts] = await db.execute(`SELECT COUNT(*) AS total ${from}`);
      const [rows] = await db.execute(`SELECT ${sellerColumns}, COALESCE(pc.product_count, 0) AS product_count
        FROM seller_profiles sp JOIN users u ON u.id = sp.user_id
        LEFT JOIN (SELECT seller_id, COUNT(*) AS product_count FROM products WHERE status = 'active' GROUP BY seller_id) pc
          ON pc.seller_id = sp.id
        WHERE ${eligibility} ORDER BY sp.created_at DESC, sp.id DESC LIMIT ${limit} OFFSET ${offset}`);
      return { total: Number(counts[0].total), sellers: rows.map((row) => ({ ...mapSeller(row), productCount: Number(row.product_count) })) };
    },
    async sellerExists(id) {
      const [rows] = await db.execute(`SELECT sp.id FROM seller_profiles sp JOIN users u ON u.id = sp.user_id
        WHERE sp.id = ? AND ${eligibility}`, [id]);
      return rows.length > 0;
    }
  };
}
module.exports = { createPartnerRepository };
