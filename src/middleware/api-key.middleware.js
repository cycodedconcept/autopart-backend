const asyncHandler = require('./async-handler');
function createRequireApiKey({ apiKeysService }) {
  return function requireApiKey(scope) {
    return asyncHandler(async (req, res, next) => {
      req.partner = await apiKeysService.authenticate(req.get('x-api-key'), scope);
      next();
    });
  };
}
module.exports = { createRequireApiKey };
