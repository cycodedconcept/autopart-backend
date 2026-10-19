const path = require('path');
const { sendError } = require('../utils/responses');
const extensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
function requirePublicImageExtension(req, res, next) {
  let pathname;
  try { pathname = decodeURIComponent(req.path); } catch (_error) { pathname = ''; }
  if (!extensions.has(path.extname(pathname).toLowerCase())) {
    return sendError(res, { statusCode: 404, code: 'NOT_FOUND', message: 'Requested resource was not found.' });
  }
  return next();
}
module.exports = { requirePublicImageExtension };
