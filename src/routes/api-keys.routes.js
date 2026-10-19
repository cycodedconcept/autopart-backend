const express = require('express');
const asyncHandler = require('../middleware/async-handler');
const { requireSuperAdmin } = require('../middleware/super-admin.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const { createApiKeySchema, listApiKeysSchema, revokeApiKeySchema } = require('../validators/api-keys.validator');
function createApiKeysRouter({ adminAuthMiddleware, apiKeysController }) {
  const router = express.Router();
  router.use(adminAuthMiddleware, requireSuperAdmin);
  router.post('/', validateRequest(createApiKeySchema), asyncHandler(apiKeysController.create));
  router.get('/', validateRequest(listApiKeysSchema), asyncHandler(apiKeysController.list));
  router.patch('/:id/revoke', validateRequest(revokeApiKeySchema), asyncHandler(apiKeysController.revoke));
  return router;
}
module.exports = { createApiKeysRouter };
