const { sendSuccess } = require('../utils/responses');
function createApiKeysController({ apiKeysService }) {
  return {
    async create(req, res) {
      res.set('Cache-Control', 'no-store');
      return sendSuccess(res, { statusCode: 201, data: await apiKeysService.create(req.body), message: 'API key created. Save it now; it will not be shown again.' });
    },
    async list(req, res) {
      return sendSuccess(res, { data: { apiKeys: await apiKeysService.list() } });
    },
    async revoke(req, res) {
      return sendSuccess(res, { data: await apiKeysService.revoke(req.params.id), message: 'API key revoked.' });
    }
  };
}
module.exports = { createApiKeysController };
