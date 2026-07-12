const Joi = require('joi');
const {
  CATEGORY_STATUSES,
  DISPUTE_RAISED_BY,
  DISPUTE_STATUSES,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
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

const adminDisputeStatuses = [
  'all',
  ...Object.values(DISPUTE_STATUSES)
];

const adminDisputeRaisedByValues = [
  'all',
  ...Object.values(DISPUTE_RAISED_BY)
];

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
  query: Joi.object({
    status: Joi.string()
      .valid(...queueStatuses)
      .default(SELLER_VERIFICATION_STATUSES.PENDING),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(10)
  }).default({})
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

const listUsersSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: Joi.object({
    role: Joi.string().valid(...managedUserRoles).default('all'),
    status: Joi.string().valid(...managedUserStatuses).default('all'),
    search: Joi.string().trim().max(120).allow('', null).optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(10)
  }).default({})
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
  query: Joi.object({
    status: Joi.string().valid(...adminOrderStatuses).default('all'),
    paymentStatus: Joi.string().valid(...adminPaymentStatuses).default('all'),
    search: Joi.string().trim().max(120).allow('', null).optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(10)
  }).default({})
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
  query: Joi.object({
    status: Joi.string().valid(...adminPayoutStatuses).default('all'),
    sellerId: Joi.number().integer().positive().optional(),
    search: Joi.string().trim().max(120).allow('', null).optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(10)
  }).default({})
});

const listAdminDisputesSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: Joi.object({
    status: Joi.string().valid(...adminDisputeStatuses).default('all'),
    raisedBy: Joi.string().valid(...adminDisputeRaisedByValues).default('all'),
    search: Joi.string().trim().max(120).allow('', null).optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(10)
  }).default({})
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
  query: Joi.object({
    adminId: Joi.number().integer().positive().optional(),
    action: Joi.string().trim().min(3).max(120).optional(),
    targetType: Joi.string().trim().min(3).max(120).optional(),
    targetId: Joi.number().integer().positive().optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(10)
  }).default({})
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
  query: Joi.object({
    make: Joi.string().trim().min(2).max(80).optional(),
    model: Joi.string().trim().min(1).max(80).optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(10)
  }).default({})
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
  createCategorySchema,
  createVehicleTaxonomySchema,
  deleteCategorySchema,
  deleteVehicleTaxonomySchema,
  getAdminDashboardSchema,
  getCategorySchema,
  getPlatformConfigSchema,
  getSellerVerificationCandidateSchema,
  listAdminOrdersSchema,
  listAdminDisputesSchema,
  listAdminPayoutsSchema,
  listAuditLogsSchema,
  getVehicleTaxonomySchema,
  listCategoriesSchema,
  listSellerVerificationQueueSchema,
  listUsersSchema,
  listVehicleTaxonomySchema,
  updateAdminDisputeSchema,
  updateAdminOrderStatusSchema,
  updateAdminPayoutStatusSchema,
  updateCategorySchema,
  updatePlatformConfigSchema,
  updateSellerVerificationStatusSchema,
  updateUserStatusSchema,
  updateVehicleTaxonomySchema
};
