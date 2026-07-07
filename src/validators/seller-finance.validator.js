const Joi = require('joi');
const { PAYOUT_STATUSES } = require('../config/constants');

const dateOnlySchema = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/);

const sellerSalesSummarySchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: Joi.object({
    dateFrom: dateOnlySchema.optional(),
    dateTo: dateOnlySchema.optional()
  }).and('dateFrom', 'dateTo').custom((value, helpers) => {
    if (value.dateFrom && value.dateTo && value.dateFrom > value.dateTo) {
      return helpers.error('any.invalid');
    }

    return value;
  }).messages({
    'any.invalid': 'dateTo must be greater than or equal to dateFrom'
  }).default({})
});

const createSellerPayoutSchema = Joi.object({
  body: Joi.object({
    bankAccountRef: Joi.string().trim().min(3).max(255).required()
  }).required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const listSellerPayoutsSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: Joi.object({
    status: Joi.string()
      .valid(...Object.values(PAYOUT_STATUSES))
      .optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(10)
  }).default({})
});

module.exports = {
  createSellerPayoutSchema,
  listSellerPayoutsSchema,
  sellerSalesSummarySchema
};
