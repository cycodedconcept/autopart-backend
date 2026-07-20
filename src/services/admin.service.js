const {
  CATEGORY_STATUSES,
  DISPUTE_RAISED_BY,
  DISPUTE_STATUSES,
  ERROR_CODES,
  LOGISTICS_COMPANY_STATUSES,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  PAYOUT_PAYEE_TYPES,
  PAYOUT_STATUSES,
  SELLER_DOCUMENT_TYPES,
  SELLER_VERIFICATION_STATUSES,
  TOKEN_SUBJECT_TYPES,
  USER_ACCOUNT_STATUSES,
  USER_ROLES
} = require('../config/constants');
const { sanitizeAdmin } = require('../utils/admin');
const AppError = require('../utils/app-error');
const { buildPagination, normalizePagination } = require('../utils/pagination');
const {
  buildPlatformConfig,
  buildPlatformConfigEntries
} = require('../utils/platform-config');
const {
  buildDeliveryJobsByStatus,
  buildDeliveryMetrics,
  buildRiderStatusSummary,
  sanitizeDeliveryZone,
  sanitizeLogisticsCompany,
  sanitizeRider
} = require('../utils/logistics');
const { sanitizeSellerAccount } = require('../utils/seller');
const { sanitizeUser } = require('../utils/user');

function normalizeEmail(email) {
  return email ? email.trim().toLowerCase() : null;
}

function normalizeVerificationQueueStatus(status) {
  return status || SELLER_VERIFICATION_STATUSES.PENDING;
}

function normalizeCategoryListStatus(status) {
  return status || 'all';
}

function normalizeManagedUserRole(role) {
  return role || 'all';
}

function normalizeManagedUserStatus(status) {
  return status || 'all';
}

function normalizeOrderListStatus(status) {
  return status || 'all';
}

function normalizeOrderListPaymentStatus(status) {
  return status || 'all';
}

function normalizePayoutListStatus(status) {
  return status || 'all';
}

function normalizeDisputeListStatus(status) {
  return status || 'all';
}

function normalizeDisputeRaisedBy(raisedBy) {
  return raisedBy || 'all';
}

function normalizeLogisticsCompanyStatus(status) {
  return status || 'all';
}

function normalizeRiderStatus(status) {
  return status || 'all';
}

function normalizeDeliveryJobStatus(status) {
  return status || 'all';
}

function normalizeSearchTerm(search) {
  if (typeof search !== 'string') {
    return null;
  }

  const trimmedSearch = search.trim();

  return trimmedSearch ? trimmedSearch : null;
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
    status: category.status,
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
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const rootCategories = categories.filter((category) => (
    category.parentId === null || !categoriesById.has(category.parentId)
  ));

  return rootCategories.map((category) => buildCategoryTreeNode(category, categoriesByParentId));
}

function mapCategorySummary(category) {
  if (!category) {
    return null;
  }

  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    status: category.status
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

function mapManagedSellerProfile(profile) {
  if (!profile) {
    return null;
  }

  return {
    id: profile.id,
    userId: profile.userId,
    businessName: profile.businessName,
    rating: profile.rating,
    contactPhone: profile.contactPhone,
    contactEmail: profile.contactEmail,
    cacNumber: profile.cacNumber,
    verificationStatus: profile.verificationStatus,
    rejectionReason: profile.rejectionReason,
    verifiedBy: profile.verifiedBy,
    verifiedAt: profile.verifiedAt,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt
  };
}

function mapManagedUser(user, sellerAccount) {
  return {
    ...sanitizeUser(user),
    accountStatus: user.accountStatus || USER_ACCOUNT_STATUSES.ACTIVE,
    sellerProfile: sellerAccount ? mapManagedSellerProfile(sellerAccount.sellerProfile) : null
  };
}

function mapAdminLogisticsCompany(company) {
  return sanitizeLogisticsCompany(company);
}

function mapAdminRider(rider) {
  if (!rider) {
    return null;
  }

  return {
    ...sanitizeRider(rider),
    company: sanitizeLogisticsCompany(rider.company || null)
  };
}

function buildAdminLogisticsCompanySummary(summary) {
  return {
    totalCompaniesCount: Number(summary && summary.totalCompaniesCount) || 0,
    pendingCount: Number(summary && summary.pendingCount) || 0,
    approvedCount: Number(summary && summary.approvedCount) || 0,
    suspendedCount: Number(summary && summary.suspendedCount) || 0
  };
}

function formatDeliveryJobCode(jobId) {
  return `DLV-${String(jobId).padStart(4, '0')}`;
}

function mapAdminDeliveryJob(job, options = {}) {
  if (!job) {
    return null;
  }

  return {
    id: job.id,
    jobCode: formatDeliveryJobCode(job.id),
    orderId: job.orderId,
    orderItemId: job.orderItemId,
    sellerId: job.sellerId,
    zoneId: job.zoneId || null,
    companyId: job.companyId || null,
    riderId: job.riderId || null,
    status: job.status,
    failureReason: job.failureReason || null,
    pickupAddress: job.pickupAddress,
    assignedAt: job.assignedAt,
    pickedUpAt: job.pickedUpAt,
    inTransitAt: job.inTransitAt,
    deliveredAt: job.deliveredAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    zone: sanitizeDeliveryZone(job.zone || null),
    order: job.order,
    item: job.item,
    buyer: job.buyer,
    seller: job.seller,
    assignedCompany: sanitizeLogisticsCompany(job.assignedCompany || null),
    assignedRider: job.assignedRider
      ? {
        ...sanitizeRider(job.assignedRider),
        company: sanitizeLogisticsCompany(job.assignedRider.company || null)
      }
      : null,
    ...(options.statusHistory
      ? {
        statusHistory: options.statusHistory
      }
      : {})
  };
}

function mapAdminOrderStatusHistoryEntry(entry) {
  if (!entry) {
    return null;
  }

  return {
    id: entry.id,
    status: entry.status,
    note: entry.note,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  };
}

function mapAdminOrder(order, statusHistory = null) {
  if (!order) {
    return null;
  }

  return {
    id: order.id,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentReference: order.paymentReference,
    paymentStatus: order.paymentStatus,
    subtotalKobo: order.subtotalKobo,
    deliveryFeeKobo: order.deliveryFeeKobo,
    totalKobo: order.totalKobo,
    totalItems: order.totalItems,
    sellerCount: order.sellerCount,
    buyer: {
      id: order.buyerId,
      fullName: order.buyerFullName,
      email: order.buyerEmail,
      phone: order.buyerPhone
    },
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    ...(statusHistory
      ? {
        statusHistory: statusHistory.map(mapAdminOrderStatusHistoryEntry)
      }
      : {})
  };
}

function mapAdminPayoutItem(item) {
  if (!item) {
    return null;
  }

  return {
    id: item.id,
    payoutId: item.payoutId,
    orderItemId: item.orderItemId,
    deliveryJobId: item.deliveryJobId,
    orderId: item.orderId,
    productId: item.productId,
    quantity: item.quantity,
    grossAmountKobo: item.grossAmountKobo,
    commissionAmountKobo: item.commissionAmountKobo,
    netAmountKobo: item.netAmountKobo,
    orderStatus: item.orderStatus,
    deliveryJobStatus: item.deliveryJobStatus,
    paidAt: item.paidAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

function mapAdminSellerSummary(seller) {
  if (!seller) {
    return null;
  }

  return {
    id: seller.id,
    userId: seller.userId,
    businessName: seller.businessName,
    contactEmail: seller.contactEmail,
    contactPhone: seller.contactPhone,
    fullName: seller.fullName,
    email: seller.email,
    phone: seller.phone
  };
}

function mapAdminPayout(payout) {
  if (!payout) {
    return null;
  }

  return {
    id: payout.id,
    payeeType: payout.payeeType || PAYOUT_PAYEE_TYPES.SELLER,
    grossAmountKobo: payout.grossAmountKobo,
    commissionAmountKobo: payout.commissionAmountKobo,
    amountKobo: payout.amountKobo,
    status: payout.status,
    approvedBy: payout.approvedBy,
    approvedAt: payout.approvedAt,
    rejectionReason: payout.rejectionReason,
    bankAccountRef: payout.bankAccountRef,
    itemCount: payout.itemCount,
    requestedAt: payout.requestedAt,
    settledAt: payout.settledAt,
    createdAt: payout.createdAt,
    updatedAt: payout.updatedAt,
    seller: mapAdminSellerSummary(payout.seller),
    logisticsCompany: sanitizeLogisticsCompany(payout.logisticsCompany || null),
    items: Array.isArray(payout.items) ? payout.items.map(mapAdminPayoutItem) : []
  };
}

function mapAdminDispute(dispute) {
  if (!dispute) {
    return null;
  }

  return {
    id: dispute.id,
    orderId: dispute.orderId,
    raisedBy: dispute.raisedBy,
    reason: dispute.reason,
    status: dispute.status,
    resolutionNote: dispute.resolutionNote,
    refundReference: dispute.refundReference,
    refundAmountKobo: dispute.refundAmountKobo,
    resolvedBy: dispute.resolvedBy,
    resolvedAt: dispute.resolvedAt,
    createdAt: dispute.createdAt,
    updatedAt: dispute.updatedAt,
    order: dispute.order
      ? {
        id: dispute.order.id,
        status: dispute.order.status,
        paymentMethod: dispute.order.paymentMethod,
        paymentReference: dispute.order.paymentReference,
        paymentStatus: dispute.order.paymentStatus,
        totalKobo: dispute.order.totalKobo,
        createdAt: dispute.order.createdAt,
        updatedAt: dispute.order.updatedAt
      }
      : null,
    buyer: dispute.buyer
      ? {
        id: dispute.buyer.id,
        fullName: dispute.buyer.fullName,
        email: dispute.buyer.email,
        phone: dispute.buyer.phone
      }
      : null,
    raisedBySeller: mapAdminSellerSummary(dispute.raisedBySeller),
    resolvedByAdmin: dispute.resolvedByAdmin
      ? {
        id: dispute.resolvedByAdmin.id,
        fullName: dispute.resolvedByAdmin.fullName,
        email: dispute.resolvedByAdmin.email
      }
      : null,
    sellers: Array.isArray(dispute.sellers) ? dispute.sellers.map(mapAdminSellerSummary) : []
  };
}

function mapAdminAuditLog(log) {
  if (!log) {
    return null;
  }

  return {
    id: log.id,
    action: log.action,
    targetType: log.targetType,
    targetId: log.targetId,
    detail: log.detail,
    createdAt: log.createdAt,
    admin: log.admin
      ? {
        id: log.admin.id,
        fullName: log.admin.fullName,
        email: log.admin.email
      }
      : null
  };
}

function orderStatusRequiresPaidPayment(status) {
  return [
    ORDER_STATUSES.CONFIRMED,
    ORDER_STATUSES.PICKED_UP,
    ORDER_STATUSES.IN_TRANSIT,
    ORDER_STATUSES.DELIVERED,
    ORDER_STATUSES.DISPUTED
  ].includes(status);
}

function canTransitionAdminOrder(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) {
    return false;
  }

  switch (currentStatus) {
    case ORDER_STATUSES.PENDING_PAYMENT:
      return nextStatus === ORDER_STATUSES.CANCELLED;
    case ORDER_STATUSES.CONFIRMED:
      return [
        ORDER_STATUSES.PICKED_UP,
        ORDER_STATUSES.IN_TRANSIT,
        ORDER_STATUSES.DELIVERED,
        ORDER_STATUSES.CANCELLED,
        ORDER_STATUSES.DISPUTED
      ].includes(nextStatus);
    case ORDER_STATUSES.PICKED_UP:
      return [
        ORDER_STATUSES.IN_TRANSIT,
        ORDER_STATUSES.DELIVERED,
        ORDER_STATUSES.CANCELLED,
        ORDER_STATUSES.DISPUTED
      ].includes(nextStatus);
    case ORDER_STATUSES.IN_TRANSIT:
      return [
        ORDER_STATUSES.DELIVERED,
        ORDER_STATUSES.CANCELLED,
        ORDER_STATUSES.DISPUTED
      ].includes(nextStatus);
    case ORDER_STATUSES.DISPUTED:
      return [
        ORDER_STATUSES.CONFIRMED,
        ORDER_STATUSES.PICKED_UP,
        ORDER_STATUSES.IN_TRANSIT,
        ORDER_STATUSES.DELIVERED,
        ORDER_STATUSES.CANCELLED
      ].includes(nextStatus);
    default:
      return false;
  }
}

function resolveAdminOrderStatusNote(currentStatus, nextStatus, note) {
  const trimmedNote = typeof note === 'string' ? note.trim() : '';

  return trimmedNote || `Admin updated order status from ${currentStatus} to ${nextStatus}.`;
}

function canTransitionAdminPayout(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) {
    return false;
  }

  switch (currentStatus) {
    case PAYOUT_STATUSES.REQUESTED:
      return [
        PAYOUT_STATUSES.APPROVED,
        PAYOUT_STATUSES.REJECTED
      ].includes(nextStatus);
    case PAYOUT_STATUSES.APPROVED:
      return nextStatus === PAYOUT_STATUSES.PAID;
    default:
      return false;
  }
}

function resolvePayoutRejectionReason(status, rejectionReason) {
  if (status !== PAYOUT_STATUSES.REJECTED) {
    return null;
  }

  return rejectionReason.trim();
}

function buildChangedPlatformConfigKeys(currentConfig, nextConfig) {
  return Object.keys(nextConfig).filter((key) => (
    JSON.stringify(currentConfig[key]) !== JSON.stringify(nextConfig[key])
  ));
}

function disputeIncludesRefundDetails(payload) {
  return payload.refundReference !== undefined || payload.refundAmountKobo !== undefined;
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

function collectDescendantCategoryIds(categoryId, categories) {
  const categoriesByParentId = buildCategoriesByParentId(categories);
  const ids = [];
  const queue = [Number(categoryId)];

  while (queue.length) {
    const currentCategoryId = queue.shift();

    ids.push(currentCategoryId);

    const childCategories = categoriesByParentId.get(String(currentCategoryId)) || [];

    for (const childCategory of childCategories) {
      queue.push(childCategory.id);
    }
  }

  return ids;
}

function createAdminService({
  adminRepository,
  assignmentService,
  auditLogRepository,
  deliveryJobsRepository,
  disputesRepository,
  env,
  jwtUtils,
  logisticsRepository,
  passwordUtils,
  platformConfigRepository,
  productsRepository,
  sellerFinanceRepository,
  usersRepository,
  sellersRepository,
  ordersRepository
}) {
  async function loadManagedUser(user) {
    const sellerAccount = (
      user
      && user.role === USER_ROLES.SELLER
      && sellersRepository
      && typeof sellersRepository.findByUserId === 'function'
    )
      ? await sellersRepository.findByUserId(user.id)
      : null;

    return mapManagedUser(user, sellerAccount);
  }

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

  function ensureCategoryIsUsable(category, message) {
    if (category.status === CATEGORY_STATUSES.ARCHIVED) {
      throw new AppError(message, {
        statusCode: 409,
        code: ERROR_CODES.CONFLICT
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

  async function ensureManagedUserExists(userId) {
    const user = await usersRepository.findManagedUserById(userId);

    if (!user) {
      throw new AppError('User was not found.', {
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND
      });
    }

    return user;
  }

  async function ensureLogisticsCompanyExists(companyId) {
    if (!logisticsRepository || typeof logisticsRepository.findCompanyById !== 'function') {
      throw new AppError('Logistics company management is unavailable.', {
        statusCode: 500,
        code: ERROR_CODES.INTERNAL_SERVER_ERROR
      });
    }

    const company = await logisticsRepository.findCompanyById(companyId);

    if (!company) {
      throw new AppError('Logistics company was not found.', {
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND
      });
    }

    return company;
  }

  async function ensureRiderExists(riderId) {
    if (!logisticsRepository || typeof logisticsRepository.findRiderById !== 'function') {
      throw new AppError('Logistics rider management is unavailable.', {
        statusCode: 500,
        code: ERROR_CODES.INTERNAL_SERVER_ERROR
      });
    }

    const rider = await logisticsRepository.findRiderById(riderId);

    if (!rider) {
      throw new AppError('Rider was not found.', {
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND
      });
    }

    return rider;
  }

  async function ensureDeliveryJobExists(jobId) {
    if (!deliveryJobsRepository || typeof deliveryJobsRepository.findJobById !== 'function') {
      throw new AppError('Delivery job management is unavailable.', {
        statusCode: 500,
        code: ERROR_CODES.INTERNAL_SERVER_ERROR
      });
    }

    const job = await deliveryJobsRepository.findJobById(jobId);

    if (!job) {
      throw new AppError('Delivery job was not found.', {
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND
      });
    }

    return job;
  }

  async function ensureOrderExists(orderId) {
    const order = await ordersRepository.findOrderByIdForAdmin(orderId);

    if (!order) {
      throw new AppError('Order was not found.', {
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND
      });
    }

    return order;
  }

  async function ensurePayoutExists(payoutId) {
    const payout = await sellerFinanceRepository.findPayoutByIdForAdmin(payoutId);

    if (!payout) {
      throw new AppError('Payout request was not found.', {
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND
      });
    }

    return payout;
  }

  async function ensureDisputeExists(disputeId) {
    if (!disputesRepository || typeof disputesRepository.findDisputeByIdForAdmin !== 'function') {
      throw new AppError('Dispute management is unavailable.', {
        statusCode: 500,
        code: ERROR_CODES.INTERNAL_SERVER_ERROR
      });
    }

    const dispute = await disputesRepository.findDisputeByIdForAdmin(disputeId);

    if (!dispute) {
      throw new AppError('Dispute was not found.', {
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND
      });
    }

    return dispute;
  }

  async function listCurrentPlatformConfig() {
    if (
      !platformConfigRepository
      || typeof platformConfigRepository.listPlatformConfigByKeys !== 'function'
    ) {
      return buildPlatformConfig([], env);
    }

    const entries = await platformConfigRepository.listPlatformConfigByKeys();

    return buildPlatformConfig(entries, env);
  }

  async function persistPlatformConfig(config) {
    if (
      !platformConfigRepository
      || typeof platformConfigRepository.upsertPlatformConfigEntries !== 'function'
    ) {
      throw new AppError('Platform configuration updates are unavailable.', {
        statusCode: 500,
        code: ERROR_CODES.INTERNAL_SERVER_ERROR
      });
    }

    const entries = buildPlatformConfigEntries(config);
    const updatedEntries = await platformConfigRepository.upsertPlatformConfigEntries(entries);

    return buildPlatformConfig(updatedEntries, env);
  }

  async function recordAuditLog(payload) {
    if (!auditLogRepository || typeof auditLogRepository.createAuditLog !== 'function') {
      return;
    }

    await auditLogRepository.createAuditLog(payload);
  }

  return {
    getAuthenticatedAdmin,

    async createCategory(payload) {
      const name = normalizeCategoryName(payload.name);
      const slug = normalizeCategorySlug(name, payload.slug);
      const parentId = payload.parentId === undefined ? null : payload.parentId;

      if (parentId !== null) {
        const parentCategory = await ensureCategoryExists(parentId);

        ensureCategoryIsUsable(parentCategory, 'Archived categories cannot be used as parent categories.');
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
        parentId,
        status: CATEGORY_STATUSES.ACTIVE
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
      const [category, categories] = await Promise.all([
        ensureCategoryExists(payload.categoryId),
        productsRepository.listAllCategories()
      ]);

      if (category.status === CATEGORY_STATUSES.ARCHIVED) {
        throw new AppError('Category is already archived.', {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT
        });
      }

      const categoryIdsToArchive = collectDescendantCategoryIds(payload.categoryId, categories);

      await productsRepository.updateCategoriesStatus(
        categoryIdsToArchive,
        CATEGORY_STATUSES.ARCHIVED
      );

      const updatedCategories = await productsRepository.listAllCategories();
      const updatedCategory = updatedCategories.find((entry) => entry.id === Number(payload.categoryId));

      return buildCategoryDetail(updatedCategory, updatedCategories);
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

    async getPlatformConfig() {
      return listCurrentPlatformConfig();
    },

    async listCategories(payload = {}) {
      const status = normalizeCategoryListStatus(payload.query && payload.query.status);
      const categories = await productsRepository.listAllCategories({ status });

      return {
        categories: buildCategoryTree(categories),
        filters: {
          status
        }
      };
    },

    async listOrders(payload) {
      const pagination = normalizePagination(payload.query, {
        defaultLimit: 10,
        maxLimit: 50
      });
      const filters = {
        status: normalizeOrderListStatus(payload.query.status),
        paymentStatus: normalizeOrderListPaymentStatus(payload.query.paymentStatus),
        search: normalizeSearchTerm(payload.query.search),
        limit: pagination.limit,
        offset: pagination.offset
      };
      const result = await ordersRepository.listOrdersForAdmin(filters);

      return {
        orders: result.orders.map((order) => mapAdminOrder(order)),
        pagination: buildPagination({
          page: pagination.page,
          limit: pagination.limit,
          total: result.total
        }),
        filters: {
          status: filters.status,
          paymentStatus: filters.paymentStatus,
          search: filters.search
        }
      };
    },

    async listPayouts(payload) {
      const pagination = normalizePagination(payload.query, {
        defaultLimit: 10,
        maxLimit: 50
      });
      const filters = {
        payeeType: payload.query.payeeType || 'all',
        status: normalizePayoutListStatus(payload.query.status),
        search: normalizeSearchTerm(payload.query.search),
        companyId: payload.query.companyId || null,
        sellerId: payload.query.sellerId || null,
        limit: pagination.limit,
        offset: pagination.offset
      };
      const result = await sellerFinanceRepository.listPayoutsForAdmin(filters);

      return {
        payouts: result.payouts.map((payout) => mapAdminPayout(payout)),
        pagination: buildPagination({
          page: pagination.page,
          limit: pagination.limit,
          total: result.total
        }),
        filters: {
          payeeType: filters.payeeType,
          status: filters.status,
          search: filters.search,
          companyId: filters.companyId,
          sellerId: filters.sellerId
        }
      };
    },

    async listDisputes(payload) {
      if (!disputesRepository || typeof disputesRepository.listDisputesForAdmin !== 'function') {
        throw new AppError('Dispute management is unavailable.', {
          statusCode: 500,
          code: ERROR_CODES.INTERNAL_SERVER_ERROR
        });
      }

      const pagination = normalizePagination(payload.query, {
        defaultLimit: 10,
        maxLimit: 50
      });
      const filters = {
        status: normalizeDisputeListStatus(payload.query.status),
        raisedBy: normalizeDisputeRaisedBy(payload.query.raisedBy),
        search: normalizeSearchTerm(payload.query.search),
        limit: pagination.limit,
        offset: pagination.offset
      };
      const result = await disputesRepository.listDisputesForAdmin(filters);

      return {
        disputes: result.disputes.map((dispute) => mapAdminDispute(dispute)),
        pagination: buildPagination({
          page: pagination.page,
          limit: pagination.limit,
          total: result.total
        }),
        filters: {
          status: filters.status,
          raisedBy: filters.raisedBy,
          search: filters.search
        }
      };
    },

    async listAuditLogs(payload) {
      if (!auditLogRepository || typeof auditLogRepository.listAuditLogs !== 'function') {
        throw new AppError('Audit log access is unavailable.', {
          statusCode: 500,
          code: ERROR_CODES.INTERNAL_SERVER_ERROR
        });
      }

      const pagination = normalizePagination(payload.query, {
        defaultLimit: 10,
        maxLimit: 50
      });
      const filters = {
        adminId: payload.query.adminId || null,
        action: normalizeSearchTerm(payload.query.action),
        targetType: normalizeSearchTerm(payload.query.targetType),
        targetId: payload.query.targetId || null,
        limit: pagination.limit,
        offset: pagination.offset
      };
      const result = await auditLogRepository.listAuditLogs(filters);

      return {
        auditLogs: result.logs.map((log) => mapAdminAuditLog(log)),
        pagination: buildPagination({
          page: pagination.page,
          limit: pagination.limit,
          total: result.total
        }),
        filters: {
          adminId: filters.adminId,
          action: filters.action,
          targetType: filters.targetType,
          targetId: filters.targetId
        }
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

    async listUsers(payload) {
      const pagination = normalizePagination(payload.query, {
        defaultLimit: 10,
        maxLimit: 50
      });
      const filters = {
        role: normalizeManagedUserRole(payload.query.role),
        status: normalizeManagedUserStatus(payload.query.status),
        search: normalizeSearchTerm(payload.query.search),
        limit: pagination.limit,
        offset: pagination.offset
      };
      const result = await usersRepository.listManagedUsers(filters);
      const users = await Promise.all(result.users.map((user) => loadManagedUser(user)));

      return {
        users,
        pagination: buildPagination({
          page: pagination.page,
          limit: pagination.limit,
          total: result.total
        }),
        filters: {
          role: filters.role,
          status: filters.status,
          search: filters.search
        }
      };
    },

    async listLogisticsCompanies(payload) {
      const pagination = normalizePagination(payload.query, {
        defaultLimit: 10,
        maxLimit: 50
      });
      const filters = {
        status: normalizeLogisticsCompanyStatus(payload.query.status),
        search: normalizeSearchTerm(payload.query.search),
        limit: pagination.limit,
        offset: pagination.offset
      };
      const [result, summary] = await Promise.all([
        logisticsRepository.listCompanies(filters),
        logisticsRepository.summarizeCompanies({
          search: filters.search
        })
      ]);

      return {
        companies: result.companies.map(mapAdminLogisticsCompany),
        pagination: buildPagination({
          page: pagination.page,
          limit: pagination.limit,
          total: result.total
        }),
        filters: {
          status: filters.status,
          search: filters.search
        },
        summary: buildAdminLogisticsCompanySummary(summary)
      };
    },

    async listLogisticsRiders(payload) {
      const pagination = normalizePagination(payload.query, {
        defaultLimit: 10,
        maxLimit: 50
      });
      const filters = {
        companyId: payload.query.companyId || null,
        status: normalizeRiderStatus(payload.query.status),
        search: normalizeSearchTerm(payload.query.search),
        limit: pagination.limit,
        offset: pagination.offset
      };
      const [result, summary] = await Promise.all([
        logisticsRepository.listRiders(filters),
        logisticsRepository.summarizeRiders({
          companyId: filters.companyId,
          search: filters.search
        })
      ]);

      return {
        riders: result.riders.map(mapAdminRider),
        pagination: buildPagination({
          page: pagination.page,
          limit: pagination.limit,
          total: result.total
        }),
        filters: {
          companyId: filters.companyId,
          status: filters.status,
          search: filters.search
        },
        summary: buildRiderStatusSummary(summary)
      };
    },

    async listDeliveryJobs(payload) {
      const pagination = normalizePagination(payload.query, {
        defaultLimit: 10,
        maxLimit: 50
      });
      const filters = {
        companyId: payload.query.companyId || null,
        riderId: payload.query.riderId || null,
        status: normalizeDeliveryJobStatus(payload.query.status),
        search: normalizeSearchTerm(payload.query.search),
        limit: pagination.limit,
        offset: pagination.offset
      };
      const [result, summary] = await Promise.all([
        deliveryJobsRepository.listJobs(filters),
        deliveryJobsRepository.summarizeJobs({
          companyId: filters.companyId,
          riderId: filters.riderId,
          search: filters.search
        })
      ]);

      return {
        jobs: result.jobs.map((job) => mapAdminDeliveryJob(job)),
        pagination: buildPagination({
          page: pagination.page,
          limit: pagination.limit,
          total: result.total
        }),
        filters: {
          companyId: filters.companyId,
          riderId: filters.riderId,
          status: filters.status,
          search: filters.search
        },
        summary: {
          jobsByStatus: buildDeliveryJobsByStatus(summary),
          deliveryMetrics: buildDeliveryMetrics(summary)
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
      const status = payload.status !== undefined
        ? payload.status
        : existingCategory.status;

      if (parentId !== null) {
        const parentCategory = await ensureCategoryExists(parentId);

        ensureCategoryIsUsable(parentCategory, 'Archived categories cannot be used as parent categories.');
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

      if (status === CATEGORY_STATUSES.ACTIVE && parentId !== null) {
        const parentCategory = categories.find((category) => category.id === parentId) || null;

        if (parentCategory && parentCategory.status === CATEGORY_STATUSES.ARCHIVED) {
          throw new AppError('Archived categories cannot be used as parent categories.', {
            statusCode: 409,
            code: ERROR_CODES.CONFLICT
          });
        }
      }

      const shouldArchiveSubtree = (
        payload.status === CATEGORY_STATUSES.ARCHIVED
        && existingCategory.status !== CATEGORY_STATUSES.ARCHIVED
      );

      const updatedCategory = await productsRepository.updateCategory(payload.categoryId, {
        name: payload.name !== undefined ? name : undefined,
        slug: payload.slug !== undefined ? slug : undefined,
        parentId: payload.parentId !== undefined ? parentId : undefined,
        status: payload.status !== undefined ? status : undefined
      });

      if (shouldArchiveSubtree) {
        const descendantCategoryIds = collectDescendantCategoryIds(payload.categoryId, categories)
          .filter((categoryId) => categoryId !== Number(payload.categoryId));

        if (descendantCategoryIds.length) {
          await productsRepository.updateCategoriesStatus(
            descendantCategoryIds,
            CATEGORY_STATUSES.ARCHIVED
          );
        }
      }

      const updatedCategories = await productsRepository.listAllCategories();

      return buildCategoryDetail(updatedCategory, updatedCategories);
    },

    async updatePlatformConfig(payload) {
      const currentConfig = await listCurrentPlatformConfig();

      if (Array.isArray(payload.commissionRatesByCategory)) {
        const categoryIds = Array.from(new Set(
          payload.commissionRatesByCategory.map((entry) => Number(entry.categoryId))
        ));

        await Promise.all(categoryIds.map((categoryId) => ensureCategoryExists(categoryId)));
      }

      const nextConfig = {
        commissionRateDefault: payload.commissionRateDefault !== undefined
          ? payload.commissionRateDefault
          : currentConfig.commissionRateDefault,
        commissionRatesByCategory: payload.commissionRatesByCategory !== undefined
          ? payload.commissionRatesByCategory
          : currentConfig.commissionRatesByCategory,
        commissionRatesBySellerTier: payload.commissionRatesBySellerTier !== undefined
          ? payload.commissionRatesBySellerTier
          : currentConfig.commissionRatesBySellerTier,
        platformSettings: payload.platformSettings !== undefined
          ? payload.platformSettings
          : currentConfig.platformSettings
      };
      const changedKeys = buildChangedPlatformConfigKeys(currentConfig, nextConfig);

      if (!changedKeys.length) {
        return currentConfig;
      }

      const updatedConfig = await persistPlatformConfig(nextConfig);

      await recordAuditLog({
        adminId: payload.adminId,
        action: 'platform_config.updated',
        targetType: 'platform_config',
        targetId: null,
        detail: {
          changedKeys,
          previousConfig: currentConfig,
          nextConfig: updatedConfig
        }
      });

      return updatedConfig;
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

      await recordAuditLog({
        adminId: payload.adminId,
        action: `seller_verification.${payload.verificationStatus}`,
        targetType: 'seller',
        targetId: updatedSellerAccount.sellerProfile.id,
        detail: {
          previousStatus: sellerAccount.sellerProfile.verificationStatus,
          nextStatus: updatedSellerAccount.sellerProfile.verificationStatus,
          userId: updatedSellerAccount.user.id,
          rejectionReason: updatedSellerAccount.sellerProfile.rejectionReason
        }
      });

      return sanitizeSellerAccount(updatedSellerAccount, sanitizeUser);
    },

    async updateOrderStatus(payload) {
      const existingOrder = await ensureOrderExists(payload.orderId);

      if (existingOrder.status === payload.status) {
        throw new AppError('Order already has this status.', {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT
        });
      }

      if (!canTransitionAdminOrder(existingOrder.status, payload.status)) {
        throw new AppError(
          `Orders in ${existingOrder.status} status cannot be moved to ${payload.status}.`,
          {
            statusCode: 409,
            code: ERROR_CODES.CONFLICT
          }
        );
      }

      if (
        orderStatusRequiresPaidPayment(payload.status)
        && existingOrder.paymentStatus !== PAYMENT_STATUSES.PAID
      ) {
        throw new AppError('Only paid orders can move into confirmed, fulfilment, or disputed states.', {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT
        });
      }

      const note = resolveAdminOrderStatusNote(existingOrder.status, payload.status, payload.note);

      const updatedOrder = await ordersRepository.updateOrderStatusForAdmin({
        orderId: payload.orderId,
        status: payload.status,
        note
      });
      const statusHistory = await ordersRepository.findOrderStatusHistoryByOrderIdForAdmin(
        payload.orderId
      );

      await recordAuditLog({
        adminId: payload.adminId,
        action: 'order_status.updated',
        targetType: 'order',
        targetId: updatedOrder.id,
        detail: {
          previousStatus: existingOrder.status,
          nextStatus: updatedOrder.status,
          note
        }
      });

      return mapAdminOrder(updatedOrder, statusHistory);
    },

    async updatePayoutStatus(payload) {
      const existingPayout = await ensurePayoutExists(payload.payoutId);

      if (existingPayout.status === payload.status) {
        throw new AppError('Payout request already has this status.', {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT
        });
      }

      if (!canTransitionAdminPayout(existingPayout.status, payload.status)) {
        throw new AppError(
          `Payout requests in ${existingPayout.status} status cannot be moved to ${payload.status}.`,
          {
            statusCode: 409,
            code: ERROR_CODES.CONFLICT
          }
        );
      }

      const rejectionReason = resolvePayoutRejectionReason(
        payload.status,
        payload.rejectionReason || ''
      );
      const updatedPayout = await sellerFinanceRepository.updatePayoutStatusForAdmin({
        adminId: payload.adminId,
        payoutId: payload.payoutId,
        status: payload.status,
        rejectionReason
      });

      await recordAuditLog({
        adminId: payload.adminId,
        action: `payout.${payload.status}`,
        targetType: 'payout',
        targetId: updatedPayout.id,
        detail: {
          previousStatus: existingPayout.status,
          nextStatus: updatedPayout.status,
          sellerId: updatedPayout.seller ? updatedPayout.seller.id : null,
          logisticsCompanyId: updatedPayout.logisticsCompany
            ? updatedPayout.logisticsCompany.id
            : null,
          amountKobo: updatedPayout.amountKobo,
          rejectionReason
        }
      });

      return mapAdminPayout(updatedPayout);
    },

    async updateDispute(payload) {
      const existingDispute = await ensureDisputeExists(payload.disputeId);

      if (existingDispute.status !== DISPUTE_STATUSES.OPEN) {
        throw new AppError('Only open disputes can be reviewed.', {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT
        });
      }

      if (payload.status === DISPUTE_STATUSES.RESOLVED && disputeIncludesRefundDetails(payload)) {
        if (
          !existingDispute.order
          || existingDispute.order.paymentStatus !== PAYMENT_STATUSES.PAID
          || !existingDispute.order.paymentReference
        ) {
          throw new AppError('Refund details can only be recorded for paid orders with a payment reference.', {
            statusCode: 409,
            code: ERROR_CODES.CONFLICT
          });
        }

        if (payload.refundAmountKobo > existingDispute.order.totalKobo) {
          throw new AppError('Refund amount cannot exceed the order total.', {
            statusCode: 422,
            code: ERROR_CODES.VALIDATION_ERROR
          });
        }
      }

      const updatedDispute = await disputesRepository.updateDisputeDecision({
        adminId: payload.adminId,
        disputeId: payload.disputeId,
        status: payload.status,
        resolutionNote: payload.resolutionNote.trim(),
        refundReference: payload.refundReference || null,
        refundAmountKobo: payload.refundAmountKobo
      });

      await recordAuditLog({
        adminId: payload.adminId,
        action: `dispute.${payload.status}`,
        targetType: 'dispute',
        targetId: updatedDispute.id,
        detail: {
          previousStatus: existingDispute.status,
          nextStatus: updatedDispute.status,
          orderId: updatedDispute.orderId,
          raisedBy: updatedDispute.raisedBy,
          sellerId: updatedDispute.raisedBy === DISPUTE_RAISED_BY.SELLER
            && updatedDispute.raisedBySeller
            ? updatedDispute.raisedBySeller.id
            : null,
          resolutionNote: updatedDispute.resolutionNote,
          refundReference: updatedDispute.refundReference,
          refundAmountKobo: updatedDispute.refundAmountKobo
        }
      });

      return mapAdminDispute(updatedDispute);
    },

    async updateLogisticsCompanyStatus(payload) {
      const existingCompany = await ensureLogisticsCompanyExists(payload.companyId);

      if (existingCompany.status === payload.status) {
        throw new AppError('Logistics company already has this status.', {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT
        });
      }

      const updatedCompany = await logisticsRepository.updateCompanyStatus({
        companyId: existingCompany.id,
        status: payload.status,
        approvedBy: payload.status === LOGISTICS_COMPANY_STATUSES.APPROVED
          ? payload.adminId
          : existingCompany.approvedBy
      });

      await recordAuditLog({
        adminId: payload.adminId,
        action: 'logistics_company.status_updated',
        targetType: 'logistics_company',
        targetId: updatedCompany.id,
        detail: {
          previousStatus: existingCompany.status,
          nextStatus: updatedCompany.status
        }
      });

      return mapAdminLogisticsCompany(updatedCompany);
    },

    async assignDeliveryJob(payload) {
      if (!assignmentService || typeof assignmentService.assignJobToRider !== 'function') {
        throw new AppError('Delivery job assignment is unavailable.', {
          statusCode: 500,
          code: ERROR_CODES.INTERNAL_SERVER_ERROR
        });
      }

      const existingJob = await ensureDeliveryJobExists(payload.jobId);
      const rider = await ensureRiderExists(payload.riderId);
      const assignedJob = await assignmentService.assignJobToRider({
        jobId: existingJob.id,
        riderId: rider.id,
        note: payload.note
      });
      const statusHistory = await deliveryJobsRepository.findStatusHistoryByJobId(existingJob.id);

      await recordAuditLog({
        adminId: payload.adminId,
        action: 'delivery_job.assigned',
        targetType: 'delivery_job',
        targetId: assignedJob.id,
        detail: {
          previousStatus: existingJob.status,
          nextStatus: assignedJob.status,
          orderId: assignedJob.orderId,
          orderItemId: assignedJob.orderItemId,
          riderId: rider.id,
          companyId: rider.companyId
        }
      });

      return mapAdminDeliveryJob(assignedJob, {
        statusHistory
      });
    },

    async updateUserStatus(payload) {
      const existingUser = await ensureManagedUserExists(payload.userId);
      const currentStatus = existingUser.accountStatus || USER_ACCOUNT_STATUSES.ACTIVE;

      if (currentStatus === payload.status) {
        throw new AppError('User already has this account status.', {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT
        });
      }

      const updatedUser = await usersRepository.updateAccountStatus(payload.userId, payload.status);

      await recordAuditLog({
        adminId: payload.adminId,
        action: 'user_status.updated',
        targetType: 'user',
        targetId: updatedUser.id,
        detail: {
          previousStatus: currentStatus,
          nextStatus: updatedUser.accountStatus || USER_ACCOUNT_STATUSES.ACTIVE,
          role: updatedUser.role
        }
      });

      return loadManagedUser(updatedUser);
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
