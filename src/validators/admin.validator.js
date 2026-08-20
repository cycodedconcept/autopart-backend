const Joi = require('joi');
const { buildPaginationQuerySchema } = require('./pagination.validator');
const {
  BLOG_COMMENT_STATUSES,
  CATEGORY_STATUSES,
  DISPUTE_RAISED_BY,
  DISPUTE_STATUSES,
  NEWSLETTER_SUBSCRIBER_STATUSES,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  PAYOUT_PAYEE_TYPES,
  PAYOUT_STATUSES,
  SELLER_VERIFICATION_STATUSES,
  USER_ACCOUNT_STATUSES,
  USER_ROLES
} = require('../config/constants');

const queueStatuses = [
  'all',
  SELLER_VERIFICATION_STATUSES.PENDING,
  SELLER_VERIFICATION_STATUSES.VERIFIED,
  SELLER_VERIFICATION_STATUSES.REJECTED
];

const categoryStatuses = [
  'all',
  CATEGORY_STATUSES.ACTIVE,
  CATEGORY_STATUSES.ARCHIVED
];

const managedUserRoles = [
  'all',
  USER_ROLES.BUYER,
  USER_ROLES.SELLER
];

const managedUserStatuses = [
  'all',
  USER_ACCOUNT_STATUSES.ACTIVE,
  USER_ACCOUNT_STATUSES.SUSPENDED,
  USER_ACCOUNT_STATUSES.BANNED
];

const adminOrderStatuses = [
  'all',
  ...Object.values(ORDER_STATUSES)
];

const adminPaymentStatuses = [
  'all',
  ...Object.values(PAYMENT_STATUSES)
];

const adminPayoutStatuses = [
  'all',
  ...Object.values(PAYOUT_STATUSES)
];

const adminPayoutPayeeTypes = [
  'all',
  ...Object.values(PAYOUT_PAYEE_TYPES)
];

const adminDisputeStatuses = [
  'all',
  ...Object.values(DISPUTE_STATUSES)
];

const adminDisputeRaisedByValues = [
  'all',
  ...Object.values(DISPUTE_RAISED_BY)
];
const adminBlogPostStatuses = ['all', 'draft', 'published', 'archived'];
const adminBlogCategoryStatuses = ['all', ...Object.values(CATEGORY_STATUSES)];
const adminBlogTagStatuses = ['all', ...Object.values(CATEGORY_STATUSES)];
const adminBlogCommentStatuses = ['all', ...Object.values(BLOG_COMMENT_STATUSES)];
const adminNewsletterStatuses = ['all', ...Object.values(NEWSLETTER_SUBSCRIBER_STATUSES)];
const adminBlogSortValues = ['latest', 'oldest', 'title_asc'];

const adminLoginSchema = Joi.object({
  body: Joi.object({
    email: Joi.string().trim().lowercase().email({
      tlds: {
        allow: false
      }
    }).required(),
    password: Joi.string().min(8).max(72).required()
  }).required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const getAdminDashboardSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const listSellerVerificationQueueSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: buildPaginationQuerySchema({
    status: Joi.string()
      .valid(...queueStatuses)
      .default(SELLER_VERIFICATION_STATUSES.PENDING)
  })
});

const getSellerVerificationCandidateSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }).required(),
  query: Joi.object({}).default({})
});

const updateSellerVerificationStatusSchema = Joi.object({
  body: Joi.object({
    verificationStatus: Joi.string()
      .valid(
        SELLER_VERIFICATION_STATUSES.VERIFIED,
        SELLER_VERIFICATION_STATUSES.REJECTED
      )
      .required(),
    rejectionReason: Joi.when('verificationStatus', {
      is: SELLER_VERIFICATION_STATUSES.REJECTED,
      then: Joi.string().trim().min(5).max(255).required(),
      otherwise: Joi.string().trim().max(255).optional().allow('', null)
    })
  }).required(),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }).required(),
  query: Joi.object({}).default({})
});

const listCategoriesSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: Joi.object({
    status: Joi.string()
      .valid(...categoryStatuses)
      .default('all')
  }).default({})
});

const getCategorySchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }).required(),
  query: Joi.object({}).default({})
});

const createCategorySchema = Joi.object({
  body: Joi.object({
    name: Joi.string().trim().min(2).max(120).required(),
    slug: Joi.string().trim().min(2).max(140).optional(),
    parentId: Joi.number().integer().positive().allow(null).optional()
  }).required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const updateCategorySchema = Joi.object({
  body: Joi.object({
    name: Joi.string().trim().min(2).max(120).optional(),
    slug: Joi.string().trim().min(2).max(140).optional(),
    parentId: Joi.number().integer().positive().allow(null).optional(),
    status: Joi.string().valid(...Object.values(CATEGORY_STATUSES)).optional()
  }).or('name', 'slug', 'parentId', 'status').required(),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }).required(),
  query: Joi.object({}).default({})
});

const deleteCategorySchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }).required(),
  query: Joi.object({}).default({})
});

const listAdminBlogCategoriesSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: Joi.object({
    status: Joi.string().valid(...adminBlogCategoryStatuses).default('all'),
    search: Joi.string().trim().max(120).allow('', null).optional()
  }).default({})
});

const getAdminBlogCategorySchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }).required(),
  query: Joi.object({}).default({})
});

const createAdminBlogCategorySchema = Joi.object({
  body: Joi.object({
    name: Joi.string().trim().min(2).max(120).required(),
    slug: Joi.string().trim().min(2).max(140).optional(),
    description: Joi.string().trim().max(255).allow('', null).optional(),
    status: Joi.string().valid(...Object.values(CATEGORY_STATUSES)).optional()
  }).required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const updateAdminBlogCategorySchema = Joi.object({
  body: Joi.object({
    name: Joi.string().trim().min(2).max(120).optional(),
    slug: Joi.string().trim().min(2).max(140).optional(),
    description: Joi.string().trim().max(255).allow('', null).optional(),
    status: Joi.string().valid(...Object.values(CATEGORY_STATUSES)).optional()
  }).or('name', 'slug', 'description', 'status').required(),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }).required(),
  query: Joi.object({}).default({})
});

const deleteAdminBlogCategorySchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }).required(),
  query: Joi.object({}).default({})
});

const listAdminBlogTagsSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: Joi.object({
    status: Joi.string().valid(...adminBlogTagStatuses).default('all'),
    search: Joi.string().trim().max(120).allow('', null).optional()
  }).default({})
});

const getAdminBlogTagSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }).required(),
  query: Joi.object({}).default({})
});

const createAdminBlogTagSchema = Joi.object({
  body: Joi.object({
    name: Joi.string().trim().min(2).max(80).required(),
    slug: Joi.string().trim().min(2).max(120).optional(),
    status: Joi.string().valid(...Object.values(CATEGORY_STATUSES)).optional()
  }).required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const updateAdminBlogTagSchema = Joi.object({
  body: Joi.object({
    name: Joi.string().trim().min(2).max(80).optional(),
    slug: Joi.string().trim().min(2).max(120).optional(),
    status: Joi.string().valid(...Object.values(CATEGORY_STATUSES)).optional()
  }).or('name', 'slug', 'status').required(),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }).required(),
  query: Joi.object({}).default({})
});

const deleteAdminBlogTagSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }).required(),
  query: Joi.object({}).default({})
});

const listAdminBlogPostsSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: buildPaginationQuerySchema({
    status: Joi.string().valid(...adminBlogPostStatuses).default('all'),
    categoryId: Joi.number().integer().positive().optional(),
    search: Joi.string().trim().max(160).allow('', null).optional(),
    sort: Joi.string().valid(...adminBlogSortValues).default('latest')
  })
});

const getAdminBlogPostSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }).required(),
  query: Joi.object({}).default({})
});

const createAdminBlogPostSchema = Joi.object({
  body: Joi.object({
    categoryId: Joi.number().integer().positive().required(),
    title: Joi.string().trim().min(5).max(180).required(),
    slug: Joi.string().trim().min(2).max(220).optional(),
    excerpt: Joi.string().trim().max(500).allow('', null).optional(),
    body: Joi.string().trim().min(20).required(),
    featuredImageUrl: Joi.string().trim().uri().max(2048).allow('', null).optional(),
    featuredImageAlt: Joi.string().trim().max(255).allow('', null).optional(),
    authorDisplayName: Joi.string().trim().min(2).max(120).required(),
    authorAvatarUrl: Joi.string().trim().uri().max(2048).allow('', null).optional(),
    status: Joi.string().valid('draft', 'published', 'archived').optional(),
    publishedAt: Joi.date().iso().allow(null).optional(),
    tagIds: Joi.array().items(Joi.number().integer().positive()).unique().optional()
  }).required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const updateAdminBlogPostSchema = Joi.object({
  body: Joi.object({
    categoryId: Joi.number().integer().positive().optional(),
    title: Joi.string().trim().min(5).max(180).optional(),
    slug: Joi.string().trim().min(2).max(220).optional(),
    excerpt: Joi.string().trim().max(500).allow('', null).optional(),
    body: Joi.string().trim().min(20).optional(),
    featuredImageUrl: Joi.string().trim().uri().max(2048).allow('', null).optional(),
    featuredImageAlt: Joi.string().trim().max(255).allow('', null).optional(),
    authorDisplayName: Joi.string().trim().min(2).max(120).optional(),
    authorAvatarUrl: Joi.string().trim().uri().max(2048).allow('', null).optional(),
    publishedAt: Joi.date().iso().allow(null).optional(),
    tagIds: Joi.array().items(Joi.number().integer().positive()).unique().optional(),
    allowSlugOverride: Joi.boolean().optional()
  }).or(
    'categoryId',
    'title',
    'slug',
    'excerpt',
    'body',
    'featuredImageUrl',
    'featuredImageAlt',
    'authorDisplayName',
    'authorAvatarUrl',
    'publishedAt',
    'tagIds',
    'allowSlugOverride'
  ).required(),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }).required(),
  query: Joi.object({}).default({})
});

const publishAdminBlogPostSchema = Joi.object({
  body: Joi.object({
    publishedAt: Joi.date().iso().allow(null).optional()
  }).default({}),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }).required(),
  query: Joi.object({}).default({})
});

const unpublishAdminBlogPostSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }).required(),
  query: Joi.object({}).default({})
});

const deleteAdminBlogPostSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }).required(),
  query: Joi.object({}).default({})
});

const listAdminBlogCommentsSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: buildPaginationQuerySchema({
    postId: Joi.number().integer().positive().optional(),
    status: Joi.string().valid(...adminBlogCommentStatuses).default('all'),
    search: Joi.string().trim().max(160).allow('', null).optional()
  })
});

const updateAdminBlogCommentSchema = Joi.object({
  body: Joi.object({
    status: Joi.string()
      .valid(
        BLOG_COMMENT_STATUSES.PENDING,
        BLOG_COMMENT_STATUSES.APPROVED,
        BLOG_COMMENT_STATUSES.SPAM,
        BLOG_COMMENT_STATUSES.DELETED
      )
      .required()
  }).required(),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }).required(),
  query: Joi.object({}).default({})
});

const listAdminNewsletterSubscribersSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: buildPaginationQuerySchema({
    status: Joi.string().valid(...adminNewsletterStatuses).default('all'),
    search: Joi.string().trim().max(160).allow('', null).optional()
  })
});

const exportAdminNewsletterSubscribersSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: Joi.object({
    status: Joi.string().valid(...adminNewsletterStatuses).default('all'),
    search: Joi.string().trim().max(160).allow('', null).optional()
  }).default({})
});

const listUsersSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: buildPaginationQuerySchema({
    role: Joi.string().valid(...managedUserRoles).default('all'),
    status: Joi.string().valid(...managedUserStatuses).default('all'),
    search: Joi.string().trim().max(120).allow('', null).optional()
  })
});

const updateUserStatusSchema = Joi.object({
  body: Joi.object({
    status: Joi.string()
      .valid(
        USER_ACCOUNT_STATUSES.ACTIVE,
        USER_ACCOUNT_STATUSES.SUSPENDED,
        USER_ACCOUNT_STATUSES.BANNED
      )
      .required()
  }).required(),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }).required(),
  query: Joi.object({}).default({})
});

const listAdminOrdersSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: buildPaginationQuerySchema({
    status: Joi.string().valid(...adminOrderStatuses).default('all'),
    paymentStatus: Joi.string().valid(...adminPaymentStatuses).default('all'),
    search: Joi.string().trim().max(120).allow('', null).optional()
  })
});

const reconcilePendingPaymentsSchema = Joi.object({
  body: Joi.object({
    olderThanMinutes: Joi.number().integer().min(1).max(1440).optional(),
    limit: Joi.number().integer().min(1).max(100).optional()
  }).default({}),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const updateAdminOrderStatusSchema = Joi.object({
  body: Joi.object({
    status: Joi.string()
      .valid(...Object.values(ORDER_STATUSES))
      .required(),
    note: Joi.string().trim().min(5).max(255).optional()
  }).required(),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }).required(),
  query: Joi.object({}).default({})
});

const listAdminPayoutsSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: buildPaginationQuerySchema({
    payeeType: Joi.string().valid(...adminPayoutPayeeTypes).default('all'),
    status: Joi.string().valid(...adminPayoutStatuses).default('all'),
    sellerId: Joi.number().integer().positive().optional(),
    companyId: Joi.number().integer().positive().optional(),
    search: Joi.string().trim().max(120).allow('', null).optional()
  })
});

const listAdminDisputesSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: buildPaginationQuerySchema({
    status: Joi.string().valid(...adminDisputeStatuses).default('all'),
    raisedBy: Joi.string().valid(...adminDisputeRaisedByValues).default('all'),
    search: Joi.string().trim().max(120).allow('', null).optional()
  })
});

const updateAdminPayoutStatusSchema = Joi.object({
  body: Joi.object({
    status: Joi.string()
      .valid(
        PAYOUT_STATUSES.APPROVED,
        PAYOUT_STATUSES.REJECTED,
        PAYOUT_STATUSES.PAID
      )
      .required(),
    rejectionReason: Joi.when('status', {
      is: PAYOUT_STATUSES.REJECTED,
      then: Joi.string().trim().min(5).max(255).required(),
      otherwise: Joi.string().trim().max(255).optional().allow('', null)
    })
  }).required(),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }).required(),
  query: Joi.object({}).default({})
});

const updateAdminDisputeSchema = Joi.object({
  body: Joi.object({
    status: Joi.string()
      .valid(
        DISPUTE_STATUSES.RESOLVED,
        DISPUTE_STATUSES.REJECTED
      )
      .required(),
    resolutionNote: Joi.string().trim().min(5).max(500).required(),
    refundReference: Joi.when('status', {
      is: DISPUTE_STATUSES.RESOLVED,
      then: Joi.string().trim().min(3).max(255).optional(),
      otherwise: Joi.forbidden()
    }),
    refundAmountKobo: Joi.when('status', {
      is: DISPUTE_STATUSES.RESOLVED,
      then: Joi.number().integer().min(1).optional(),
      otherwise: Joi.forbidden()
    })
  }).and('refundReference', 'refundAmountKobo').required(),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }).required(),
  query: Joi.object({}).default({})
});

const getPlatformConfigSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const listAuditLogsSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: buildPaginationQuerySchema({
    adminId: Joi.number().integer().positive().optional(),
    action: Joi.string().trim().min(3).max(120).optional(),
    targetType: Joi.string().trim().min(3).max(120).optional(),
    targetId: Joi.number().integer().positive().optional()
  })
});

const updatePlatformConfigSchema = Joi.object({
  body: Joi.object({
    commissionRateDefault: Joi.number().integer().min(0).max(100).optional(),
    commissionRatesByCategory: Joi.array()
      .items(Joi.object({
        categoryId: Joi.number().integer().positive().required(),
        ratePercent: Joi.number().integer().min(0).max(100).required()
      }))
      .unique('categoryId')
      .optional(),
    commissionRatesBySellerTier: Joi.array()
      .items(Joi.object({
        tier: Joi.string().trim().min(2).max(60).required(),
        ratePercent: Joi.number().integer().min(0).max(100).required()
      }))
      .unique('tier')
      .optional(),
    platformSettings: Joi.object().unknown(true).optional()
  }).or(
    'commissionRateDefault',
    'commissionRatesByCategory',
    'commissionRatesBySellerTier',
    'platformSettings'
  ).required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const listVehicleTaxonomySchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: buildPaginationQuerySchema({
    make: Joi.string().trim().min(2).max(80).optional(),
    model: Joi.string().trim().min(1).max(80).optional()
  })
});

const getVehicleTaxonomySchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }).required(),
  query: Joi.object({}).default({})
});

const createVehicleTaxonomySchema = Joi.object({
  body: Joi.object({
    make: Joi.string().trim().min(2).max(80).required(),
    model: Joi.string().trim().min(1).max(80).required(),
    yearFrom: Joi.number().integer().min(1900).max(2100).required(),
    yearTo: Joi.number().integer().min(1900).max(2100).required()
  }).required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const updateVehicleTaxonomySchema = Joi.object({
  body: Joi.object({
    make: Joi.string().trim().min(2).max(80).optional(),
    model: Joi.string().trim().min(1).max(80).optional(),
    yearFrom: Joi.number().integer().min(1900).max(2100).optional(),
    yearTo: Joi.number().integer().min(1900).max(2100).optional()
  }).or('make', 'model', 'yearFrom', 'yearTo').required(),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }).required(),
  query: Joi.object({}).default({})
});

const deleteVehicleTaxonomySchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }).required(),
  query: Joi.object({}).default({})
});

module.exports = {
  adminLoginSchema,
  createAdminBlogCategorySchema,
  createAdminBlogPostSchema,
  createAdminBlogTagSchema,
  createCategorySchema,
  createVehicleTaxonomySchema,
  deleteAdminBlogCategorySchema,
  deleteAdminBlogPostSchema,
  deleteAdminBlogTagSchema,
  deleteCategorySchema,
  deleteVehicleTaxonomySchema,
  exportAdminNewsletterSubscribersSchema,
  getAdminDashboardSchema,
  getAdminBlogCategorySchema,
  getAdminBlogPostSchema,
  getAdminBlogTagSchema,
  getCategorySchema,
  getPlatformConfigSchema,
  getSellerVerificationCandidateSchema,
  listAdminBlogCategoriesSchema,
  listAdminBlogCommentsSchema,
  listAdminBlogPostsSchema,
  listAdminBlogTagsSchema,
  listAdminDisputesSchema,
  listAdminNewsletterSubscribersSchema,
  listAdminOrdersSchema,
  listAdminPayoutsSchema,
  listAuditLogsSchema,
  publishAdminBlogPostSchema,
  reconcilePendingPaymentsSchema,
  getVehicleTaxonomySchema,
  listCategoriesSchema,
  listSellerVerificationQueueSchema,
  listUsersSchema,
  listVehicleTaxonomySchema,
  unpublishAdminBlogPostSchema,
  updateAdminBlogCategorySchema,
  updateAdminBlogCommentSchema,
  updateAdminBlogPostSchema,
  updateAdminBlogTagSchema,
  updateAdminDisputeSchema,
  updateAdminOrderStatusSchema,
  updateAdminPayoutStatusSchema,
  updateCategorySchema,
  updatePlatformConfigSchema,
  updateSellerVerificationStatusSchema,
  updateUserStatusSchema,
  updateVehicleTaxonomySchema
};
