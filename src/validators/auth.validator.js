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

const registerSchema = Joi.object({
  body: Joi.object({
    fullName: Joi.string().trim().min(2).max(100).required(),
    email: Joi.string().trim().lowercase().email().optional(),
    phone: Joi.string().trim().custom(nigerianPhoneRule).optional().messages({
      'string.nigerianPhone': 'phone must be a valid Nigerian phone number'
    }),
    password: passwordSchema.required()
  }).or('email', 'phone').required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const loginSchema = Joi.object({
  body: Joi.object({
    identifier: Joi.string().trim().min(5).optional(),
    email: Joi.string().trim().lowercase().email().optional(),
    phone: Joi.string().trim().custom(nigerianPhoneRule).optional().messages({
      'string.nigerianPhone': 'phone must be a valid Nigerian phone number'
    }),
    password: passwordSchema.required()
  }).or('identifier', 'email', 'phone').required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const forgotPasswordSchema = Joi.object({
  body: Joi.object({
    identifier: Joi.string().trim().min(5).optional(),
    email: Joi.string().trim().lowercase().email().optional(),
    phone: Joi.string().trim().custom(nigerianPhoneRule).optional().messages({
      'string.nigerianPhone': 'phone must be a valid Nigerian phone number'
    })
  }).or('identifier', 'email', 'phone').required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const resetPasswordSchema = Joi.object({
  body: Joi.object({
    token: Joi.string().trim().length(64).required(),
    newPassword: passwordSchema.required()
  }).required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const changePasswordSchema = Joi.object({
  body: Joi.object({
    currentPassword: Joi.string().min(8).max(72).required(),
    newPassword: passwordSchema.invalid(Joi.ref('currentPassword')).required().messages({
      'any.invalid': 'newPassword must be different from currentPassword'
    })
  }).required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

module.exports = {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  registerSchema
};
