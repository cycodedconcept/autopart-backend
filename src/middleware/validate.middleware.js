const { ERROR_CODES } = require('../config/constants');
const AppError = require('../utils/app-error');

function validateRequest(schema) {
  return function validationMiddleware(req, res, next) {
    const validationTarget = {
      body: req.body,
      params: req.params,
      query: req.query
    };

    const { error, value } = schema.validate(validationTarget, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return next(new AppError(error.details.map((detail) => detail.message).join(', '), {
        statusCode: 422,
        code: ERROR_CODES.VALIDATION_ERROR
      }));
    }

    req.body = value.body;
    req.params = value.params;
    req.query = value.query;

    return next();
  };
}

module.exports = {
  validateRequest
};
