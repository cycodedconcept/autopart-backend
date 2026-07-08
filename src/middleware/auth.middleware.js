const { ERROR_CODES } = require('../config/constants');
const AppError = require('../utils/app-error');
const asyncHandler = require('./async-handler');

function createBearerAuthMiddleware({ authenticate, requestProperty }) {
  return asyncHandler(async (req, res, next) => {
    const authorizationHeader = req.headers.authorization;

    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication is required.', {
        statusCode: 401,
        code: ERROR_CODES.AUTH_REQUIRED
      });
    }

    const token = authorizationHeader.replace('Bearer ', '').trim();
    const principal = await authenticate(token);

    req[requestProperty] = principal;
    next();
  });
}

function createAuthMiddleware({ authService }) {
  return createBearerAuthMiddleware({
    authenticate: (token) => authService.getAuthenticatedUser(token),
    requestProperty: 'user'
  });
}

function createAdminAuthMiddleware({ adminService }) {
  return createBearerAuthMiddleware({
    authenticate: (token) => adminService.getAuthenticatedAdmin(token),
    requestProperty: 'admin'
  });
}

module.exports = {
  createAdminAuthMiddleware,
  createAuthMiddleware
};
