const { ERROR_CODES } = require('../config/constants');
const AppError = require('../utils/app-error');
const { buildPagination, normalizePagination } = require('../utils/pagination');

function mapCompatibility(compatibility) {
  return {
    id: compatibility.id,
    make: compatibility.make,
    model: compatibility.model,
    yearFrom: compatibility.yearFrom,
    yearTo: compatibility.yearTo
  };
}

function mapImage(image) {
  return {
    id: image.id,
    url: image.url,
    position: image.position
  };
}

function mapListProduct(product) {
  return {
    id: product.id,
    title: product.title,
    category: {
      id: product.categoryId,
      name: product.categoryName,
      slug: product.categorySlug
    },
    partNumber: product.partNumber,
    condition: product.condition,
    priceKobo: product.priceKobo,
    stockQty: product.stockQty,
    location: product.location,
    // SELLER-STUB public seller info is projected from the product record for buyer reads.
    seller: {
      id: product.sellerId,
      businessName: product.sellerBusinessName,
      rating: product.sellerRating
    },
    primaryImageUrl: product.primaryImageUrl
  };
}

function mapProductDetail(product, images, compatibility) {
  return {
    id: product.id,
    title: product.title,
    description: product.description,
    category: {
      id: product.categoryId,
      name: product.categoryName,
      slug: product.categorySlug
    },
    partNumber: product.partNumber,
    condition: product.condition,
    priceKobo: product.priceKobo,
    stockQty: product.stockQty,
    location: product.location,
    // SELLER-STUB public seller info is projected from the product record for buyer reads.
    seller: {
      id: product.sellerId,
      businessName: product.sellerBusinessName,
      rating: product.sellerRating
    },
    primaryImageUrl: product.primaryImageUrl,
    photos: images.map(mapImage),
    compatibility: compatibility.map(mapCompatibility)
  };
}

function createProductsService({ productsRepository }) {
  async function getProductById(productId) {
    const product = await productsRepository.findProductById(productId);

    if (!product) {
      throw new AppError('Product was not found.', {
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND
      });
    }

    const [images, compatibility] = await Promise.all([
      productsRepository.findProductImagesByProductId(productId),
      productsRepository.findProductCompatibilityByProductId(productId)
    ]);

    return mapProductDetail(product, images, compatibility);
  }

  async function listProducts(query = {}) {
    const pagination = normalizePagination(query, {
      defaultLimit: 10,
      maxLimit: 50
    });
    const filters = {
      partName: query.partName || null,
      vehicleMake: query.vehicleMake || null,
      vehicleModel: query.vehicleModel || null,
      vehicleYear: query.vehicleYear ?? null,
      category: query.category ?? null,
      partNumber: query.partNumber || null,
      condition: query.condition || null,
      minPriceKobo: query.minPriceKobo ?? null,
      maxPriceKobo: query.maxPriceKobo ?? null,
      location: query.location || null,
      sellerRating: query.sellerRating ?? null,
      sellerBusinessName: query.sellerBusinessName || null,
      page: pagination.page,
      limit: pagination.limit,
      offset: pagination.offset
    };
    const result = await productsRepository.listProducts(filters);

    return {
      products: result.products.map(mapListProduct),
      pagination: buildPagination({
        page: pagination.page,
        limit: pagination.limit,
        total: result.total
      })
    };
  }

  return {
    getProductById,
    listProducts
  };
}

module.exports = {
  createProductsService
};
