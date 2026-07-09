const { ERROR_CODES } = require('../config/constants');
const AppError = require('../utils/app-error');
const { sendError } = require('../utils/responses');

function createErrorMiddleware({ logger }) {
  // Express identifies error middleware by its four-argument signature.
  // eslint-disable-next-line no-unused-vars
  return function errorMiddleware(error, req, res, _next) {
    let normalizedError;

    if (error instanceof AppError) {
      normalizedError = error;
    } else if (error instanceof SyntaxError && error.status === 400 && error.type === 'entity.parse.failed') {
      normalizedError = new AppError('Invalid JSON payload.', {
        statusCode: 400,
        code: ERROR_CODES.VALIDATION_ERROR
      });
    } else {
      normalizedError = new AppError('An unexpected error occurred.', {
        statusCode: 500,
        code: ERROR_CODES.INTERNAL_SERVER_ERROR
      });
    }

    if (normalizedError.statusCode >= 500) {
      logger.error(normalizedError.message, {
        errorCode: error && error.code ? error.code : undefined,
        errorMessage: error && error.message ? error.message : undefined,
        errorName: error && error.name ? error.name : undefined,
        path: req.path,
        method: req.method,
        sqlMessage: error && error.sqlMessage ? error.sqlMessage : undefined,
        sqlState: error && error.sqlState ? error.sqlState : undefined,
        stack: error && error.stack ? error.stack : undefined
      });
    }

    return sendError(res, normalizedError);
  };
}

module.exports = {
  createErrorMiddleware
};
