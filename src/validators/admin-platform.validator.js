const Joi = require('joi');

const dateOnly = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).custom((value, helpers) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value
    ? helpers.message('Date must be a valid YYYY-MM-DD date.') : value;
});

const platformAnalyticsSchema = Joi.object({
  body: Joi.object({}).default({}), params: Joi.object({}).default({}),
  query: Joi.object({
    period: Joi.string().valid('7d', '30d', '90d', '1y').default('30d'),
    topSellersLimit: Joi.number().integer().min(1).max(20).default(5)
  }).default({})
});

const adminDetailSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({ id: Joi.number().integer().positive().required() }).required(),
  query: Joi.object({}).default({})
});

const disputeStatsSchema = Joi.object({
  body: Joi.object({}).default({}), params: Joi.object({}).default({}), query: Joi.object({}).default({})
});

function actionSchema(fields) {
  return Joi.object({
    body: Joi.object(fields).required(),
    params: Joi.object({ id: Joi.number().integer().positive().required() }).required(),
    query: Joi.object({}).default({})
  });
}

const requestDisputeInfoSchema = actionSchema({
  message: Joi.string().trim().min(1).max(5000).required(),
  requestedFrom: Joi.string().valid('buyer', 'seller', 'both').required()
});
const escalateDisputeSchema = actionSchema({ reason: Joi.string().trim().min(1).max(5000).required() });
const closeDisputeSchema = actionSchema({ reason: Joi.string().trim().min(1).max(5000).required() });
const ruleDisputeSchema = actionSchema({
  notes: Joi.string().trim().min(10).max(10000).required(),
  decision: Joi.string().valid('refund_buyer_full', 'refund_seller', 'partial_refund', 'no_action').required(),
  partialAmountKobo: Joi.when('decision', {
    is: 'partial_refund', then: Joi.number().integer().positive().max(Number.MAX_SAFE_INTEGER).required(),
    otherwise: Joi.forbidden()
  }),
  requireReverseLogistics: Joi.boolean().default(false)
});

module.exports = { adminDetailSchema, closeDisputeSchema, dateOnly, disputeStatsSchema,
  escalateDisputeSchema, platformAnalyticsSchema, requestDisputeInfoSchema, ruleDisputeSchema };
