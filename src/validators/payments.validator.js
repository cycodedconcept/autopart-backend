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

const verifyPaymentCallbackSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: Joi.object({
    reference: Joi.string().trim().min(6).optional(),
    trxref: Joi.string().trim().min(6).optional()
  }).or('reference', 'trxref').required()
});

const paystackWebhookSchema = Joi.object({
  body: Joi.object({
    event: Joi.string().trim().required(),
    data: Joi.object().required().unknown(true)
  }).required().unknown(true),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

module.exports = {
  initializePaymentSchema,
  paystackWebhookSchema,
  verifyPaymentCallbackSchema
};
