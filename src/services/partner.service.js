const { normalizePagination, buildPagination } = require('../utils/pagination');
const AppError = require('../utils/app-error');
const { ERROR_CODES } = require('../config/constants');
function createPartnerService({ partnerRepository }) {
  async function list(kind, query) {
    const pagination = normalizePagination(query, { maxLimit: 100 });
    const result = await partnerRepository[kind === 'products' ? 'listProducts' : 'listSellers']({ ...query, ...pagination });
    return { [kind]: result[kind], pagination: buildPagination({ ...pagination, total: result.total }) };
  }
  return {
    listProducts: (query) => list('products', query),
    listSellers: (query) => list('sellers', query),
    async listSellerProducts(id, query) {
      if (!await partnerRepository.sellerExists(id)) throw new AppError('Seller was not found.', { statusCode: 404, code: ERROR_CODES.NOT_FOUND });
      return list('products', { ...query, sellerId: id });
    }
  };
}
module.exports = { createPartnerService };
