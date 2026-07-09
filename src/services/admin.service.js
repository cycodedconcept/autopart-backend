const {
  ERROR_CODES,
  SELLER_DOCUMENT_TYPES,
  SELLER_VERIFICATION_STATUSES,
  TOKEN_SUBJECT_TYPES
} = require('../config/constants');
const { sanitizeAdmin } = require('../utils/admin');
const AppError = require('../utils/app-error');
const { buildPagination, normalizePagination } = require('../utils/pagination');
const { sanitizeSellerAccount } = require('../utils/seller');
const { sanitizeUser } = require('../utils/user');

function normalizeEmail(email) {
  return email ? email.trim().toLowerCase() : null;
}

function normalizeVerificationQueueStatus(status) {
  return status || SELLER_VERIFICATION_STATUSES.PENDING;
}

function resolveRejectionReason(status, rejectionReason) {
  if (status !== SELLER_VERIFICATION_STATUSES.REJECTED) {
    return null;
  }

  return rejectionReason.trim();
}

function sellerHasRequiredDocuments(sellerAccount) {
  const documentTypes = new Set(
    (sellerAccount.sellerProfile.documents || []).map((document) => document.type)
  );

  return (
    documentTypes.has(SELLER_DOCUMENT_TYPES.CAC)
    && documentTypes.has(SELLER_DOCUMENT_TYPES.PROOF_OF_ADDRESS)
  );
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function buildCategoriesByParentId(categories) {
  return categories.reduce((accumulator, category) => {
    const key = category.parentId === null ? 'root' : String(category.parentId);
    const existingChildren = accumulator.get(key) || [];

    existingChildren.push(category);
    accumulator.set(key, existingChildren);

    return accumulator;
  }, new Map());
}

function buildCategoryTreeNode(category, categoriesByParentId) {
  const childCategories = categoriesByParentId.get(String(category.id)) || [];

  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    parentId: category.parentId,
    children: childCategories.map((childCategory) => buildCategoryTreeNode(
      childCategory,
      categoriesByParentId
    )),
    createdAt: category.createdAt,
    updatedAt: category.updatedAt
  };
}

function buildCategoryTree(categories) {
  const categoriesByParentId = buildCategoriesByParentId(categories);
  const rootCategories = categoriesByParentId.get('root') || [];

  return rootCategories.map((category) => buildCategoryTreeNode(category, categoriesByParentId));
}

function mapCategorySummary(category) {
  if (!category) {
    return null;
  }

  return {
    id: category.id,
    name: category.name,
    slug: category.slug
  };
}

function buildCategoryDetail(category, categories) {
  const categoriesByParentId = buildCategoriesByParentId(categories);
  const categoriesById = new Map(categories.map((entry) => [entry.id, entry]));

  return {
    ...buildCategoryTreeNode(category, categoriesByParentId),
    parent: mapCategorySummary(categoriesById.get(category.parentId) || null)
  };
}

function normalizeCategoryName(name) {
  return String(name || '').trim();
}

function normalizeCategorySlug(name, slug) {
  const normalizedSlug = slugify(slug !== undefined ? slug : name);

  if (!normalizedSlug) {
    throw new AppError('Category slug could not be generated from the provided value.', {
      statusCode: 422,
      code: ERROR_CODES.VALIDATION_ERROR
    });
  }

  return normalizedSlug;
}

function ensureValidVehicleYearRange(yearFrom, yearTo) {
  if (yearFrom > yearTo) {
    throw new AppError('Vehicle taxonomy yearFrom must be less than or equal to yearTo.', {
      statusCode: 422,
      code: ERROR_CODES.VALIDATION_ERROR
    });
  }
}

function formatVehicleTaxonomyLabel(entry) {
  return `${entry.make} ${entry.model} ${entry.yearFrom}-${entry.yearTo}`;
}

function normalizeVehicleField(value) {
  return String(value || '').trim();
}

function categoryCreatesCycle(categoryId, parentId, categories) {
  if (parentId === null || parentId === undefined) {
    return false;
  }

  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const visitedIds = new Set();
  let currentParentId = parentId;

  while (currentParentId !== null && currentParentId !== undefined) {
    if (currentParentId === categoryId) {
      return true;
    }

    if (visitedIds.has(currentParentId)) {
      return false;
    }

    visitedIds.add(currentParentId);
    const currentParent = categoriesById.get(currentParentId);

    currentParentId = currentParent ? currentParent.parentId : null;
  }

  return false;
}

function createAdminService({ adminRepository, jwtUtils, passwordUtils, productsRepository }) {
  async function getAuthenticatedAdmin(token) {
    let decodedToken;

    try {
      decodedToken = jwtUtils.verifyAccessToken(token);
    } catch (_error) {
      throw new AppError('Invalid or expired access token.', {
        statusCode: 401,
        code: ERROR_CODES.UNAUTHORIZED
      });
    }

    if (decodedToken.actorType !== TOKEN_SUBJECT_TYPES.ADMIN) {
      throw new AppError('Invalid or expired access token.', {
        statusCode: 401,
        code: ERROR_CODES.UNAUTHORIZED
      });
    }

    const admin = await adminRepository.findAdminById(decodedToken.sub);

    if (!admin || !admin.isActive) {
      throw new AppError('Authenticated admin was not found.', {
        statusCode: 401,
        code: ERROR_CODES.UNAUTHORIZED
      });
    }

    return sanitizeAdmin(admin);
  }

  async function login(payload) {
    const email = normalizeEmail(payload.email);
    const admin = await adminRepository.findAdminByEmail(email);

    if (!admin) {
      throw new AppError('Invalid email or password.', {
        statusCode: 401,
        code: ERROR_CODES.INVALID_CREDENTIALS
      });
    }

    const isPasswordValid = await passwordUtils.comparePassword(payload.password, admin.passwordHash);

    if (!isPasswordValid) {
      throw new AppError('Invalid email or password.', {
        statusCode: 401,
        code: ERROR_CODES.INVALID_CREDENTIALS
      });
    }

    if (!admin.isActive) {
      throw new AppError('This admin account is inactive.', {
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN
      });
    }

    const token = jwtUtils.signAccessToken({
      sub: admin.id,
      actorType: TOKEN_SUBJECT_TYPES.ADMIN
    });

    return {
      token,
      admin: sanitizeAdmin(admin)
    };
  }

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

  async function ensureVehicleTaxonomyExists(vehicleTaxonomyId) {
    const vehicleTaxonomy = await productsRepository.findVehicleTaxonomyById(vehicleTaxonomyId);

    if (!vehicleTaxonomy) {
      throw new AppError('Vehicle taxonomy entry was not found.', {
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND
      });
    }

    return vehicleTaxonomy;
  }

  return {
    getAuthenticatedAdmin,

    async createCategory(payload) {
      const name = normalizeCategoryName(payload.name);
      const slug = normalizeCategorySlug(name, payload.slug);
      const parentId = payload.parentId === undefined ? null : payload.parentId;

      if (parentId !== null) {
        await ensureCategoryExists(parentId);
      }

      const existingCategoryWithSlug = await productsRepository.findCategoryBySlug(slug);

      if (existingCategoryWithSlug) {
        throw new AppError('A category with this slug already exists.', {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT
        });
      }

      const category = await productsRepository.createCategory({
        name,
        slug,
        parentId
      });
      const categories = await productsRepository.listAllCategories();

      return buildCategoryDetail(category, categories);
    },

    async createVehicleTaxonomyEntry(payload) {
      const entry = {
        make: normalizeVehicleField(payload.make),
        model: normalizeVehicleField(payload.model),
        yearFrom: payload.yearFrom,
        yearTo: payload.yearTo
      };

      ensureValidVehicleYearRange(entry.yearFrom, entry.yearTo);

      const existingEntry = await productsRepository.findVehicleTaxonomyEntry(entry);

      if (existingEntry) {
        throw new AppError('This vehicle taxonomy entry already exists.', {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT
        });
      }

      return productsRepository.createVehicleTaxonomy(entry);
    },

    async deleteCategory(payload) {
      const category = await ensureCategoryExists(payload.categoryId);
      const [childCount, productCount, categories] = await Promise.all([
        productsRepository.countChildCategories(payload.categoryId),
        productsRepository.countProductsByCategoryId(payload.categoryId),
        productsRepository.listAllCategories()
      ]);

      if (childCount > 0) {
        throw new AppError('Categories with child categories cannot be deleted.', {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT
        });
      }

      if (productCount > 0) {
        throw new AppError('Categories assigned to existing products cannot be deleted.', {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT
        });
      }

      await productsRepository.deleteCategory(payload.categoryId);

      return buildCategoryDetail(category, categories);
    },

    async deleteVehicleTaxonomyEntry(payload) {
      const existingEntry = await ensureVehicleTaxonomyExists(payload.vehicleTaxonomyId);
      const productCompatibilityCount = await productsRepository.countProductCompatibilityReferences({
        make: existingEntry.make,
        model: existingEntry.model,
        yearFrom: existingEntry.yearFrom,
        yearTo: existingEntry.yearTo
      });

      if (productCompatibilityCount > 0) {
        throw new AppError('Vehicle taxonomy entries used by product compatibility records cannot be deleted.', {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT
        });
      }

      await productsRepository.deleteVehicleTaxonomy(payload.vehicleTaxonomyId);

      return existingEntry;
    },

    async getCategory(payload) {
      const category = await ensureCategoryExists(payload.categoryId);
      const categories = await productsRepository.listAllCategories();

      return buildCategoryDetail(category, categories);
    },

    async getSellerVerificationCandidate(payload) {
      const sellerAccount = await adminRepository.findSellerAccountBySellerId(payload.sellerId);

      if (!sellerAccount) {
        throw new AppError('Seller profile was not found.', {
          statusCode: 404,
          code: ERROR_CODES.NOT_FOUND
        });
      }

      return sanitizeSellerAccount(sellerAccount, sanitizeUser);
    },

    async getVehicleTaxonomyEntry(payload) {
      return ensureVehicleTaxonomyExists(payload.vehicleTaxonomyId);
    },

    async listCategories() {
      const categories = await productsRepository.listAllCategories();

      return {
        categories: buildCategoryTree(categories)
      };
    },

    async listSellerVerificationQueue(payload) {
      const pagination = normalizePagination(payload.query, {
        defaultLimit: 10,
        maxLimit: 50
      });
      const status = normalizeVerificationQueueStatus(payload.query.status);
      const result = await adminRepository.listSellerVerificationQueue({
        status,
        limit: pagination.limit,
        offset: pagination.offset
      });

      return {
        sellers: result.sellers.map((sellerAccount) => sanitizeSellerAccount(
          sellerAccount,
          sanitizeUser
        )),
        pagination: buildPagination({
          page: pagination.page,
          limit: pagination.limit,
          total: result.total
        }),
        filters: {
          status
        }
      };
    },

    async listVehicleTaxonomy(payload) {
      const pagination = normalizePagination(payload.query, {
        defaultLimit: 10,
        maxLimit: 50
      });
      const filters = {
        make: payload.query.make || null,
        model: payload.query.model || null,
        limit: pagination.limit,
        offset: pagination.offset
      };
      const result = await productsRepository.listVehicleTaxonomy(filters);

      return {
        entries: result.entries,
        pagination: buildPagination({
          page: pagination.page,
          limit: pagination.limit,
          total: result.total
        }),
        filters: {
          make: filters.make,
          model: filters.model
        }
      };
    },

    login,

    async updateCategory(payload) {
      const existingCategory = await ensureCategoryExists(payload.categoryId);
      const categories = await productsRepository.listAllCategories();
      const name = payload.name !== undefined
        ? normalizeCategoryName(payload.name)
        : existingCategory.name;
      const slug = payload.slug !== undefined
        ? normalizeCategorySlug(name, payload.slug)
        : existingCategory.slug;
      const parentId = payload.parentId !== undefined
        ? payload.parentId
        : existingCategory.parentId;

      if (parentId !== null) {
        await ensureCategoryExists(parentId);
      }

      if (categoryCreatesCycle(payload.categoryId, parentId, categories)) {
        throw new AppError('Categories cannot be nested under themselves or their descendants.', {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT
        });
      }

      const existingCategoryWithSlug = await productsRepository.findCategoryBySlug(slug);

      if (existingCategoryWithSlug && existingCategoryWithSlug.id !== payload.categoryId) {
        throw new AppError('A category with this slug already exists.', {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT
        });
      }

      const updatedCategory = await productsRepository.updateCategory(payload.categoryId, {
        name: payload.name !== undefined ? name : undefined,
        slug: payload.slug !== undefined ? slug : undefined,
        parentId: payload.parentId !== undefined ? parentId : undefined
      });
      const updatedCategories = await productsRepository.listAllCategories();

      return buildCategoryDetail(updatedCategory, updatedCategories);
    },

    async updateSellerVerificationStatus(payload) {
      const sellerAccount = await adminRepository.findSellerAccountBySellerId(payload.sellerId);

      if (!sellerAccount) {
        throw new AppError('Seller profile was not found.', {
          statusCode: 404,
          code: ERROR_CODES.NOT_FOUND
        });
      }

      if (!sellerHasRequiredDocuments(sellerAccount)) {
        throw new AppError('Seller verification requires both CAC and proof of address documents.', {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT
        });
      }

      if (sellerAccount.sellerProfile.verificationStatus === payload.verificationStatus) {
        throw new AppError('Seller already has this verification status.', {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT
        });
      }

      const updatedSellerAccount = await adminRepository.updateSellerVerificationStatus({
        adminId: payload.adminId,
        sellerId: payload.sellerId,
        status: payload.verificationStatus,
        rejectionReason: resolveRejectionReason(
          payload.verificationStatus,
          payload.rejectionReason || ''
        )
      });

      return sanitizeSellerAccount(updatedSellerAccount, sanitizeUser);
    },

    async updateVehicleTaxonomyEntry(payload) {
      const existingEntry = await ensureVehicleTaxonomyExists(payload.vehicleTaxonomyId);
      const updatedEntry = {
        make: payload.make !== undefined ? normalizeVehicleField(payload.make) : existingEntry.make,
        model: payload.model !== undefined ? normalizeVehicleField(payload.model) : existingEntry.model,
        yearFrom: payload.yearFrom !== undefined ? payload.yearFrom : existingEntry.yearFrom,
        yearTo: payload.yearTo !== undefined ? payload.yearTo : existingEntry.yearTo
      };

      ensureValidVehicleYearRange(updatedEntry.yearFrom, updatedEntry.yearTo);

      const signatureChanged = (
        updatedEntry.make !== existingEntry.make
        || updatedEntry.model !== existingEntry.model
        || updatedEntry.yearFrom !== existingEntry.yearFrom
        || updatedEntry.yearTo !== existingEntry.yearTo
      );

      if (signatureChanged) {
        const productCompatibilityCount = await productsRepository.countProductCompatibilityReferences({
          make: existingEntry.make,
          model: existingEntry.model,
          yearFrom: existingEntry.yearFrom,
          yearTo: existingEntry.yearTo
        });

        if (productCompatibilityCount > 0) {
          throw new AppError(
            `Vehicle taxonomy entry ${formatVehicleTaxonomyLabel(existingEntry)} is already used by product compatibility records.`,
            {
              statusCode: 409,
              code: ERROR_CODES.CONFLICT
            }
          );
        }
      }

      const duplicateEntry = await productsRepository.findVehicleTaxonomyEntry(updatedEntry);

      if (duplicateEntry && duplicateEntry.id !== payload.vehicleTaxonomyId) {
        throw new AppError('This vehicle taxonomy entry already exists.', {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT
        });
      }

      return productsRepository.updateVehicleTaxonomy(payload.vehicleTaxonomyId, {
        make: payload.make !== undefined ? updatedEntry.make : undefined,
        model: payload.model !== undefined ? updatedEntry.model : undefined,
        yearFrom: payload.yearFrom !== undefined ? updatedEntry.yearFrom : undefined,
        yearTo: payload.yearTo !== undefined ? updatedEntry.yearTo : undefined
      });
    }
  };
}

module.exports = {
  createAdminService
};
