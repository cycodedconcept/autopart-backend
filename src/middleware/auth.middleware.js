const { ERROR_CODES } = require('../config/constants');
const AppError = require('../utils/app-error');
const asyncHandler = require('./async-handler');

function createAuthMiddleware({ authService }) {
  return asyncHandler(async (req, res, next) => {
    const authorizationHeader = req.headers.authorization;

    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication is required.', {
        statusCode: 401,
        code: ERROR_CODES.AUTH_REQUIRED
      });
    }

    const token = authorizationHeader.replace('Bearer ', '').trim();
    const user = await authService.getAuthenticatedUser(token);

    req.user = user;
    next();
  });
}

module.exports = {
  createAuthMiddleware
};
