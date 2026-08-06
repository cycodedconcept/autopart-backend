const Joi = require('joi');
const { buildPaginationQuerySchema } = require('./pagination.validator');

const listProductsSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: buildPaginationQuerySchema({
    partName: Joi.string().trim().min(1).optional(),
    vehicleMake: Joi.string().trim().min(1).optional(),
    vehicleModel: Joi.string().trim().min(1).optional(),
    vehicleYear: Joi.number().integer().min(1900).max(2100).optional(),
    category: Joi.alternatives().try(
      Joi.number().integer().positive(),
      Joi.string().trim().min(1)
    ).optional(),
    partNumber: Joi.string().trim().min(1).optional(),
    condition: Joi.string().valid('new', 'used', 'OEM').optional(),
    minPriceKobo: Joi.number().integer().min(0).optional(),
    maxPriceKobo: Joi.number().integer().min(Joi.ref('minPriceKobo')).optional().messages({
      'number.min': 'maxPriceKobo must be greater than or equal to minPriceKobo'
    }),
    location: Joi.string().trim().min(1).optional(),
    sellerRating: Joi.number().min(0).max(5).optional(),
    sellerBusinessName: Joi.string().trim().min(1).optional()
  })
});

const getProductByIdSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }).required(),
  query: Joi.object({}).default({})
});

module.exports = {
  getProductByIdSchema,
  listProductsSchema
};
