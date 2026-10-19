require('../../setup/jest');
const crypto = require('crypto');
const { createApiKeysService } = require('../../../src/services/api-keys.service');
const { createRequireApiKey } = require('../../../src/middleware/api-key.middleware');
const key = `ap_live_${'a'.repeat(64)}`;
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
describe('API key middleware', () => {
  let repository, row;
  beforeEach(() => {
    row = { id: 1, name: 'Partner', keyHash: hash(key), scopes: ['catalog:read'], revokedAt: null, expiresAt: null };
    repository = { findByPrefix: jest.fn(async () => [row]), markUsed: jest.fn(async () => true) };
  });
  async function run(value) {
    const req = { get: () => value };
    const middleware = createRequireApiKey({ apiKeysService: createApiKeysService({ apiKeysRepository: repository }) })('catalog:read');
    const error = await new Promise((resolve) => middleware(req, {}, resolve));
    return { req, error };
  }
  it('rejects missing keys', async () => { expect((await run()).error.statusCode).toBe(401); });
  it('rejects malformed keys without querying', async () => { expect((await run('invalid')).error.statusCode).toBe(401); expect(repository.findByPrefix).not.toHaveBeenCalled(); });
  it('rejects unknown keys', async () => { repository.findByPrefix.mockResolvedValue([]); expect((await run(key)).error.statusCode).toBe(401); });
  it('rejects invalid hashes', async () => { row.keyHash = hash('another'); expect((await run(key)).error.statusCode).toBe(401); });
  it('rejects revoked keys', async () => { row.revokedAt = new Date(); expect((await run(key)).error.statusCode).toBe(401); });
  it('rejects expired keys', async () => { row.expiresAt = new Date(Date.now() - 1000); expect((await run(key)).error.statusCode).toBe(401); });
  it('rejects wrong scopes', async () => { row.scopes = []; expect((await run(key)).error.statusCode).toBe(403); expect(repository.markUsed).not.toHaveBeenCalled(); });
  it('accepts valid keys, updates usage and attaches only public identity', async () => {
    row.expiresAt = new Date(Date.now() + 60000);
    const result = await run(key); expect(result.error).toBeUndefined();
    expect(result.req.partner).toEqual({ id: 1, name: 'Partner', scopes: ['catalog:read'] });
    expect(repository.markUsed).toHaveBeenCalledWith(1);
  });
  it('handles prefix collisions and compares fixed-length buffers safely', async () => {
    repository.findByPrefix.mockResolvedValue([{ ...row, keyHash: 'bad' }, { ...row, keyHash: hash('wrong') }, row]);
    expect((await run(key)).error).toBeUndefined();
  });
  it('rejects a key revoked during authentication', async () => { repository.markUsed.mockResolvedValue(false); expect((await run(key)).error.statusCode).toBe(401); });
});
