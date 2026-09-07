const {
  BLOG_COMMENT_STATUSES,
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
const { removeStoredBlogImage } = require('../utils/product-image-files');
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
const {
  computeReadTimeMinutes,
  deriveExcerptFromHtml,
  sanitizeBlogHtml
} = require('../utils/blog-content');
const { serializeCsvRows } = require('../utils/csv');
const { dateEpoch, disputeSla, disputeSlaHours } = require('../utils/admin-reporting');
const { disputeSeller } = require('./admin-disputes.service');

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

function normalizeAdminBlogCategoryStatus(status) {
  return status || 'all';
}

function normalizeAdminBlogTagStatus(status) {
  return status || 'all';
}

function normalizeAdminBlogPostStatus(status) {
  return status || 'all';
}

function normalizeAdminBlogCommentStatus(status) {
  return status || 'all';
}

function normalizeAdminNewsletterStatus(status) {
  return status || 'all';
}

function normalizeAdminBlogSort(sort) {
  return sort || 'latest';
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

function normalizeOptionalText(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmedValue = String(value).trim();

  return trimmedValue ? trimmedValue : null;
}

function normalizeRequiredBlogText(value, fieldName) {
  const normalizedValue = normalizeOptionalText(value);

  if (!normalizedValue) {
    throw new AppError(`${fieldName} is required.`, {
      statusCode: 422,
      code: ERROR_CODES.VALIDATION_ERROR
    });
  }

  return normalizedValue;
}

function normalizeBlogSlug(fallbackValue, slug) {
  const normalizedSlug = slugify(slug !== undefined ? slug : fallbackValue);

  if (!normalizedSlug) {
    throw new AppError('Blog slug could not be generated from the provided value.', {
      statusCode: 422,
      code: ERROR_CODES.VALIDATION_ERROR
    });
  }

  return normalizedSlug;
}

function normalizeBlogPostBody(body) {
  const sanitizedBody = sanitizeBlogHtml(body);

  if (!sanitizedBody) {
    throw new AppError('Blog post body must contain supported HTML content.', {
      statusCode: 422,
      code: ERROR_CODES.VALIDATION_ERROR
    });
  }

  return sanitizedBody;
}

function mapAdminBlogCategory(category) {
  if (!category) {
    return null;
  }

  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    status: category.status,
    postCount: category.postCount === undefined ? undefined : category.postCount,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt
  };
}

function mapAdminBlogTag(tag) {
  if (!tag) {
    return null;
  }

  return {
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    status: tag.status,
    postCount: tag.postCount === undefined ? undefined : tag.postCount,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt
  };
}

function mapAdminBlogPostTag(postTag) {
  if (!postTag || !postTag.tag) {
    return null;
  }

  return mapAdminBlogTag(postTag.tag);
}

function mapAdminBlogPostListItem(post) {
  if (!post) {
    return null;
  }

  return {
    id: post.id,
    categoryId: post.categoryId,
    category: mapAdminBlogCategory(post.category),
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    featuredImageUrl: post.featuredImageUrl,
    featuredImageAlt: post.featuredImageAlt,
    authorDisplayName: post.authorDisplayName,
    authorAvatarUrl: post.authorAvatarUrl,
    readTimeMinutes: post.readTimeMinutes,
    status: post.status,
    publishedAt: post.publishedAt,
    viewCount: post.viewCount,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt
  };
}

function mapAdminBlogPostDetail(post, options = {}) {
  return {
    ...mapAdminBlogPostListItem(post),
    body: post.body,
    tags: (options.tags || []).map(mapAdminBlogPostTag).filter(Boolean),
    commentCount: options.commentCount === undefined ? 0 : options.commentCount
  };
}

function mapAdminBlogComment(comment) {
  if (!comment) {
    return null;
  }

  return {
    id: comment.id,
    postId: comment.postId,
    parentId: comment.parentId,
    authorName: comment.authorName,
    authorEmail: comment.authorEmail,
    body: comment.body,
    status: comment.status,
    approvedAt: comment.approvedAt,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt
  };
}

function mapAdminNewsletterSubscriber(subscriber) {
  if (!subscriber) {
    return null;
  }

  return {
    id: subscriber.id,
    email: subscriber.email,
    status: subscriber.status,
    subscribedAt: subscriber.subscribedAt,
    unsubscribedAt: subscriber.unsubscribedAt,
    createdAt: subscriber.createdAt,
    updatedAt: subscriber.updatedAt
  };
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
    // Repositories and detail line items supply sellers in first-item order.
    seller: (order.sellers || [])[0] || null,
    sellers: [...(order.sellers || [])].sort((a, b) => a.id - b.id),
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
  blogCategoriesRepository,
  blogCommentsRepository,
  blogPostTagsRepository,
  blogPostsRepository,
  blogTagsRepository,
  deliveryJobsRepository,
  disputesRepository,
  env,
  jwtUtils,
  logisticsRepository,
  newsletterSubscribersRepository,
  passwordUtils,
  paymentsService,
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

  async function ensureBlogCategoryExists(categoryId) {
    if (!blogCategoriesRepository || typeof blogCategoriesRepository.findById !== 'function') {
      throw new AppError('Blog category management is unavailable.', {
        statusCode: 500,
        code: ERROR_CODES.INTERNAL_SERVER_ERROR
      });
    }

    const category = await blogCategoriesRepository.findById(categoryId);

    if (!category) {
      throw new AppError('Blog category was not found.', {
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND
      });
    }

    return category;
  }

  function ensureBlogCategoryIsActive(category, message = 'Archived blog categories cannot be used here.') {
    if (category.status === CATEGORY_STATUSES.ARCHIVED) {
      throw new AppError(message, {
        statusCode: 409,
        code: ERROR_CODES.CONFLICT
      });
    }

    return category;
  }

  async function ensureBlogTagExists(tagId) {
    if (!blogTagsRepository || typeof blogTagsRepository.findById !== 'function') {
      throw new AppError('Blog tag management is unavailable.', {
        statusCode: 500,
        code: ERROR_CODES.INTERNAL_SERVER_ERROR
      });
    }

    const tag = await blogTagsRepository.findById(tagId);

    if (!tag) {
      throw new AppError('Blog tag was not found.', {
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND
      });
    }

    return tag;
  }

  function ensureBlogTagIsActive(tag, message = 'Archived blog tags cannot be assigned to posts.') {
    if (tag.status === CATEGORY_STATUSES.ARCHIVED) {
      throw new AppError(message, {
        statusCode: 409,
        code: ERROR_CODES.CONFLICT
      });
    }

    return tag;
  }

  async function ensureBlogPostExists(postId) {
    if (!blogPostsRepository || typeof blogPostsRepository.findById !== 'function') {
      throw new AppError('Blog post management is unavailable.', {
        statusCode: 500,
        code: ERROR_CODES.INTERNAL_SERVER_ERROR
      });
    }

    const post = await blogPostsRepository.findById(postId);

    if (!post) {
      throw new AppError('Blog post was not found.', {
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND
      });
    }

    return post;
  }

  async function ensureBlogCommentExists(commentId) {
    if (!blogCommentsRepository || typeof blogCommentsRepository.findById !== 'function') {
      throw new AppError('Blog comment moderation is unavailable.', {
        statusCode: 500,
        code: ERROR_CODES.INTERNAL_SERVER_ERROR
      });
    }

    const comment = await blogCommentsRepository.findById(commentId);

    if (!comment) {
      throw new AppError('Blog comment was not found.', {
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND
      });
    }

    return comment;
  }

  async function ensureBlogCategorySlugIsAvailable(slug, excludeCategoryId = null) {
    const existingCategory = await blogCategoriesRepository.findBySlug(slug);

    if (existingCategory && existingCategory.id !== Number(excludeCategoryId)) {
      throw new AppError('A blog category with this slug already exists.', {
        statusCode: 409,
        code: ERROR_CODES.CONFLICT
      });
    }
  }

  async function ensureBlogTagSlugIsAvailable(slug, excludeTagId = null) {
    const existingTag = await blogTagsRepository.findBySlug(slug);

    if (existingTag && existingTag.id !== Number(excludeTagId)) {
      throw new AppError('A blog tag with this slug already exists.', {
        statusCode: 409,
        code: ERROR_CODES.CONFLICT
      });
    }
  }

  async function ensureBlogPostSlugIsAvailable(slug, excludePostId = null) {
    const existingPost = await blogPostsRepository.findBySlug(slug);

    if (existingPost && existingPost.id !== Number(excludePostId)) {
      throw new AppError('A blog post with this slug already exists.', {
        statusCode: 409,
        code: ERROR_CODES.CONFLICT
      });
    }
  }

  async function ensureBlogTagIdsAreAssignable(tagIds = []) {
    const uniqueTagIds = Array.from(new Set(
      (tagIds || [])
        .map((tagId) => Number(tagId))
        .filter((tagId) => Number.isInteger(tagId) && tagId > 0)
    ));

    const tags = await Promise.all(uniqueTagIds.map((tagId) => ensureBlogTagExists(tagId)));

    tags.forEach((tag) => {
      ensureBlogTagIsActive(tag);
    });

    return tags;
  }

  function resolveBlogPostExcerpt(body, excerpt) {
    const normalizedExcerpt = normalizeOptionalText(excerpt);

    return normalizedExcerpt || deriveExcerptFromHtml(body);
  }

  async function loadAdminBlogPostDetail(postId) {
    const post = await ensureBlogPostExists(postId);
    const [tags, commentCount] = await Promise.all([
      blogPostTagsRepository.listTagsForPost(post.id),
      blogCommentsRepository.countComments({
        postId: post.id,
        status: 'all'
      })
    ]);

    return mapAdminBlogPostDetail(post, {
      tags,
      commentCount
    });
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

    async listBlogCategories(payload = {}) {
      const filters = {
        status: normalizeAdminBlogCategoryStatus(payload.query && payload.query.status),
        search: normalizeSearchTerm(payload.query && payload.query.search)
      };
      const categories = await blogCategoriesRepository.listCategories(filters);

      return {
        categories: categories.map(mapAdminBlogCategory),
        filters
      };
    },

    async getBlogCategory(payload) {
      const category = await ensureBlogCategoryExists(payload.categoryId);

      return mapAdminBlogCategory(category);
    },

    async createBlogCategory(payload) {
      const name = normalizeRequiredBlogText(payload.name, 'Blog category name');
      const slug = normalizeBlogSlug(name, payload.slug);

      await ensureBlogCategorySlugIsAvailable(slug);

      const category = await blogCategoriesRepository.createCategory({
        name,
        slug,
        description: normalizeOptionalText(payload.description),
        status: payload.status || CATEGORY_STATUSES.ACTIVE
      });

      await recordAuditLog({
        adminId: payload.adminId,
        action: 'blog_category.created',
        targetType: 'blog_category',
        targetId: category.id,
        detail: {
          name: category.name,
          slug: category.slug,
          status: category.status
        }
      });

      return mapAdminBlogCategory(category);
    },

    async updateBlogCategory(payload) {
      const existingCategory = await ensureBlogCategoryExists(payload.categoryId);
      const name = payload.name !== undefined
        ? normalizeRequiredBlogText(payload.name, 'Blog category name')
        : existingCategory.name;
      const slug = payload.slug !== undefined
        ? normalizeBlogSlug(name, payload.slug)
        : existingCategory.slug;
      const description = payload.description !== undefined
        ? normalizeOptionalText(payload.description)
        : existingCategory.description;
      const status = payload.status !== undefined
        ? payload.status
        : existingCategory.status;

      await ensureBlogCategorySlugIsAvailable(slug, payload.categoryId);

      const category = await blogCategoriesRepository.updateCategory(payload.categoryId, {
        name: payload.name !== undefined ? name : undefined,
        slug: payload.slug !== undefined ? slug : undefined,
        description: payload.description !== undefined ? description : undefined,
        status: payload.status !== undefined ? status : undefined
      });

      await recordAuditLog({
        adminId: payload.adminId,
        action: 'blog_category.updated',
        targetType: 'blog_category',
        targetId: category.id,
        detail: {
          previousStatus: existingCategory.status,
          nextStatus: category.status,
          slugChanged: existingCategory.slug !== category.slug
        }
      });

      return mapAdminBlogCategory(category);
    },

    async deleteBlogCategory(payload) {
      const existingCategory = await ensureBlogCategoryExists(payload.categoryId);

      if (existingCategory.status === CATEGORY_STATUSES.ARCHIVED) {
        throw new AppError('Blog category is already archived.', {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT
        });
      }

      const category = await blogCategoriesRepository.updateCategory(payload.categoryId, {
        status: CATEGORY_STATUSES.ARCHIVED
      });

      await recordAuditLog({
        adminId: payload.adminId,
        action: 'blog_category.archived',
        targetType: 'blog_category',
        targetId: category.id,
        detail: {
          previousStatus: existingCategory.status,
          nextStatus: category.status
        }
      });

      return mapAdminBlogCategory(category);
    },

    async listBlogTags(payload = {}) {
      const filters = {
        status: normalizeAdminBlogTagStatus(payload.query && payload.query.status),
        search: normalizeSearchTerm(payload.query && payload.query.search)
      };
      const tags = await blogTagsRepository.listTags(filters);

      return {
        tags: tags.map(mapAdminBlogTag),
        filters
      };
    },

    async getBlogTag(payload) {
      const tag = await ensureBlogTagExists(payload.tagId);

      return mapAdminBlogTag(tag);
    },

    async createBlogTag(payload) {
      const name = normalizeRequiredBlogText(payload.name, 'Blog tag name');
      const slug = normalizeBlogSlug(name, payload.slug);

      await ensureBlogTagSlugIsAvailable(slug);

      const tag = await blogTagsRepository.createTag({
        name,
        slug,
        status: payload.status || CATEGORY_STATUSES.ACTIVE
      });

      await recordAuditLog({
        adminId: payload.adminId,
        action: 'blog_tag.created',
        targetType: 'blog_tag',
        targetId: tag.id,
        detail: {
          name: tag.name,
          slug: tag.slug,
          status: tag.status
        }
      });

      return mapAdminBlogTag(tag);
    },

    async updateBlogTag(payload) {
      const existingTag = await ensureBlogTagExists(payload.tagId);
      const name = payload.name !== undefined
        ? normalizeRequiredBlogText(payload.name, 'Blog tag name')
        : existingTag.name;
      const slug = payload.slug !== undefined
        ? normalizeBlogSlug(name, payload.slug)
        : existingTag.slug;
      const status = payload.status !== undefined
        ? payload.status
        : existingTag.status;

      await ensureBlogTagSlugIsAvailable(slug, payload.tagId);

      const tag = await blogTagsRepository.updateTag(payload.tagId, {
        name: payload.name !== undefined ? name : undefined,
        slug: payload.slug !== undefined ? slug : undefined,
        status: payload.status !== undefined ? status : undefined
      });

      await recordAuditLog({
        adminId: payload.adminId,
        action: 'blog_tag.updated',
        targetType: 'blog_tag',
        targetId: tag.id,
        detail: {
          previousStatus: existingTag.status,
          nextStatus: tag.status,
          slugChanged: existingTag.slug !== tag.slug
        }
      });

      return mapAdminBlogTag(tag);
    },

    async deleteBlogTag(payload) {
      const existingTag = await ensureBlogTagExists(payload.tagId);

      if (existingTag.status === CATEGORY_STATUSES.ARCHIVED) {
        throw new AppError('Blog tag is already archived.', {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT
        });
      }

      const tag = await blogTagsRepository.updateTag(payload.tagId, {
        status: CATEGORY_STATUSES.ARCHIVED
      });

      await recordAuditLog({
        adminId: payload.adminId,
        action: 'blog_tag.archived',
        targetType: 'blog_tag',
        targetId: tag.id,
        detail: {
          previousStatus: existingTag.status,
          nextStatus: tag.status
        }
      });

      return mapAdminBlogTag(tag);
    },

    async listBlogPosts(payload) {
      const pagination = normalizePagination(payload.query, {
        defaultLimit: 10,
        maxLimit: 50
      });
      const filters = {
        status: normalizeAdminBlogPostStatus(payload.query.status),
        categoryId: payload.query.categoryId || null,
        search: normalizeSearchTerm(payload.query.search),
        sort: normalizeAdminBlogSort(payload.query.sort),
        limit: pagination.limit,
        offset: pagination.offset
      };
      const [posts, total] = await Promise.all([
        blogPostsRepository.listPosts(filters),
        blogPostsRepository.countPosts(filters)
      ]);

      return {
        posts: posts.map(mapAdminBlogPostListItem),
        pagination: buildPagination({
          page: pagination.page,
          limit: pagination.limit,
          total
        }),
        filters: {
          status: filters.status,
          categoryId: filters.categoryId,
          search: filters.search,
          sort: filters.sort
        }
      };
    },

    async getBlogPost(payload) {
      return loadAdminBlogPostDetail(payload.postId);
    },

    async createBlogPost(payload) {
      const category = ensureBlogCategoryIsActive(
        await ensureBlogCategoryExists(payload.categoryId),
        'Archived blog categories cannot be assigned to posts.'
      );
      const title = normalizeRequiredBlogText(payload.title, 'Blog post title');
      const slug = normalizeBlogSlug(title, payload.slug);
      const body = normalizeBlogPostBody(payload.body);
      const status = payload.status || 'draft';
      const tagIds = Array.isArray(payload.tagIds) ? payload.tagIds : [];
      const publishedAt = status === 'published'
        ? (payload.publishedAt || new Date().toISOString())
        : null;

      await ensureBlogPostSlugIsAvailable(slug);
      await ensureBlogTagIdsAreAssignable(tagIds);

      const post = await blogPostsRepository.createPost({
        categoryId: category.id,
        title,
        slug,
        excerpt: resolveBlogPostExcerpt(body, payload.excerpt),
        body,
        featuredImageUrl: normalizeOptionalText(payload.featuredImageUrl),
        featuredImageAlt: normalizeOptionalText(payload.featuredImageAlt),
        authorDisplayName: normalizeRequiredBlogText(payload.authorDisplayName, 'Author display name'),
        authorAvatarUrl: normalizeOptionalText(payload.authorAvatarUrl),
        readTimeMinutes: computeReadTimeMinutes(body),
        status,
        publishedAt
      });

      if (tagIds.length) {
        await blogPostTagsRepository.replaceTagsForPost(post.id, tagIds);
      }

      await recordAuditLog({
        adminId: payload.adminId,
        action: 'blog_post.created',
        targetType: 'blog_post',
        targetId: post.id,
        detail: {
          categoryId: post.categoryId,
          slug: post.slug,
          status: post.status,
          tagIds
        }
      });

      return loadAdminBlogPostDetail(post.id);
    },

    async updateBlogPost(payload) {
      const existingPost = await ensureBlogPostExists(payload.postId);
      const title = payload.title !== undefined
        ? normalizeRequiredBlogText(payload.title, 'Blog post title')
        : existingPost.title;
      const nextSlug = payload.slug !== undefined
        ? normalizeBlogSlug(title, payload.slug)
        : existingPost.slug;

      if (
        payload.slug !== undefined
        && existingPost.status === 'published'
        && nextSlug !== existingPost.slug
        && !payload.allowSlugOverride
      ) {
        throw new AppError('Published blog post slugs are immutable unless allowSlugOverride is enabled.', {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT
        });
      }

      if (payload.slug !== undefined && nextSlug !== existingPost.slug) {
        await ensureBlogPostSlugIsAvailable(nextSlug, payload.postId);
      }

      let categoryId;

      if (payload.categoryId !== undefined) {
        const category = ensureBlogCategoryIsActive(
          await ensureBlogCategoryExists(payload.categoryId),
          'Archived blog categories cannot be assigned to posts.'
        );

        categoryId = category.id;
      }

      const body = payload.body !== undefined
        ? normalizeBlogPostBody(payload.body)
        : existingPost.body;
      const readTimeMinutes = payload.body !== undefined
        ? computeReadTimeMinutes(body)
        : existingPost.readTimeMinutes;
      let excerpt;

      if (payload.excerpt !== undefined) {
        excerpt = resolveBlogPostExcerpt(body, payload.excerpt);
      } else if (payload.body !== undefined) {
        excerpt = resolveBlogPostExcerpt(body, null);
      }

      if (Array.isArray(payload.tagIds)) {
        await ensureBlogTagIdsAreAssignable(payload.tagIds);
      }

      await blogPostsRepository.updatePost(payload.postId, {
        categoryId,
        title: payload.title !== undefined ? title : undefined,
        slug: payload.slug !== undefined ? nextSlug : undefined,
        excerpt,
        body: payload.body !== undefined ? body : undefined,
        featuredImageUrl: payload.featuredImageUrl !== undefined
          ? normalizeOptionalText(payload.featuredImageUrl)
          : undefined,
        featuredImageAlt: payload.featuredImageAlt !== undefined
          ? normalizeOptionalText(payload.featuredImageAlt)
          : undefined,
        authorDisplayName: payload.authorDisplayName !== undefined
          ? normalizeRequiredBlogText(payload.authorDisplayName, 'Author display name')
          : undefined,
        authorAvatarUrl: payload.authorAvatarUrl !== undefined
          ? normalizeOptionalText(payload.authorAvatarUrl)
          : undefined,
        readTimeMinutes: payload.body !== undefined ? readTimeMinutes : undefined,
        publishedAt: payload.publishedAt !== undefined ? payload.publishedAt : undefined
      });

      if (Array.isArray(payload.tagIds)) {
        await blogPostTagsRepository.replaceTagsForPost(payload.postId, payload.tagIds);
      }

      const updatedPost = await loadAdminBlogPostDetail(payload.postId);

      if (payload.featuredImageUrl !== undefined && existingPost.featuredImageUrl !== updatedPost.featuredImageUrl) {
        await removeStoredBlogImage(env, existingPost.featuredImageUrl);
      }

      await recordAuditLog({
        adminId: payload.adminId,
        action: 'blog_post.updated',
        targetType: 'blog_post',
        targetId: updatedPost.id,
        detail: {
          previousStatus: existingPost.status,
          nextStatus: updatedPost.status,
          slugChanged: existingPost.slug !== updatedPost.slug,
          tagIds: Array.isArray(payload.tagIds)
            ? payload.tagIds
            : updatedPost.tags.map((tag) => tag.id)
        }
      });

      return updatedPost;
    },

    async publishBlogPost(payload) {
      const existingPost = await ensureBlogPostExists(payload.postId);

      ensureBlogCategoryIsActive(
        await ensureBlogCategoryExists(existingPost.categoryId),
        'Archived blog categories cannot be published.'
      );

      const publishedAt = payload.publishedAt || existingPost.publishedAt || new Date().toISOString();

      await blogPostsRepository.updatePost(payload.postId, {
        status: 'published',
        publishedAt
      });

      const post = await loadAdminBlogPostDetail(payload.postId);

      await recordAuditLog({
        adminId: payload.adminId,
        action: 'blog_post.published',
        targetType: 'blog_post',
        targetId: post.id,
        detail: {
          previousStatus: existingPost.status,
          nextStatus: post.status,
          publishedAt: post.publishedAt
        }
      });

      return post;
    },

    async unpublishBlogPost(payload) {
      const existingPost = await ensureBlogPostExists(payload.postId);

      await blogPostsRepository.updatePost(payload.postId, {
        status: 'draft',
        publishedAt: null
      });

      const post = await loadAdminBlogPostDetail(payload.postId);

      await recordAuditLog({
        adminId: payload.adminId,
        action: 'blog_post.unpublished',
        targetType: 'blog_post',
        targetId: post.id,
        detail: {
          previousStatus: existingPost.status,
          nextStatus: post.status
        }
      });

      return post;
    },

    async deleteBlogPost(payload) {
      const existingPost = await ensureBlogPostExists(payload.postId);

      if (existingPost.status === 'archived') {
        throw new AppError('Blog post is already archived.', {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT
        });
      }

      await blogPostsRepository.updatePost(payload.postId, {
        status: 'archived'
      });

      const post = await loadAdminBlogPostDetail(payload.postId);

      await removeStoredBlogImage(env, existingPost.featuredImageUrl);

      await recordAuditLog({
        adminId: payload.adminId,
        action: 'blog_post.archived',
        targetType: 'blog_post',
        targetId: post.id,
        detail: {
          previousStatus: existingPost.status,
          nextStatus: post.status
        }
      });

      return post;
    },

    async listBlogComments(payload) {
      const pagination = normalizePagination(payload.query, {
        defaultLimit: 10,
        maxLimit: 50
      });
      const filters = {
        postId: payload.query.postId || null,
        status: normalizeAdminBlogCommentStatus(payload.query.status),
        search: normalizeSearchTerm(payload.query.search),
        limit: pagination.limit,
        offset: pagination.offset
      };
      const [comments, total] = await Promise.all([
        blogCommentsRepository.listComments(filters),
        blogCommentsRepository.countComments(filters)
      ]);

      return {
        comments: comments.map(mapAdminBlogComment),
        pagination: buildPagination({
          page: pagination.page,
          limit: pagination.limit,
          total
        }),
        filters: {
          postId: filters.postId,
          status: filters.status,
          search: filters.search
        }
      };
    },

    async updateBlogComment(payload) {
      const existingComment = await ensureBlogCommentExists(payload.commentId);

      if (existingComment.status === payload.status) {
        throw new AppError('Blog comment already has this status.', {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT
        });
      }

      const approvedAt = payload.status === BLOG_COMMENT_STATUSES.APPROVED
        ? new Date().toISOString()
        : null;
      const comment = await blogCommentsRepository.updateComment(payload.commentId, {
        status: payload.status,
        approvedAt
      });

      await recordAuditLog({
        adminId: payload.adminId,
        action: 'blog_comment.updated',
        targetType: 'blog_comment',
        targetId: comment.id,
        detail: {
          postId: comment.postId,
          previousStatus: existingComment.status,
          nextStatus: comment.status
        }
      });

      return mapAdminBlogComment(comment);
    },

    async listNewsletterSubscribers(payload) {
      const pagination = normalizePagination(payload.query, {
        defaultLimit: 25,
        maxLimit: 100
      });
      const filters = {
        status: normalizeAdminNewsletterStatus(payload.query.status),
        search: normalizeSearchTerm(payload.query.search),
        limit: pagination.limit,
        offset: pagination.offset
      };
      const [subscribers, total] = await Promise.all([
        newsletterSubscribersRepository.listSubscribers(filters),
        newsletterSubscribersRepository.countSubscribers(filters)
      ]);

      return {
        subscribers: subscribers.map(mapAdminNewsletterSubscriber),
        pagination: buildPagination({
          page: pagination.page,
          limit: pagination.limit,
          total
        }),
        filters: {
          status: filters.status,
          search: filters.search
        }
      };
    },

    async exportNewsletterSubscribersCsv(payload) {
      const filters = {
        status: normalizeAdminNewsletterStatus(payload.query.status),
        search: normalizeSearchTerm(payload.query.search)
      };
      const subscribers = await newsletterSubscribersRepository.listSubscribers(filters);
      const csv = serializeCsvRows([
        { key: 'email', label: 'Email' },
        { key: 'status', label: 'Status' },
        { key: 'subscribedAt', label: 'Subscribed At' },
        { key: 'unsubscribedAt', label: 'Unsubscribed At' },
        { key: 'createdAt', label: 'Created At' }
      ], subscribers.map(mapAdminNewsletterSubscriber));
      const filename = `newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;

      await recordAuditLog({
        adminId: payload.adminId,
        action: 'newsletter_subscribers.exported',
        targetType: 'newsletter_subscriber',
        targetId: null,
        detail: {
          count: subscribers.length,
          filters
        }
      });

      return {
        count: subscribers.length,
        csv,
        filename,
        filters
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

    async getOrder({ orderId }) {
      const order = await ensureOrderExists(orderId);
      const [items, disputes, history] = await Promise.all([
        ordersRepository.findOrderItemsForAdmin(orderId),
        ordersRepository.findLinkedDisputesForAdmin(orderId),
        ordersRepository.findOrderStatusHistoryByOrderIdForAdmin(orderId)
      ]);
      const sellers = [...new Map(items.map((item) => [item.seller.id, item.seller])).values()];
      const deliveryStatuses = [...new Set(items.map((item) => item.delivery?.status || 'not_created'))];
      return {
        ...mapAdminOrder({ ...order, sellers }, history), items,
        deliveryStatus: deliveryStatuses.length === 1 ? deliveryStatuses[0] : deliveryStatuses.length ? 'mixed' : null,
        deliveryAddress: { label: order.deliveryLabel, street: order.deliveryStreet, city: order.deliveryCity,
          state: order.deliveryState, phone: order.deliveryPhone },
        disputeId: disputes[0]?.id || null, disputes
      };
    },

    async reconcilePendingPayments(payload) {
      if (!paymentsService || typeof paymentsService.reconcilePendingPayments !== 'function') {
        throw new AppError('Payment reconciliation is unavailable.', {
          statusCode: 500,
          code: ERROR_CODES.INTERNAL_SERVER_ERROR
        });
      }

      const result = await paymentsService.reconcilePendingPayments({
        limit: payload.limit,
        olderThanMinutes: payload.olderThanMinutes
      });

      await recordAuditLog({
        adminId: payload.adminId,
        action: 'payments.reconciled',
        targetType: 'payment',
        targetId: null,
        detail: {
          checkedCount: result.checkedCount,
          errors: result.errors.length,
          expiredCount: result.expiredCount,
          flaggedCount: result.flaggedCount,
          olderThanMinutes: result.olderThanMinutes,
          pendingCount: result.pendingCount,
          settledCount: result.settledCount,
          unsuccessfulCount: result.unsuccessfulCount
        }
      });

      return result;
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
        sellerId: payload.query.sellerId || null,
        dateFrom: payload.query.dateFrom ? dateEpoch(payload.query.dateFrom) : null,
        dateTo: payload.query.dateTo ? dateEpoch(payload.query.dateTo) + 86400 : null,
        limit: pagination.limit,
        offset: pagination.offset
      };
      const result = await disputesRepository.listDisputesForAdmin(filters);
      const hours = await disputeSlaHours(platformConfigRepository);
      const now = new Date();

      return {
        disputes: result.disputes.map((dispute) => {
          const seller = disputeSeller(dispute);
          return { ...mapAdminDispute(dispute), disputeId: dispute.id, buyerName: dispute.buyer?.fullName || null,
            sellerBusinessName: seller?.businessName || null, openedAt: dispute.createdAt,
            slaRemainingMinutes: disputeSla(dispute, hours, now).remainingMinutes };
        }),
        pagination: buildPagination({
          page: pagination.page,
          limit: pagination.limit,
          total: result.total
        }),
        filters: {
          status: filters.status,
          raisedBy: filters.raisedBy,
          sellerId: filters.sellerId,
          dateFrom: payload.query.dateFrom || null,
          dateTo: payload.query.dateTo || null,
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
