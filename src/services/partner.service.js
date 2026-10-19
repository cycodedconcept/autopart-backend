const { normalizePagination, buildPagination } = require('../utils/pagination');
const { mapPartnerImages } = require('../utils/partner-images');
const AppError = require('../utils/app-error');
const { ERROR_CODES } = require('../config/constants');
function createPartnerService({ partnerRepository, env }) {
  async function list(kind, query) {
    const pagination = normalizePagination(query, { maxLimit: 100 });
    const result = await partnerRepository[kind === 'products' ? 'listProducts' : 'listSellers']({ ...query, ...pagination });
    if (kind === 'products') {
      const rows = result.products.length
        ? await partnerRepository.findImagesByProductIds(result.products.map((product) => product.id))
        : [];
      const imagesByProduct = mapPartnerImages(rows, env.APP_URL);
      result.products = result.products.map((product) => {
        const images = imagesByProduct.get(String(product.id)) || [];
        return { ...product, images, thumbnailUrl: images.length ? images[0].url : null };
      });
    }
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
