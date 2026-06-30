const { createCatalogueFixture } = require('./catalogue-fixture');

function matchesProductFilters(product, filters) {
  if (product.status !== 'active') {
    return false;
  }

  if (filters.partName) {
    const search = filters.partName.toLowerCase();
    const searchableText = `${product.title} ${product.description}`.toLowerCase();

    if (!searchableText.includes(search)) {
      return false;
    }
  }

  if (filters.partNumber && !product.partNumber.toLowerCase().includes(filters.partNumber.toLowerCase())) {
    return false;
  }

  if (filters.condition && product.condition !== filters.condition) {
    return false;
  }

  if (filters.category !== null && filters.category !== undefined) {
    if (typeof filters.category === 'number' && product.categoryId !== filters.category) {
      return false;
    }

    if (typeof filters.category === 'string') {
      const normalizedCategory = filters.category.toLowerCase();

      if (
        product.categorySlug.toLowerCase() !== normalizedCategory
        && product.categoryName.toLowerCase() !== normalizedCategory
      ) {
        return false;
      }
    }
  }

  if (filters.minPriceKobo !== null && filters.minPriceKobo !== undefined && product.priceKobo < filters.minPriceKobo) {
    return false;
  }

  if (filters.maxPriceKobo !== null && filters.maxPriceKobo !== undefined && product.priceKobo > filters.maxPriceKobo) {
    return false;
  }

  if (filters.location && !product.location.toLowerCase().includes(filters.location.toLowerCase())) {
    return false;
  }

  if (
    filters.sellerBusinessName
    && !product.sellerBusinessName.toLowerCase().includes(filters.sellerBusinessName.toLowerCase())
  ) {
    return false;
  }

  if (filters.sellerRating !== null && filters.sellerRating !== undefined && product.sellerRating < filters.sellerRating) {
    return false;
  }

  if (filters.vehicleMake || filters.vehicleModel || filters.vehicleYear) {
    const isCompatible = product.compatibility.some((compatibility) => {
      if (
        filters.vehicleMake
        && compatibility.make.toLowerCase() !== filters.vehicleMake.toLowerCase()
      ) {
        return false;
      }

      if (
        filters.vehicleModel
        && compatibility.model.toLowerCase() !== filters.vehicleModel.toLowerCase()
      ) {
        return false;
      }

      if (
        filters.vehicleYear !== null
        && filters.vehicleYear !== undefined
        && (compatibility.yearFrom > filters.vehicleYear || compatibility.yearTo < filters.vehicleYear)
      ) {
        return false;
      }

      return true;
    });

    if (!isCompatible) {
      return false;
    }
  }

  return true;
}

function toRepositoryProduct(product) {
  return {
    id: product.id,
    sellerId: product.sellerId,
    title: product.title,
    description: product.description,
    categoryId: product.categoryId,
    categoryName: product.categoryName,
    categorySlug: product.categorySlug,
    partNumber: product.partNumber,
    condition: product.condition,
    priceKobo: product.priceKobo,
    stockQty: product.stockQty,
    location: product.location,
    sellerBusinessName: product.sellerBusinessName,
    sellerRating: product.sellerRating,
    status: product.status,
    primaryImageUrl: product.images[0] ? product.images[0].url : null,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt
  };
}

function createInMemoryProductsRepository() {
  const products = createCatalogueFixture();

  return {
    async findProductById(productId) {
      const product = products.find((entry) => entry.id === Number(productId) && entry.status === 'active');

      return product ? toRepositoryProduct(product) : null;
    },

    async findProductCompatibilityByProductId(productId) {
      const product = products.find((entry) => entry.id === Number(productId));

      return product ? product.compatibility.map((entry) => ({ ...entry })) : [];
    },

    async findProductImagesByProductId(productId) {
      const product = products.find((entry) => entry.id === Number(productId));

      return product ? product.images.map((entry) => ({ ...entry })) : [];
    },

    async listProducts(filters) {
      const matchedProducts = products
        .filter((product) => matchesProductFilters(product, filters))
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));

      return {
        products: matchedProducts
          .slice(filters.offset, filters.offset + filters.limit)
          .map(toRepositoryProduct),
        total: matchedProducts.length
      };
    }
  };
}

module.exports = {
  createInMemoryProductsRepository
};
