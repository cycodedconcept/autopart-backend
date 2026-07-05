const { ERROR_CODES } = require('../config/constants');
const AppError = require('../utils/app-error');

function authorizeRoles(...allowedRoles) {
  return function roleGuard(req, res, next) {
    if (!req.user) {
      return next(new AppError('Authentication is required.', {
        statusCode: 401,
        code: ERROR_CODES.AUTH_REQUIRED
      }));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to access this resource.', {
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN
      }));
    }

    return next();
  };
}

module.exports = {
  authorizeRoles
};
