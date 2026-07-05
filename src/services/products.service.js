const { ERROR_CODES, PRODUCT_STATUSES } = require('../config/constants');
const AppError = require('../utils/app-error');
const { parseCsvText } = require('../utils/csv');
const { buildPagination, normalizePagination } = require('../utils/pagination');
const { sellerInventoryCsvRowSchema } = require('../validators/seller-inventory.validator');

const LOW_STOCK_THRESHOLD = 5;

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

function mapSeller(product) {
  return {
    id: product.sellerId,
    businessName: product.sellerBusinessName,
    rating: product.sellerRating
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
    seller: mapSeller(product),
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
    seller: mapSeller(product),
    primaryImageUrl: product.primaryImageUrl,
    photos: images.map(mapImage),
    compatibility: compatibility.map(mapCompatibility)
  };
}

function mapSellerProductSummary(product) {
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
    status: product.status,
    primaryImageUrl: product.primaryImageUrl,
    seller: mapSeller(product),
    createdAt: product.createdAt,
    updatedAt: product.updatedAt
  };
}

function mapSellerProductDetail(product, images, compatibility) {
  return {
    ...mapProductDetail(product, images, compatibility),
    status: product.status,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt
  };
}

function mapSellerInventoryItem(product, threshold) {
  return {
    ...mapSellerProductSummary(product),
    lowStockThreshold: threshold,
    isLowStock: product.stockQty > 0 && product.stockQty <= threshold,
    isOutOfStock: product.stockQty === 0
  };
}

function normalizeCompatibilityEntries(entries = []) {
  return entries.map((entry) => ({
    make: entry.make.trim(),
    model: entry.model.trim(),
    yearFrom: entry.yearFrom,
    yearTo: entry.yearTo
  }));
}

function normalizeInventoryImageEntries(imageUrlsValue) {
  return String(imageUrlsValue || '')
    .split('|')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((filePath, index) => ({
      filePath,
      position: index + 1
    }));
}

function normalizeInventoryCsvRow(row) {
  return {
    title: row.title,
    description: row.description,
    categoryId: row.categoryId === '' ? undefined : Number(row.categoryId),
    partNumber: row.partNumber,
    condition: row.condition,
    priceKobo: row.priceKobo === '' ? undefined : Number(row.priceKobo),
    stockQty: row.stockQty === '' ? undefined : Number(row.stockQty),
    location: row.location,
    status: row.status || PRODUCT_STATUSES.ACTIVE,
    compatibleMake: row.compatibleMake,
    compatibleModel: row.compatibleModel,
    compatibleYearFrom: row.compatibleYearFrom === '' ? undefined : Number(row.compatibleYearFrom),
    compatibleYearTo: row.compatibleYearTo === '' ? undefined : Number(row.compatibleYearTo),
    imageUrls: row.imageUrls
  };
}

function buildSellerProductFields(payload) {
  const fields = [];

  if (payload.title !== undefined) {
    fields.push({ column: 'title', value: payload.title.trim() });
  }

  if (payload.description !== undefined) {
    fields.push({ column: 'description', value: payload.description.trim() });
  }

  if (payload.categoryId !== undefined) {
    fields.push({ column: 'category_id', value: payload.categoryId });
  }

  if (payload.partNumber !== undefined) {
    fields.push({ column: 'part_number', value: payload.partNumber.trim() });
  }

  if (payload.condition !== undefined) {
    fields.push({ column: '`condition`', value: payload.condition });
  }

  if (payload.priceKobo !== undefined) {
    fields.push({ column: 'price_kobo', value: payload.priceKobo });
  }

  if (payload.stockQty !== undefined) {
    fields.push({ column: 'stock_qty', value: payload.stockQty });
  }

  if (payload.location !== undefined) {
    fields.push({ column: 'location', value: payload.location.trim() });
  }

  if (payload.status !== undefined) {
    fields.push({ column: 'status', value: payload.status });
  }

  return fields;
}

function createProductsService({ productsRepository, sellersRepository }) {
  async function ensureCategoryExists(categoryId) {
    const category = await productsRepository.findCategoryById(categoryId);

    if (!category) {
      throw new AppError('Category was not found.', {
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND
      });
    }

    return category;
  }

  async function ensureSellerProfile(userId) {
    if (!sellersRepository) {
      throw new AppError('Seller product operations are unavailable.', {
        statusCode: 500,
        code: ERROR_CODES.INTERNAL_SERVER_ERROR
      });
    }

    const sellerAccount = await sellersRepository.findByUserId(userId);

    if (!sellerAccount) {
      throw new AppError('Seller profile was not found.', {
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND
      });
    }

    return sellerAccount;
  }

  async function buildSellerProductDetail(product) {
    const [images, compatibility] = await Promise.all([
      productsRepository.findProductImagesByProductId(product.id),
      productsRepository.findProductCompatibilityByProductId(product.id)
    ]);

    return mapSellerProductDetail(product, images, compatibility);
  }

  async function resolveCategoriesForBulkRows(rows) {
    const categoryIds = [...new Set(rows.map((row) => row.categoryId))];
    const categories = productsRepository.findCategoriesByIds
      ? await productsRepository.findCategoriesByIds(categoryIds)
      : await Promise.all(categoryIds.map((categoryId) => ensureCategoryExists(categoryId)));

    const categoriesById = new Map(categories.map((category) => [category.id, category]));

    for (const categoryId of categoryIds) {
      if (!categoriesById.has(categoryId)) {
        throw new AppError(`Category ${categoryId} was not found for the inventory csv upload.`, {
          statusCode: 404,
          code: ERROR_CODES.NOT_FOUND
        });
      }
    }

    return categoriesById;
  }

  function parseInventoryCsvRows(csvUpload) {
    if (!csvUpload || !csvUpload.buffer) {
      throw new AppError('A csv file is required for inventory bulk upload.', {
        statusCode: 422,
        code: ERROR_CODES.VALIDATION_ERROR
      });
    }

    let parsedRows;

    try {
      parsedRows = parseCsvText(csvUpload.buffer.toString('utf8'));
    } catch (error) {
      throw new AppError(error.message || 'Inventory csv could not be parsed.', {
        statusCode: 422,
        code: ERROR_CODES.VALIDATION_ERROR
      });
    }

    if (!parsedRows.length) {
      throw new AppError('Inventory csv must contain at least one data row.', {
        statusCode: 422,
        code: ERROR_CODES.VALIDATION_ERROR
      });
    }

    return parsedRows.map((row, index) => {
      const normalizedRow = normalizeInventoryCsvRow(row);
      const { error, value } = sellerInventoryCsvRowSchema.validate(normalizedRow, {
        abortEarly: false,
        convert: true,
        stripUnknown: true
      });

      if (error) {
        throw new AppError(
          `CSV row ${index + 2}: ${error.details.map((detail) => detail.message).join(', ')}`,
          {
            statusCode: 422,
            code: ERROR_CODES.VALIDATION_ERROR
          }
        );
      }

      const photos = normalizeInventoryImageEntries(value.imageUrls);

      if (!photos.length) {
        throw new AppError(`CSV row ${index + 2}: at least one image URL is required.`, {
          statusCode: 422,
          code: ERROR_CODES.VALIDATION_ERROR
        });
      }

      if (photos.length > 6) {
        throw new AppError(`CSV row ${index + 2}: no more than 6 image URLs are allowed.`, {
          statusCode: 422,
          code: ERROR_CODES.VALIDATION_ERROR
        });
      }

      return {
        ...value,
        photos,
        compatibility: [
          {
            make: value.compatibleMake,
            model: value.compatibleModel,
            yearFrom: value.compatibleYearFrom,
            yearTo: value.compatibleYearTo
          }
        ]
      };
    });
  }

  async function createSellerProduct(payload) {
    const sellerAccount = await ensureSellerProfile(payload.userId);

    if (!payload.photos || !payload.photos.length) {
      throw new AppError('At least one product photo is required.', {
        statusCode: 422,
        code: ERROR_CODES.VALIDATION_ERROR
      });
    }

    if (!payload.compatibility || !payload.compatibility.length) {
      throw new AppError('At least one compatibility entry is required.', {
        statusCode: 422,
        code: ERROR_CODES.VALIDATION_ERROR
      });
    }

    const category = await ensureCategoryExists(payload.categoryId);

    const product = await productsRepository.createSellerProduct({
      sellerId: sellerAccount.sellerProfile.id,
      sellerBusinessName: sellerAccount.sellerProfile.businessName,
      sellerRating: sellerAccount.sellerProfile.rating || 0,
      title: payload.title.trim(),
      description: payload.description.trim(),
      categoryId: payload.categoryId,
      categoryName: category.name,
      categorySlug: category.slug,
      partNumber: payload.partNumber.trim(),
      condition: payload.condition,
      priceKobo: payload.priceKobo,
      stockQty: payload.stockQty,
      location: payload.location.trim(),
      status: payload.status || PRODUCT_STATUSES.ACTIVE,
      photos: payload.photos,
      compatibility: normalizeCompatibilityEntries(payload.compatibility)
    });

    return buildSellerProductDetail(product);
  }

  async function deleteSellerProduct(payload) {
    const sellerAccount = await ensureSellerProfile(payload.userId);
    const existingProduct = await productsRepository.findOwnedProductById(
      payload.productId,
      sellerAccount.sellerProfile.id
    );

    if (!existingProduct) {
      throw new AppError('Seller product was not found.', {
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND
      });
    }

    const product = await productsRepository.deactivateOwnedProduct(
      payload.productId,
      sellerAccount.sellerProfile.id
    );

    return buildSellerProductDetail(product);
  }

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

  async function listSellerProducts(payload) {
    const sellerAccount = await ensureSellerProfile(payload.userId);
    const pagination = normalizePagination(payload.query, {
      defaultLimit: 10,
      maxLimit: 50
    });
    const result = await productsRepository.listSellerProducts({
      sellerId: sellerAccount.sellerProfile.id,
      status: payload.query.status || 'all',
      page: pagination.page,
      limit: pagination.limit,
      offset: pagination.offset
    });

    return {
      products: result.products.map(mapSellerProductSummary),
      pagination: buildPagination({
        page: pagination.page,
        limit: pagination.limit,
        total: result.total
      })
    };
  }

  async function getSellerInventory(payload) {
    const sellerAccount = await ensureSellerProfile(payload.userId);
    const pagination = normalizePagination(payload.query, {
      defaultLimit: 10,
      maxLimit: 50
    });
    const filters = {
      sellerId: sellerAccount.sellerProfile.id,
      status: payload.query.status || 'all',
      lowStockOnly: payload.query.lowStockOnly === true,
      lowStockThreshold: LOW_STOCK_THRESHOLD,
      page: pagination.page,
      limit: pagination.limit,
      offset: pagination.offset
    };
    const [result, summary] = await Promise.all([
      productsRepository.listSellerProducts(filters),
      productsRepository.summarizeSellerInventory({
        sellerId: sellerAccount.sellerProfile.id,
        lowStockThreshold: LOW_STOCK_THRESHOLD
      })
    ]);

    return {
      inventory: result.products.map((product) => mapSellerInventoryItem(product, LOW_STOCK_THRESHOLD)),
      summary: {
        ...summary,
        lowStockThreshold: LOW_STOCK_THRESHOLD
      },
      pagination: buildPagination({
        page: pagination.page,
        limit: pagination.limit,
        total: result.total
      })
    };
  }

  async function bulkUploadSellerInventory(payload) {
    const sellerAccount = await ensureSellerProfile(payload.userId);
    const rows = parseInventoryCsvRows(payload.csvUpload);
    const categoriesById = await resolveCategoriesForBulkRows(rows);
    const products = rows.map((row) => {
      const category = categoriesById.get(row.categoryId);

      return {
        title: row.title.trim(),
        description: row.description.trim(),
        categoryId: row.categoryId,
        categoryName: category.name,
        categorySlug: category.slug,
        partNumber: row.partNumber.trim(),
        condition: row.condition,
        priceKobo: row.priceKobo,
        stockQty: row.stockQty,
        location: row.location.trim(),
        status: row.status || PRODUCT_STATUSES.ACTIVE,
        photos: row.photos,
        compatibility: normalizeCompatibilityEntries(row.compatibility)
      };
    });
    const createdProducts = await productsRepository.createSellerProductsBulk({
      sellerId: sellerAccount.sellerProfile.id,
      sellerBusinessName: sellerAccount.sellerProfile.businessName,
      sellerRating: sellerAccount.sellerProfile.rating || 0,
      products
    });

    return {
      createdCount: createdProducts.length,
      lowStockThreshold: LOW_STOCK_THRESHOLD,
      products: createdProducts.map((product) => mapSellerInventoryItem(product, LOW_STOCK_THRESHOLD))
    };
  }

  async function updateSellerProduct(payload) {
    const sellerAccount = await ensureSellerProfile(payload.userId);
    const existingProduct = await productsRepository.findOwnedProductById(
      payload.productId,
      sellerAccount.sellerProfile.id
    );

    if (!existingProduct) {
      throw new AppError('Seller product was not found.', {
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND
      });
    }

    if (payload.categoryId !== undefined) {
      await ensureCategoryExists(payload.categoryId);
    }

    if (payload.compatibility && !payload.compatibility.length) {
      throw new AppError('Compatibility entries cannot be empty when provided.', {
        statusCode: 422,
        code: ERROR_CODES.VALIDATION_ERROR
      });
    }

    const fields = buildSellerProductFields(payload);
    const shouldReplacePhotos = Array.isArray(payload.photos) && payload.photos.length > 0;
    const shouldReplaceCompatibility = payload.compatibility !== undefined;

    if (!fields.length && !shouldReplacePhotos && !shouldReplaceCompatibility) {
      throw new AppError('At least one product field, photo, or compatibility entry is required.', {
        statusCode: 422,
        code: ERROR_CODES.VALIDATION_ERROR
      });
    }

    const product = await productsRepository.updateOwnedProduct(
      payload.productId,
      sellerAccount.sellerProfile.id,
      {
        fields,
        photos: shouldReplacePhotos ? payload.photos : null,
        compatibility: shouldReplaceCompatibility
          ? normalizeCompatibilityEntries(payload.compatibility)
          : null
      }
    );

    return buildSellerProductDetail(product);
  }

  return {
    bulkUploadSellerInventory,
    createSellerProduct,
    deleteSellerProduct,
    getSellerInventory,
    getProductById,
    listProducts,
    listSellerProducts,
    updateSellerProduct
  };
}

module.exports = {
  createProductsService
};
