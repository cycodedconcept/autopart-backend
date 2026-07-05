const Joi = require('joi');

const sellerInventoryCsvRowSchema = Joi.object({
  title: Joi.string().trim().min(3).max(255).required(),
  description: Joi.string().trim().min(10).max(5000).required(),
  categoryId: Joi.number().integer().positive().required(),
  partNumber: Joi.string().trim().min(2).max(100).required(),
  condition: Joi.string().valid('new', 'used', 'refurbished').required(),
  priceKobo: Joi.number().integer().min(0).required(),
  stockQty: Joi.number().integer().min(0).required(),
  location: Joi.string().trim().min(2).max(120).required(),
  status: Joi.string().valid('active', 'inactive').default('active'),
  compatibleMake: Joi.string().trim().min(1).max(80).required(),
  compatibleModel: Joi.string().trim().min(1).max(80).required(),
  compatibleYearFrom: Joi.number().integer().min(1900).max(2100).required(),
  compatibleYearTo: Joi.number().integer().min(Joi.ref('compatibleYearFrom')).max(2100).required()
    .messages({
      'number.min': 'compatibleYearTo must be greater than or equal to compatibleYearFrom'
    }),
  imageUrls: Joi.string().trim().min(1).required()
}).required();

const listSellerInventorySchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: Joi.object({
    status: Joi.string().valid('all', 'active', 'inactive').default('all'),
    lowStockOnly: Joi.boolean().truthy('true').truthy('1').falsy('false').falsy('0').default(false),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(10)
  }).default({})
});

const bulkUploadSellerInventorySchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

module.exports = {
  bulkUploadSellerInventorySchema,
  listSellerInventorySchema,
  sellerInventoryCsvRowSchema
};
