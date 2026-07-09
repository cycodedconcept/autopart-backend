const Joi = require('joi');
const { SELLER_VERIFICATION_STATUSES } = require('../config/constants');

const queueStatuses = [
  'all',
  SELLER_VERIFICATION_STATUSES.PENDING,
  SELLER_VERIFICATION_STATUSES.VERIFIED,
  SELLER_VERIFICATION_STATUSES.REJECTED
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
  query: Joi.object({}).default({})
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
    parentId: Joi.number().integer().positive().allow(null).optional()
  }).or('name', 'slug', 'parentId').required(),
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
  getCategorySchema,
  getSellerVerificationCandidateSchema,
  getVehicleTaxonomySchema,
  listCategoriesSchema,
  listSellerVerificationQueueSchema,
  listVehicleTaxonomySchema,
  updateCategorySchema,
  updateSellerVerificationStatusSchema,
  updateVehicleTaxonomySchema
};
