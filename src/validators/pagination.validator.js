const Joi = require('joi');

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

function buildPaginationQuerySchema(fields = {}, options = {}) {
  const defaultPage = options.defaultPage || DEFAULT_PAGE;
  const defaultLimit = options.defaultLimit || DEFAULT_LIMIT;
  const maxLimit = options.maxLimit || MAX_LIMIT;

  return Joi.object({
    ...fields,
    page: Joi.number().integer().min(1).default(defaultPage),
    limit: Joi.number().integer().min(1).max(maxLimit).default(defaultLimit),
    offset: Joi.number().integer().min(0).optional()
  }).custom((value) => ({
    ...value,
    offset: value.offset === undefined
      ? (value.page - 1) * value.limit
      : value.offset
  })).default({});
}

module.exports = {
  buildPaginationQuerySchema
};
