const Joi = require('joi');
const { buildPaginationQuerySchema } = require('./pagination.validator');

const compatibilityEntrySchema = Joi.object({
  make: Joi.string().trim().min(1).max(80).required(),
  model: Joi.string().trim().min(1).max(80).required(),
  yearFrom: Joi.number().integer().min(1900).max(2100).required(),
  yearTo: Joi.number().integer().min(Joi.ref('yearFrom')).max(2100).required().messages({
    'number.min': 'yearTo must be greater than or equal to yearFrom'
  })
});

const createSellerProductSchema = Joi.object({
  body: Joi.object({
    title: Joi.string().trim().min(3).max(255).required(),
    description: Joi.string().trim().min(10).max(5000).required(),
    categoryId: Joi.number().integer().positive().required(),
    partNumber: Joi.string().trim().min(2).max(100).required(),
    condition: Joi.string().valid('new', 'used', 'refurbished').required(),
    priceKobo: Joi.number().integer().min(0).required(),
    stockQty: Joi.number().integer().min(0).required(),
    location: Joi.string().trim().min(2).max(120).required(),
    status: Joi.string().valid('active', 'inactive').default('active'),
    compatibility: Joi.array().items(compatibilityEntrySchema).min(1).required()
  }).required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const updateSellerProductSchema = Joi.object({
  body: Joi.object({
    title: Joi.string().trim().min(3).max(255).optional(),
    description: Joi.string().trim().min(10).max(5000).optional(),
    categoryId: Joi.number().integer().positive().optional(),
    partNumber: Joi.string().trim().min(2).max(100).optional(),
    condition: Joi.string().valid('new', 'used', 'refurbished').optional(),
    priceKobo: Joi.number().integer().min(0).optional(),
    stockQty: Joi.number().integer().min(0).optional(),
    location: Joi.string().trim().min(2).max(120).optional(),
    status: Joi.string().valid('active', 'inactive').optional(),
    compatibility: Joi.array().items(compatibilityEntrySchema).min(1).optional()
  }).required(),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }).required(),
  query: Joi.object({}).default({})
});

const listSellerProductsSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: buildPaginationQuerySchema({
    status: Joi.string().valid('all', 'active', 'inactive').default('all')
  })
});

const deleteSellerProductSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }).required(),
  query: Joi.object({}).default({})
});

module.exports = {
  createSellerProductSchema,
  deleteSellerProductSchema,
  listSellerProductsSchema,
  updateSellerProductSchema
};
