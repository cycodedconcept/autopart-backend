const asyncHandler = require('./async-handler');
const AppError = require('../utils/app-error');
const { ERROR_CODES } = require('../config/constants');

function createDisputeEvidenceAuthMiddleware({ authService, adminService }) {
  return asyncHandler(async (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new AppError('Authentication is required.', { statusCode: 401, code: ERROR_CODES.AUTH_REQUIRED });
    }
    const token = authorization.slice('Bearer '.length).trim();
    try {
      req.user = await authService.getAuthenticatedUser(token);
    } catch (error) {
      if (error.statusCode !== 401) throw error;
      req.admin = await adminService.getAuthenticatedAdmin(token);
    }
    next();
  });
}

module.exports = { createDisputeEvidenceAuthMiddleware };
