const { ERROR_CODES } = require('../config/constants');
const AppError = require('../utils/app-error');

function parseJsonFields(fieldNames = []) {
  return function parseJsonFieldsMiddleware(req, res, next) {
    try {
      for (const fieldName of fieldNames) {
        const value = req.body ? req.body[fieldName] : undefined;

        if (typeof value === 'string') {
          req.body[fieldName] = JSON.parse(value);
        }
      }

      return next();
    } catch (_error) {
      return next(new AppError('One or more JSON-encoded form fields are invalid.', {
        statusCode: 422,
        code: ERROR_CODES.VALIDATION_ERROR
      }));
    }
  };
}

module.exports = {
  parseJsonFields
};
