const Joi = require('joi');
const { ORDER_STATUSES, PAYMENT_METHODS } = require('../config/constants');
const { isValidNigerianPhone } = require('../utils/phone');

function nigerianPhoneRule(value, helpers) {
  if (!isValidNigerianPhone(value)) {
    return helpers.error('string.nigerianPhone');
  }

  return value;
}

const createOrderSchema = Joi.object({
  body: Joi.object({
    paymentMethod: Joi.string()
      .valid(PAYMENT_METHODS.PAYSTACK, PAYMENT_METHODS.BANK_TRANSFER, PAYMENT_METHODS.USSD)
      .required(),
    deliveryAddressId: Joi.number().integer().positive().optional(),
    deliveryAddress: Joi.object({
      label: Joi.string().trim().min(1).max(100).required(),
      street: Joi.string().trim().min(3).max(255).required(),
      city: Joi.string().trim().min(2).max(120).required(),
      state: Joi.string().trim().min(2).max(120).required(),
      phone: Joi.string().trim().custom(nigerianPhoneRule).required().messages({
        'string.nigerianPhone': 'deliveryAddress.phone must be a valid Nigerian phone number'
      })
    }).optional()
  }).xor('deliveryAddressId', 'deliveryAddress').required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const orderIdParamsSchema = Joi.object({
  id: Joi.number().integer().positive().required()
}).required();

const listOrdersSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: Joi.object({
    status: Joi.string()
      .valid(...Object.values(ORDER_STATUSES))
      .optional(),
    page: Joi.number().integer().positive().optional(),
    limit: Joi.number().integer().positive().max(50).optional()
  }).default({})
});

const getOrderByIdSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: orderIdParamsSchema,
  query: Joi.object({}).default({})
});

const getOrderStatusSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: orderIdParamsSchema,
  query: Joi.object({}).default({})
});

const getOrderReceiptSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: orderIdParamsSchema,
  query: Joi.object({
    format: Joi.string().valid('json', 'html').optional()
  }).default({})
});

module.exports = {
  createOrderSchema,
  getOrderByIdSchema,
  getOrderReceiptSchema,
  getOrderStatusSchema,
  listOrdersSchema
};
