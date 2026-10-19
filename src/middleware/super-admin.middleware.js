const AppError = require('../utils/app-error');
const { ADMIN_ROLE_NAMES, ERROR_CODES } = require('../config/constants');
function requireSuperAdmin(req, res, next) {
  if (!req.admin) return next(new AppError('Authentication is required.', { statusCode: 401, code: ERROR_CODES.AUTH_REQUIRED }));
  if (!(req.admin.roles || []).includes(ADMIN_ROLE_NAMES.SUPER_ADMIN)) {
    return next(new AppError('Super admin access is required.', { statusCode: 403, code: ERROR_CODES.FORBIDDEN }));
  }
  return next();
}
module.exports = { requireSuperAdmin };
