require('../setup/mocha');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const env = require('../../src/config/env');
const request = require('supertest');
const { createApp } = require('../../src/app');
const { createApiKeysService } = require('../../src/services/api-keys.service');
function keysRepository() {
  const records = [];
  return {
    records,
    async create(value) { const row = { ...value, id: records.length + 1, revokedAt: null }; records.push(row); const publicRow = { ...row }; delete publicRow.keyHash; return publicRow; },
    async findByPrefix(prefix) { return records.filter((row) => row.keyPrefix === prefix); },
    async markUsed(id) { records.find((row) => row.id === id).lastUsedAt = new Date(); return true; },
    async list() { return records.map((row) => { const value = { ...row }; delete value.keyHash; return value; }); },
    async revoke(id) { const row = records.find((entry) => entry.id === id); if (!row) return null; row.revokedAt = new Date(); const publicRow = { ...row }; delete publicRow.keyHash; return publicRow; }
  };
}
describe('Partner API and key management', () => {
  let app, repo, key, calls, imageRows, imageCalls;
  beforeEach(async () => {
    repo = keysRepository(); calls = []; imageRows = []; imageCalls = [];
    key = (await createApiKeysService({ apiKeysRepository: repo }).create({ name: 'Partner' })).key;
    app = createApp({ apiKeysRepository: repo, env: { ...env, APP_URL: 'https://autoparts.example.test/', BASE_URL: 'https://wrong.example.test' },
      adminAuthMiddleware(req, res, next) { req.admin = { roles: req.get('x-test-role') === 'super_admin' ? ['super_admin'] : [] }; next(); },
      partnerRepository: {
        async findImagesByProductIds(ids) { imageCalls.push(ids); return imageRows; },
        async listProducts(query) { calls.push(query); return { products: [{ id: 1, seller: { id: 2, businessName: 'Parts', city: null, state: null, verificationStatus: 'verified', rating: 4, createdAt: '2026-01-01' } }], total: 1 }; },
        async listSellers(query) { calls.push(query); return { sellers: [{ id: 2, businessName: 'Parts', productCount: 1 }], total: 1 }; },
        async sellerExists(id) { return id === 2; }
      }
    });
  });
  for (const path of ['/products', '/sellers', '/sellers/2/products']) {
    it(`authenticates and paginates ${path}`, async () => {
      await request(app).get(`/api/v1/partner${path}`).expect(401);
      const response = await request(app).get(`/api/v1/partner${path}?page=2&limit=100`).set('x-api-key', key).expect(200);
      assert.deepEqual(response.body.data.pagination, { page: 2, limit: 100, total: 1, totalPages: 1 });
      assert.equal(calls[0].offset, 100);
    });
  }
  for (const path of ['/products', '/sellers/2/products']) {
    it(`returns ordered, absolute public images without storage fields on ${path}`, async () => {
      imageRows = [
        { productId: 1, url: '/uploads/products/second.png', position: 4, id: 90, diskPath: '/private/second.png' },
        { productId: 1, url: '/uploads/products/first.jpg', position: 2, id: 91 },
        { productId: 1, url: '/private/server/secret.jpg', position: 1 },
        { productId: 1, url: '/uploads/products/../secret.jpg', position: 0 },
        { productId: 1, url: 'https://remote.test/secret.jpg?signature=secret', position: 0 }
      ];
      const response = await request(app).get(`/api/v1/partner${path}`).set('x-api-key', key).expect(200);
      const product = response.body.data.products[0];
      assert.deepEqual(product.images, [
        { url: 'https://autoparts.example.test/uploads/products/first.jpg', isPrimary: true, position: 2 },
        { url: 'https://autoparts.example.test/uploads/products/second.png', isPrimary: false, position: 4 }
      ]);
      assert.equal(product.thumbnailUrl, product.images[0].url);
      assert.deepEqual(imageCalls, [[1]]);
      assert.ok(!JSON.stringify(response.body).includes('/private/'));
      assert.ok(!JSON.stringify(response.body).includes('signature'));
    });
    it(`returns an empty image array and null thumbnail on ${path}`, async () => {
      const response = await request(app).get(`/api/v1/partner${path}`).set('x-api-key', key).expect(200);
      assert.deepEqual(response.body.data.products[0].images, []);
      assert.equal(response.body.data.products[0].thumbnailUrl, null);
    });
  }
  it('validates filters and pins seller route to its path id', async () => {
    await request(app).get('/api/v1/partner/products?minPrice=10&maxPrice=1').set('x-api-key', key).expect(422);
    await request(app).get('/api/v1/partner/products?limit=101').set('x-api-key', key).expect(422);
    await request(app).get('/api/v1/partner/sellers/no/products').set('x-api-key', key).expect(422);
    await request(app).get('/api/v1/partner/sellers/99/products').set('x-api-key', key).expect(404);
    await request(app).get('/api/v1/partner/sellers/2/products?sellerId=99&search=brake&category=engine&minPrice=0&maxPrice=500&sort=price').set('x-api-key', key).expect(200);
    assert.equal(calls[0].sellerId, 2); assert.equal(calls[0].sort, 'price'); assert.equal(calls[0].minPrice, 0);
  });
  it('shares the rate limit across endpoints and isolates keys', async () => {
    for (let i = 0; i < 120; i++) await request(app).get('/api/v1/partner/products').set('x-api-key', key).expect(200);
    const response = await request(app).get('/api/v1/partner/sellers').set('x-api-key', key).expect(429);
    assert.equal(response.body.error.code, 'RATE_LIMIT_EXCEEDED');
    const second = await createApiKeysService({ apiKeysRepository: repo }).create({ name: 'Second' });
    await request(app).get('/api/v1/partner/sellers').set('x-api-key', second.key).expect(200);
  });
  it('restricts management to super admins, shows a key once and revokes it', async () => {
    for (const method of ['get', 'post']) await request(app)[method]('/api/v1/admin/api-keys').expect(403);
    await request(app).patch('/api/v1/admin/api-keys/1/revoke').expect(403);
    const created = await request(app).post('/api/v1/admin/api-keys').set('x-test-role', 'super_admin').send({ name: 'Martins Tech' }).expect(201);
    const plain = created.body.data.key;
    assert.match(plain, /^ap_live_[a-f0-9]{64}$/);
    assert.equal(created.headers['cache-control'], 'no-store');
    assert.equal(repo.records[1].keyHash, crypto.createHash('sha256').update(plain).digest('hex'));
    assert.ok(!JSON.stringify(repo.records).includes(plain));
    const listed = await request(app).get('/api/v1/admin/api-keys').set('x-test-role', 'super_admin').expect(200);
    assert.ok(!JSON.stringify(listed.body).includes(plain)); assert.ok(!JSON.stringify(listed.body).includes('keyHash'));
    await request(app).patch('/api/v1/admin/api-keys/2/revoke').set('x-test-role', 'super_admin').expect(200);
    await request(app).get('/api/v1/partner/products').set('x-api-key', plain).expect(401);
    await request(app).patch('/api/v1/admin/api-keys/999/revoke').set('x-test-role', 'super_admin').expect(404);
    await request(app).post('/api/v1/admin/api-keys').set('x-test-role', 'super_admin').send({ name: 'x', scopes: ['admin:write'] }).expect(422);
  });
});
