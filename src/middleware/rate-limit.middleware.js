const rateLimit = require('express-rate-limit');

function createAuthRateLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many auth requests. Please try again later.'
      }
    }
  });
}

module.exports = {
  createAuthRateLimiter
};
