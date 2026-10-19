require('../setup/mocha');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const request = require('supertest');
const { createApp } = require('../../src/app');
const env = require('../../src/config/env');

describe('Public upload serving', () => {
  let app, directory;
  before(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'autoparts-upload-test-'));
    app = createApp({ env: { ...env, UPLOAD_DIR: directory } });
    for (const filename of ['photo.jpg', 'photo.jpeg', 'photo.png', 'photo.webp', 'photo.gif', 'secret.txt', 'script.svg', 'shell.php', '.hidden.jpg']) {
      await fs.writeFile(path.join(directory, 'products', filename), 'test content');
    }
    for (const folder of ['product-images', 'seller-documents', 'blog', 'products-backup']) {
      await fs.mkdir(path.join(directory, folder), { recursive: true });
      await fs.writeFile(path.join(directory, folder, 'photo.jpg'), 'sensitive fixture');
    }
    await fs.writeFile(path.join(directory, 'photo.jpg'), 'sensitive fixture');
    await fs.mkdir(path.join(directory, 'disputes'), { recursive: true });
    await fs.writeFile(path.join(directory, 'disputes', 'evidence.jpg'), 'private');
  });
  after(async () => { if (directory) await fs.rm(directory, { recursive: true, force: true }); });
  for (const extension of ['jpg', 'jpeg', 'png', 'webp', 'gif']) {
    it(`serves ${extension} with cache and nosniff headers`, async () => {
      const response = await request(app).get(`/uploads/products/photo.${extension}`).expect(200);
      assert.equal(response.headers['cache-control'], 'public, max-age=604800');
      assert.equal(response.headers['x-content-type-options'], 'nosniff');
    });
  }
  it('serves the product-images folder with the same protections', async () => {
    const response = await request(app).get('/uploads/product-images/photo.jpg').expect(200);
    assert.equal(response.headers['cache-control'], 'public, max-age=604800');
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
  });
  for (const target of ['seller-documents/photo.jpg', 'blog/photo.jpg', 'products-backup/photo.jpg', 'photo.jpg',
    'products/../seller-documents/photo.jpg',
    'products/%2e%2e/seller-documents/photo.jpg',
    'products/%2E%2E%2Fseller-documents%2Fphoto.jpg',
    'products/..%5cseller-documents%5cphoto.jpg',
    'products/%252e%252e%252fseller-documents/photo.jpg',
    '%73eller-documents/photo.jpg', 'product-images/../seller-documents/photo.jpg',
    'products/secret.txt', 'products/script.svg', 'products/shell.php', 'products/', 'products/.hidden.jpg', '.htaccess', 'disputes/evidence.jpg', '%64isputes/evidence.jpg', 'products/missing.jpg']) {
    it(`does not expose ${target}`, async () => {
      const response = await request(app).get(`/uploads/${target}`).expect(404);
      assert.ok(!response.text.includes(directory));
      assert.ok(!response.text.includes('test content'));
      assert.ok(!response.text.includes('sensitive fixture'));
    });
  }
});
