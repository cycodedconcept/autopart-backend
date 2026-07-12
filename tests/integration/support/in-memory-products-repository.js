const { createCatalogueFixture } = require('./catalogue-fixture');
const { createCategoriesFixture } = require('./categories-fixture');
const { createVehicleTaxonomyFixture } = require('./vehicle-taxonomy-fixture');

function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
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
  const now = '2026-07-09T09:00:00.000Z';
  const categories = createCategoriesFixture().map((category) => ({
    ...category,
    createdAt: now,
    updatedAt: now
  }));
  const vehicleTaxonomyEntries = createVehicleTaxonomyFixture().map((entry) => ({
    ...entry,
    createdAt: now,
    updatedAt: now
  }));
  const counters = {
    categoryId: Math.max(...categories.map((category) => category.id)) + 1,
    compatibilityId: Math.max(
      ...products.flatMap((product) => product.compatibility.map((entry) => entry.id))
    ) + 1,
    imageId: Math.max(...products.flatMap((product) => product.images.map((image) => image.id))) + 1,
    productId: Math.max(...products.map((product) => product.id)) + 1,
    vehicleTaxonomyId: Math.max(...vehicleTaxonomyEntries.map((entry) => entry.id)) + 1
  };

  function findCategoryRecord(categoryId) {
    return categories.find((entry) => entry.id === Number(categoryId)) || null;
  }

  function findProductRecord(productId) {
    return products.find((entry) => entry.id === Number(productId)) || null;
  }

  function findVehicleTaxonomyRecord(vehicleTaxonomyId) {
    return vehicleTaxonomyEntries.find((entry) => entry.id === Number(vehicleTaxonomyId)) || null;
  }

  function syncCategoryMetadataForProducts(category) {
    for (const product of products) {
      if (product.categoryId === category.id) {
        product.categoryName = category.name;
        product.categorySlug = category.slug;
        product.updatedAt = new Date().toISOString();
      }
    }
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
        const category = findCategoryRecord(field.value);

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

  for (const category of categories) {
    syncCategoryMetadataForProducts(category);
  }

  return {
    async countChildCategories(categoryId) {
      return categories.filter((category) => category.parentId === Number(categoryId)).length;
    },

    async countProductCompatibilityReferences(payload) {
      return products.reduce((total, product) => total + product.compatibility.filter((entry) => (
        entry.make === payload.make
        && entry.model === payload.model
        && entry.yearFrom === Number(payload.yearFrom)
        && entry.yearTo === Number(payload.yearTo)
      )).length, 0);
    },

    async countProductsByCategoryId(categoryId) {
      return products.filter((product) => product.categoryId === Number(categoryId)).length;
    },

    async createCategory(payload) {
      const createdCategory = {
        id: counters.categoryId,
        name: payload.name,
        slug: payload.slug,
        parentId: payload.parentId === undefined ? null : payload.parentId,
        status: payload.status || 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      categories.push(createdCategory);
      counters.categoryId += 1;

      return clone(createdCategory);
    },

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
      const nowTimestamp = new Date().toISOString();
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
        createdAt: nowTimestamp,
        updatedAt: nowTimestamp,
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

    async createVehicleTaxonomy(payload) {
      const createdEntry = {
        id: counters.vehicleTaxonomyId,
        make: payload.make,
        model: payload.model,
        yearFrom: payload.yearFrom,
        yearTo: payload.yearTo,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      vehicleTaxonomyEntries.push(createdEntry);
      counters.vehicleTaxonomyId += 1;

      return clone(createdEntry);
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

    async deleteVehicleTaxonomy(vehicleTaxonomyId) {
      const entry = findVehicleTaxonomyRecord(vehicleTaxonomyId);

      if (!entry) {
        return null;
      }

      const index = vehicleTaxonomyEntries.findIndex((item) => item.id === Number(vehicleTaxonomyId));

      vehicleTaxonomyEntries.splice(index, 1);

      return clone(entry);
    },

    async findCategoriesByIds(categoryIds) {
      return clone(
        categories.filter((entry) => categoryIds.map(Number).includes(entry.id))
      );
    },

    async findCategoryById(categoryId) {
      return clone(findCategoryRecord(categoryId));
    },

    async findCategoryBySlug(slug) {
      return clone(categories.find((entry) => entry.slug === slug) || null);
    },

    async findOwnedProductById(productId, sellerId) {
      const product = products.find((entry) => (
        entry.id === Number(productId) && entry.sellerId === Number(sellerId)
      ));

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

    async findProductSnapshotById(productId) {
      const product = findProductRecord(productId);

      return product ? toRepositoryProduct(product) : null;
    },

    async findVehicleTaxonomyById(vehicleTaxonomyId) {
      return clone(findVehicleTaxonomyRecord(vehicleTaxonomyId));
    },

    async findVehicleTaxonomyEntry(payload) {
      return clone(vehicleTaxonomyEntries.find((entry) => (
        entry.make === payload.make
        && entry.model === payload.model
        && entry.yearFrom === Number(payload.yearFrom)
        && entry.yearTo === Number(payload.yearTo)
      )) || null);
    },

    async listAllCategories(filters = {}) {
      const matchedCategories = categories.filter((category) => (
        !filters.status || filters.status === 'all' || category.status === filters.status
      ));

      return clone(
        [...matchedCategories].sort((left, right) => {
          if (left.parentId === right.parentId) {
            return left.name.localeCompare(right.name);
          }

          if (left.parentId === null) {
            return -1;
          }

          if (right.parentId === null) {
            return 1;
          }

          return left.parentId - right.parentId;
        })
      );
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

    async listVehicleTaxonomy(filters) {
      const matchedEntries = vehicleTaxonomyEntries
        .filter((entry) => {
          if (filters.make && entry.make.toLowerCase() !== String(filters.make).toLowerCase()) {
            return false;
          }

          if (filters.model && entry.model.toLowerCase() !== String(filters.model).toLowerCase()) {
            return false;
          }

          return true;
        })
        .sort((left, right) => {
          if (left.make !== right.make) {
            return left.make.localeCompare(right.make);
          }

          if (left.model !== right.model) {
            return left.model.localeCompare(right.model);
          }

          if (left.yearFrom !== right.yearFrom) {
            return left.yearFrom - right.yearFrom;
          }

          return left.yearTo - right.yearTo;
        });

      return {
        entries: clone(matchedEntries.slice(filters.offset, filters.offset + filters.limit)),
        total: matchedEntries.length
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

    async summarizeSellerListingTrend(filters) {
      const sellerProducts = products.filter((product) => product.sellerId === Number(filters.sellerId));
      const currentFromTime = Date.parse(`${filters.currentDateFrom}T00:00:00.000Z`);
      const currentToTime = Date.parse(`${filters.currentDateTo}T23:59:59.999Z`);
      const previousFromTime = Date.parse(`${filters.previousDateFrom}T00:00:00.000Z`);
      const previousToTime = Date.parse(`${filters.previousDateTo}T23:59:59.999Z`);

      return {
        currentPeriodListings: sellerProducts.filter((product) => {
          const createdAtTime = Date.parse(product.createdAt);

          return createdAtTime >= currentFromTime && createdAtTime <= currentToTime;
        }).length,
        previousPeriodListings: sellerProducts.filter((product) => {
          const createdAtTime = Date.parse(product.createdAt);

          return createdAtTime >= previousFromTime && createdAtTime <= previousToTime;
        }).length
      };
    },

    async updateCategory(categoryId, payload) {
      const category = findCategoryRecord(categoryId);

      if (!category) {
        return null;
      }

      if (payload.name !== undefined) {
        category.name = payload.name;
      }

      if (payload.slug !== undefined) {
        category.slug = payload.slug;
      }

      if (payload.parentId !== undefined) {
        category.parentId = payload.parentId;
      }

      if (payload.status !== undefined) {
        category.status = payload.status;
      }

      category.updatedAt = new Date().toISOString();
      syncCategoryMetadataForProducts(category);

      return clone(category);
    },

    async updateCategoriesStatus(categoryIds, status) {
      const normalizedIds = categoryIds.map(Number);
      const updatedCategories = [];

      for (const category of categories) {
        if (!normalizedIds.includes(category.id)) {
          continue;
        }

        category.status = status;
        category.updatedAt = new Date().toISOString();
        updatedCategories.push(clone(category));
      }

      return updatedCategories;
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
    },

    async updateVehicleTaxonomy(vehicleTaxonomyId, payload) {
      const entry = findVehicleTaxonomyRecord(vehicleTaxonomyId);

      if (!entry) {
        return null;
      }

      if (payload.make !== undefined) {
        entry.make = payload.make;
      }

      if (payload.model !== undefined) {
        entry.model = payload.model;
      }

      if (payload.yearFrom !== undefined) {
        entry.yearFrom = payload.yearFrom;
      }

      if (payload.yearTo !== undefined) {
        entry.yearTo = payload.yearTo;
      }

      entry.updatedAt = new Date().toISOString();

      return clone(entry);
    }
  };
}

module.exports = {
  createInMemoryProductsRepository
};
