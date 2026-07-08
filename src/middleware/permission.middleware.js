const { ERROR_CODES } = require('../config/constants');
const AppError = require('../utils/app-error');

function authorizePermissions(...requiredPermissionKeys) {
  return function permissionGuard(req, res, next) {
    if (!req.admin) {
      return next(new AppError('Authentication is required.', {
        statusCode: 401,
        code: ERROR_CODES.AUTH_REQUIRED
      }));
    }

    const assignedPermissions = new Set(req.admin.permissions || []);
    const hasPermissions = requiredPermissionKeys.every(
      (permissionKey) => assignedPermissions.has(permissionKey)
    );

    if (!hasPermissions) {
      return next(new AppError('You do not have permission to access this resource.', {
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN
      }));
    }

    return next();
  };
}

module.exports = {
  authorizePermissions
};
