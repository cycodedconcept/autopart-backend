require('../setup/env');
const assert = require('node:assert/strict');
const mysql = require('mysql2/promise');
const request = require('supertest');
const env = require('../../src/config/env');
const { createApp } = require('../../src/app');
const { createApiKeysRepository } = require('../../src/repositories/api-keys.repository');
const { createApiKeysService } = require('../../src/services/api-keys.service');
const { createPartnerFixturesRepository } = require('./partner-fixtures.repository');
describe('Partner catalogue against disposable MySQL', function () {
  this.timeout(20000);
  let db, fixtures, app, key, service;
  before(async () => {
    db = await mysql.createConnection({ host: '127.0.0.1', port: 33316, user: 'root', database: 'autoparts_admin_test' });
    fixtures = createPartnerFixturesRepository(db);
    await fixtures.seed();
    await fixtures.seedImages();
    service = createApiKeysService({ apiKeysRepository: createApiKeysRepository({ db }) });
    key = (await service.create({ name: 'MySQL partner' })).key;
    app = createApp({ db, env: { ...env, APP_URL: 'https://autoparts.example.test' } });
  });
  after(async () => { if (fixtures) await fixtures.rollback(); if (db) await db.end(); });
  function get(path) { return request(app).get(`/api/v1/partner${path}`).set('x-api-key', key); }
  function assertSeller(seller, count = false) {
    assert.deepEqual(Object.keys(seller).sort(), ['id', 'businessName', 'city', 'state', 'verificationStatus', 'rating', 'createdAt', ...(count ? ['productCount'] : [])].sort());
    assert.equal(seller.id, 8001);
    assert.equal(seller.verificationStatus, 'verified');
    assert.equal(seller.city, null);
    assert.equal(seller.rating, 4.5);
    assert.ok(!JSON.stringify(seller).includes('private'));
  }
  it('joins only eligible sellers, excludes inactive products, and returns 100 rows', async () => {
    const response = await get('/products?search=Partner&limit=100').expect(200);
    assert.equal(response.body.data.products.length, 100);
    assert.deepEqual(response.body.data.pagination, { page: 1, limit: 100, total: 102, totalPages: 2 });
    response.body.data.products.forEach((product) => assertSeller(product.seller));
    const page = await get('/products?search=Partner&limit=100&page=2').expect(200);
    assert.equal(page.body.data.products.length, 2);
    assert.equal(new Set([...response.body.data.products, ...page.body.data.products].map((p) => p.id)).size, 102);
  });
  it('filters and sorts by integer kobo with category slug and seller id', async () => {
    const response = await get('/products?search=Partner&category=partner-parts&sellerId=8001&minPrice=110&maxPrice=112&sort=price').expect(200);
    assert.deepEqual(response.body.data.products.map((p) => p.priceKobo), [110, 111, 112]);
  });
  it('lists sellers with eligible product counts and no private fields', async () => {
    const response = await get('/sellers?limit=100').expect(200);
    const sellers = response.body.data.sellers.filter((seller) => seller.id >= 8001);
    assert.equal(sellers.length, 1); assertSeller(sellers[0], true); assert.equal(sellers[0].productCount, 102);
  });
  it('enforces seller eligibility and privacy on seller products', async () => {
    const response = await get('/sellers/8001/products?limit=100').expect(200);
    response.body.data.products.forEach((p) => assertSeller(p.seller));
    await get('/sellers/8002/products').expect(404);
    await get('/sellers/8003/products').expect(404);
  });
  for (const path of ['/products?sellerId=8001', '/sellers/8001/products?']) {
    it(`loads the whole page's images with one query on ${path}`, async () => {
      const execute = db.execute;
      const imageQueries = [];
      db.execute = function (sql, params) {
        if (/FROM product_images/i.test(sql)) imageQueries.push({ sql, params });
        return execute.call(this, sql, params);
      };
      let response;
      try { response = await get(`${path}&sort=price&limit=3`).expect(200); }
      finally { db.execute = execute; }
      assert.equal(imageQueries.length, 1);
      assert.match(imageQueries[0].sql, /WHERE product_id IN/);
      assert.deepEqual(imageQueries[0].params, [8000, 8001, 8002]);
      const products = response.body.data.products;
      assert.deepEqual(products[0].images, [
        { url: 'https://autoparts.example.test/uploads/products/first.jpg', isPrimary: true, position: 1 },
        { url: 'https://autoparts.example.test/uploads/products/second.png', isPrimary: false, position: 3 }
      ]);
      assert.equal(products[0].thumbnailUrl, products[0].images[0].url);
      assert.equal(products[1].images.length, 1);
      assert.equal(products[1].images[0].isPrimary, true);
      assert.deepEqual(products[2].images, []);
      assert.equal(products[2].thumbnailUrl, null);
    });
  }
  it('persists usage and rejects revoked keys', async () => {
    await get('/products').expect(200);
    const records = await service.list();
    const own = records.find((record) => record.name === 'MySQL partner');
    assert.ok(own.lastUsedAt); assert.ok(!Object.hasOwn(own, 'keyHash'));
    await service.revoke(own.id);
    await get('/products').expect(401);
  });
});
