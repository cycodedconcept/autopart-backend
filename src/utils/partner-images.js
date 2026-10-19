const AppError = require('./app-error');
const { ERROR_CODES } = require('../config/constants');

function publicProductImageUrl(storedPath, appUrl) {
  // Only the public URL paths written by product uploads are eligible. Never
  // interpret disk paths, remote URLs, query strings or traversal as image URLs.
  if (typeof storedPath !== 'string'
    || !/^\/uploads\/products\/[a-z0-9_-][a-z0-9_.-]*\.(?:jpg|jpeg|png|webp|gif)$/i.test(storedPath)) return null;
  let base;
  try { base = new URL(appUrl); } catch (_error) { base = null; }
  if (!base || !['https:', 'http:'].includes(base.protocol) || base.username || base.password) {
    throw new AppError('APP_URL must be configured as a public HTTP(S) URL.', {
      statusCode: 500, code: ERROR_CODES.INTERNAL_SERVER_ERROR
    });
  }
  return new URL(storedPath, base).href;
}

function mapPartnerImages(rows, appUrl) {
  const imagesByProduct = new Map();
  for (const row of rows) {
    const url = publicProductImageUrl(row.url, appUrl);
    if (!url) continue;
    const key = String(row.productId);
    if (!imagesByProduct.has(key)) imagesByProduct.set(key, []);
    imagesByProduct.get(key).push({ url, isPrimary: false, position: row.position });
  }
  for (const images of imagesByProduct.values()) {
    images.sort((a, b) => a.position - b.position);
    images[0].isPrimary = true;
  }
  return imagesByProduct;
}
module.exports = { mapPartnerImages };
