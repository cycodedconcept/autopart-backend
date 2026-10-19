const crypto = require('crypto');
const AppError = require('../utils/app-error');
const { ERROR_CODES } = require('../config/constants');
function createApiKeysService({ apiKeysRepository }) {
  return {
    async create({ name, scopes = ['catalog:read'], expiresAt = null }) {
      const key = `ap_live_${crypto.randomBytes(32).toString('hex')}`;
      const record = await apiKeysRepository.create({
        name, scopes, expiresAt, keyPrefix: key.slice(0, 8),
        keyHash: crypto.createHash('sha256').update(key).digest('hex')
      });
      return { ...record, key };
    },
    list: () => apiKeysRepository.list(),
    async revoke(id) {
      const record = await apiKeysRepository.revoke(id);
      if (!record) throw new AppError('API key was not found.', { statusCode: 404, code: ERROR_CODES.NOT_FOUND });
      return record;
    },
    async authenticate(key, scope) {
      if (!key) throw new AppError('API key is required.', { statusCode: 401, code: ERROR_CODES.AUTH_REQUIRED });
      const unauthorized = () => new AppError('Invalid or inactive API key.', { statusCode: 401, code: ERROR_CODES.UNAUTHORIZED });
      if (typeof key !== 'string' || !/^ap_live_[a-f0-9]{64}$/.test(key)) throw unauthorized();
      const hash = crypto.createHash('sha256').update(key).digest();
      const candidates = await apiKeysRepository.findByPrefix(key.slice(0, 8));
      let partner;
      // Prefixes deliberately collide: compare every candidate, never use LIMIT 1.
      for (const candidate of candidates) {
        const stored = Buffer.from(candidate.keyHash, 'hex');
        if (stored.length === hash.length && crypto.timingSafeEqual(stored, hash)) partner = candidate;
      }
      if (!partner || partner.revokedAt || (partner.expiresAt && new Date(partner.expiresAt).getTime() <= Date.now())) throw unauthorized();
      if (!Array.isArray(partner.scopes) || !partner.scopes.includes(scope)) {
        throw new AppError('API key lacks the required scope.', { statusCode: 403, code: ERROR_CODES.FORBIDDEN });
      }
      if (!await apiKeysRepository.markUsed(partner.id)) throw unauthorized();
      return { id: partner.id, name: partner.name, scopes: partner.scopes };
    }
  };
}
module.exports = { createApiKeysService };
