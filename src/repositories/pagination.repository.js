const DEFAULT_LIMIT = 10;
const DEFAULT_OFFSET = 0;
const MAX_LIMIT = 50;

function sanitizeInteger(value, { defaultValue, min = 0, max } = {}) {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue)) {
    return defaultValue;
  }

  const boundedValue = Math.max(parsedValue, min);

  if (max === undefined || max === null) {
    return boundedValue;
  }

  return Math.min(boundedValue, max);
}

function sanitizeLimit(limit, options = {}) {
  return sanitizeInteger(limit, {
    defaultValue: options.defaultLimit || DEFAULT_LIMIT,
    min: 1,
    max: options.maxLimit || MAX_LIMIT
  });
}

function sanitizeLimitOffset(filters = {}, options = {}) {
  return {
    limit: sanitizeLimit(filters.limit, options),
    offset: sanitizeInteger(filters.offset, {
      defaultValue: options.defaultOffset === undefined ? DEFAULT_OFFSET : options.defaultOffset,
      min: 0
    })
  };
}

module.exports = {
  sanitizeLimit,
  sanitizeLimitOffset
};
