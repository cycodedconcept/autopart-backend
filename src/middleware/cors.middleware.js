const { sendError } = require('../utils/responses');

const DEFAULT_ALLOWED_HEADERS = 'Origin, X-Requested-With, Content-Type, Accept, Authorization';
const DEFAULT_ALLOWED_METHODS = 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS';
const PREFLIGHT_CACHE_SECONDS = '86400';

function normalizeAllowedOrigins(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
  }

  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function createCorsMiddleware({ env }) {
  const allowedOrigins = normalizeAllowedOrigins(env.CORS_ALLOWED_ORIGINS);
  const allowAnyOrigin = allowedOrigins.length === 0 || allowedOrigins.includes('*');

  return function corsMiddleware(req, res, next) {
    const requestOrigin = req.get('origin');
    const requestedHeaders = req.get('access-control-request-headers');

    res.set('Access-Control-Allow-Methods', DEFAULT_ALLOWED_METHODS);
    res.set('Access-Control-Allow-Headers', requestedHeaders || DEFAULT_ALLOWED_HEADERS);
    res.set('Access-Control-Max-Age', PREFLIGHT_CACHE_SECONDS);

    if (!requestOrigin) {
      if (req.method === 'OPTIONS') {
        return res.status(204).end();
      }

      return next();
    }

    const isAllowedOrigin = allowAnyOrigin || allowedOrigins.includes(requestOrigin);

    if (!allowAnyOrigin) {
      res.append('Vary', 'Origin');
    }

    if (isAllowedOrigin) {
      res.set('Access-Control-Allow-Origin', allowAnyOrigin ? '*' : requestOrigin);
    }

    if (req.method === 'OPTIONS') {
      if (!isAllowedOrigin) {
        return sendError(res, {
          statusCode: 403,
          code: 'FORBIDDEN',
          message: 'CORS origin is not allowed.'
        });
      }

      return res.status(204).end();
    }

    return next();
  };
}

module.exports = {
  createCorsMiddleware
};
