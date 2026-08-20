const rateLimit = require('express-rate-limit');

function buildErrorMessage(code, message) {
  return {
    success: false,
    error: {
      code,
      message
    }
  };
}

function resolveScopedIpKey(req, scope) {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';

  return `${ip}:${scope}`;
}

function createAuthRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: buildErrorMessage('RATE_LIMIT_EXCEEDED', 'Too many auth requests. Please try again later.')
  });
}

function createBlogCommentRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => resolveScopedIpKey(
      req,
      `blog-comment:${String(req.params.slug || '').toLowerCase()}`
    ),
    message: buildErrorMessage(
      'RATE_LIMIT_EXCEEDED',
      'Too many comment submissions for this post. Please try again later.'
    )
  });
}

function createBlogViewRateLimiter() {
  return rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 1,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => resolveScopedIpKey(
      req,
      `blog-view:${String(req.params.slug || '').toLowerCase()}`
    ),
    handler: (req, res) => res.status(204).end()
  });
}

module.exports = {
  createAuthRateLimiter,
  createBlogCommentRateLimiter,
  createBlogViewRateLimiter
};
