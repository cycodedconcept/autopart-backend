const Joi = require('joi');

const initializePaymentSchema = Joi.object({
  body: Joi.object({
    orderId: Joi.number().integer().positive().required(),
    email: Joi.string().trim().email().optional(),
    callbackUrl: Joi.string().trim().max(2048).optional()
  }).required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const verifyPaymentSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({
    reference: Joi.string().trim().min(6).required()
  }).required(),
  query: Joi.object({}).default({})
});

const verifyPaymentCallbackSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: Joi.object({
    reference: Joi.string().trim().min(6).optional(),
    trxref: Joi.string().trim().min(6).optional()
  }).or('reference', 'trxref').required()
});

module.exports = {
  initializePaymentSchema,
  verifyPaymentSchema,
  verifyPaymentCallbackSchema
};
