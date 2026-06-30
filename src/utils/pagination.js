function normalizePagination(query = {}, options = {}) {
  const defaultPage = options.defaultPage || 1;
  const defaultLimit = options.defaultLimit || 10;
  const maxLimit = options.maxLimit || 50;

  const page = Math.max(query.page || defaultPage, 1);
  const limit = Math.min(Math.max(query.limit || defaultLimit, 1), maxLimit);

  return {
    page,
    limit,
    offset: (page - 1) * limit
  };
}

function buildPagination({ page, limit, total }) {
  return {
    page,
    limit,
    total,
    totalPages: total > 0 ? Math.ceil(total / limit) : 0
  };
}

module.exports = {
  buildPagination,
  normalizePagination
};
