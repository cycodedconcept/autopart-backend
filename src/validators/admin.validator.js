const Joi = require('joi');
const { SELLER_VERIFICATION_STATUSES } = require('../config/constants');

const queueStatuses = [
  'all',
  SELLER_VERIFICATION_STATUSES.PENDING,
  SELLER_VERIFICATION_STATUSES.VERIFIED,
  SELLER_VERIFICATION_STATUSES.REJECTED
];

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

module.exports = {
  listSellerVerificationQueueSchema,
  updateSellerVerificationStatusSchema
};
