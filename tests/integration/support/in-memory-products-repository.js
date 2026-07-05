const { createCatalogueFixture } = require('./catalogue-fixture');

function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

function buildCategories(products) {
  return products.reduce((categories, product) => {
    if (!categories.find((entry) => entry.id === product.categoryId)) {
      categories.push({
        id: product.categoryId,
        name: product.categoryName,
        slug: product.categorySlug
      });
    }

    return categories;
  }, []);
}

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
  const products = clone(createCatalogueFixture());
  const categories = buildCategories(products);
  const counters = {
    productId: Math.max(...products.map((product) => product.id)) + 1,
    imageId: Math.max(...products.flatMap((product) => product.images.map((image) => image.id))) + 1,
    compatibilityId: Math.max(
      ...products.flatMap((product) => product.compatibility.map((entry) => entry.id))
    ) + 1
  };

  function findProductRecord(productId) {
    return products.find((entry) => entry.id === Number(productId)) || null;
  }

  function applyField(product, field) {
    switch (field.column) {
      case 'title':
        product.title = field.value;
        break;
      case 'description':
        product.description = field.value;
        break;
      case 'category_id': {
        const category = categories.find((entry) => entry.id === field.value);

        product.categoryId = field.value;
        product.categoryName = category ? category.name : product.categoryName;
        product.categorySlug = category ? category.slug : product.categorySlug;
        break;
      }
      case 'part_number':
        product.partNumber = field.value;
        break;
      case '`condition`':
        product.condition = field.value;
        break;
      case 'price_kobo':
        product.priceKobo = field.value;
        break;
      case 'stock_qty':
        product.stockQty = field.value;
        break;
      case 'location':
        product.location = field.value;
        break;
      case 'status':
        product.status = field.value;
        break;
      default:
        break;
    }
  }

  return {
    async createSellerProductsBulk(payload) {
      const createdProducts = [];

      for (const product of payload.products) {
        createdProducts.push(await this.createSellerProduct({
          sellerId: payload.sellerId,
          sellerBusinessName: payload.sellerBusinessName || 'Seller Bulk Upload',
          sellerRating: payload.sellerRating || 0,
          ...product
        }));
      }

      return createdProducts;
    },

    async createSellerProduct(payload) {
      const now = new Date().toISOString();
      const product = {
        id: counters.productId,
        sellerId: payload.sellerId,
        title: payload.title,
        description: payload.description,
        categoryId: payload.categoryId,
        categoryName: payload.categoryName,
        categorySlug: payload.categorySlug,
        partNumber: payload.partNumber,
        condition: payload.condition,
        priceKobo: payload.priceKobo,
        stockQty: payload.stockQty,
        location: payload.location,
        sellerBusinessName: payload.sellerBusinessName,
        sellerRating: payload.sellerRating,
        status: payload.status,
        createdAt: now,
        updatedAt: now,
        images: payload.photos.map((photo) => ({
          id: counters.imageId++,
          productId: counters.productId,
          url: photo.filePath,
          position: photo.position
        })),
        compatibility: payload.compatibility.map((entry) => ({
          id: counters.compatibilityId++,
          productId: counters.productId,
          make: entry.make,
          model: entry.model,
          yearFrom: entry.yearFrom,
          yearTo: entry.yearTo
        }))
      };

      products.push(product);
      counters.productId += 1;

      return toRepositoryProduct(product);
    },

    async deactivateOwnedProduct(productId, sellerId) {
      const product = products.find((entry) => (
        entry.id === Number(productId) && entry.sellerId === Number(sellerId)
      ));

      if (!product) {
        return null;
      }

      product.status = 'inactive';
      product.updatedAt = new Date().toISOString();

      return toRepositoryProduct(product);
    },

    async findCategoryById(categoryId) {
      return clone(categories.find((entry) => entry.id === Number(categoryId)) || null);
    },

    async findCategoriesByIds(categoryIds) {
      return clone(
        categories.filter((entry) => categoryIds.map(Number).includes(entry.id))
      );
    },

    async findOwnedProductById(productId, sellerId) {
      const product = products.find((entry) => (
        entry.id === Number(productId) && entry.sellerId === Number(sellerId)
      ));

      return product ? toRepositoryProduct(product) : null;
    },

    async findProductSnapshotById(productId) {
      const product = findProductRecord(productId);

      return product ? toRepositoryProduct(product) : null;
    },

    async findProductById(productId) {
      const product = products.find((entry) => entry.id === Number(productId) && entry.status === 'active');

      return product ? toRepositoryProduct(product) : null;
    },

    async findProductCompatibilityByProductId(productId) {
      const product = findProductRecord(productId);

      return product ? clone(product.compatibility) : [];
    },

    async findProductImagesByProductId(productId) {
      const product = findProductRecord(productId);

      return product ? clone(product.images) : [];
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
    },

    async listSellerProducts(filters) {
      const matchedProducts = products
        .filter((product) => {
          if (product.sellerId !== Number(filters.sellerId)) {
            return false;
          }

          if (filters.status && filters.status !== 'all' && product.status !== filters.status) {
            return false;
          }

          if (filters.lowStockOnly && product.stockQty > Number(filters.lowStockThreshold)) {
            return false;
          }

          return true;
        })
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));

      return {
        products: matchedProducts
          .slice(filters.offset, filters.offset + filters.limit)
          .map(toRepositoryProduct),
        total: matchedProducts.length
      };
    },

    async summarizeSellerInventory(filters) {
      const sellerProducts = products.filter((product) => product.sellerId === Number(filters.sellerId));

      return {
        totalListings: sellerProducts.length,
        activeListings: sellerProducts.filter((product) => product.status === 'active').length,
        inactiveListings: sellerProducts.filter((product) => product.status === 'inactive').length,
        outOfStockListings: sellerProducts.filter((product) => product.stockQty === 0).length,
        lowStockListings: sellerProducts.filter((product) => (
          product.stockQty > 0 && product.stockQty <= Number(filters.lowStockThreshold)
        )).length,
        totalUnitsInStock: sellerProducts.reduce((sum, product) => sum + Number(product.stockQty), 0)
      };
    },

    async decrementStockLevels(entries) {
      for (const entry of entries) {
        const product = products.find((item) => item.id === Number(entry.productId));

        if (!product) {
          continue;
        }

        product.stockQty = Math.max(0, product.stockQty - Number(entry.quantity));
        product.updatedAt = new Date().toISOString();
      }
    },

    async updateOwnedProduct(productId, sellerId, payload) {
      const product = products.find((entry) => (
        entry.id === Number(productId) && entry.sellerId === Number(sellerId)
      ));

      if (!product) {
        return null;
      }

      for (const field of payload.fields || []) {
        applyField(product, field);
      }

      if (payload.photos) {
        product.images = payload.photos.map((photo) => ({
          id: counters.imageId++,
          productId: product.id,
          url: photo.filePath,
          position: photo.position
        }));
      }

      if (payload.compatibility) {
        product.compatibility = payload.compatibility.map((entry) => ({
          id: counters.compatibilityId++,
          productId: product.id,
          make: entry.make,
          model: entry.model,
          yearFrom: entry.yearFrom,
          yearTo: entry.yearTo
        }));
      }

      product.updatedAt = new Date().toISOString();

      return toRepositoryProduct(product);
    }
  };
}

module.exports = {
  createInMemoryProductsRepository
};
