const Joi = require('joi');
const { isValidNigerianPhone } = require('../utils/phone');

function nigerianPhoneRule(value, helpers) {
  if (!isValidNigerianPhone(value)) {
    return helpers.error('string.nigerianPhone');
  }

  return value;
}

const passwordSchema = Joi.string()
  .min(8)
  .max(72)
  .pattern(/[A-Z]/, 'uppercase letter')
  .pattern(/[a-z]/, 'lowercase letter')
  .pattern(/\d/, 'number');

const sellerRegisterSchema = Joi.object({
  body: Joi.object({
    fullName: Joi.string().trim().min(2).max(100).required(),
    email: Joi.string().trim().lowercase().email().optional(),
    phone: Joi.string().trim().custom(nigerianPhoneRule).optional().messages({
      'string.nigerianPhone': 'phone must be a valid Nigerian phone number'
    }),
    password: passwordSchema.required(),
    businessName: Joi.string().trim().min(2).max(160).required(),
    contactEmail: Joi.string().trim().lowercase().email().optional(),
    contactPhone: Joi.string().trim().custom(nigerianPhoneRule).optional().messages({
      'string.nigerianPhone': 'contactPhone must be a valid Nigerian phone number'
    }),
    address: Joi.string().trim().min(10).max(500).required(),
    cacNumber: Joi.string().trim().min(5).max(100).required()
  }).or('email', 'phone').required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const sellerDocumentsUploadSchema = Joi.object({
  body: Joi.object({}).required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const sellerCacVerificationRetrySchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

module.exports = {
  sellerCacVerificationRetrySchema,
  sellerDocumentsUploadSchema,
  sellerRegisterSchema
};
