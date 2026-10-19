const path = require('path');
const { sendError } = require('../utils/responses');
const extensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
function requirePublicImageExtension(req, res, next) {
  let pathname;
  try { pathname = decodeURIComponent(req.path); } catch (_error) { pathname = ''; }
  // Decode once, matching express.static. Reject traversal before checking the
  // directory so normalization cannot move a request into private uploads.
  const segments = pathname.split('/');
  const publicDirectory = segments[1] === 'products' || segments[1] === 'product-images';
  const unsafePath = /[\\%]/.test(pathname) || pathname.includes('\0')
    || segments.slice(1).some((segment) => !segment || segment.startsWith('.'));
  if (!pathname.startsWith('/') || !publicDirectory || unsafePath
    || !extensions.has(path.extname(pathname).toLowerCase())) {
    return sendError(res, { statusCode: 404, code: 'NOT_FOUND', message: 'Requested resource was not found.' });
  }
  return next();
}
module.exports = { requirePublicImageExtension };
