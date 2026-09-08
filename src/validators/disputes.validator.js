const Joi = require('joi');
const { DISPUTE_STATUSES } = require('../config/constants');
const { dateOnly } = require('./admin-platform.validator');
const { DISPUTE_FILENAME_PATTERN } = require('../utils/dispute-files');

const id = Joi.number().integer().positive().max(Number.MAX_SAFE_INTEGER).required();
const empty = Joi.object({}).default({});
const message = Joi.string().trim().min(20).max(2000).required();
const filters = Joi.object({
  status: Joi.string().valid('all', ...Object.values(DISPUTE_STATUSES)).default('all'),
  dateFrom: dateOnly.optional(), dateTo: dateOnly.optional(),
  page: Joi.number().integer().min(1).max(Number.MAX_SAFE_INTEGER).default(1),
  limit: Joi.number().integer().min(1).max(50).default(10)
}).custom((value, helpers) => value.dateFrom && value.dateTo && value.dateFrom > value.dateTo
  ? helpers.message('dateFrom must not be later than dateTo.') : value).default({});

function schema(params, body = empty, query = empty) {
  return Joi.object({ params: Joi.object(params).required(), body, query });
}

const createDisputeSchema = schema({ orderId: id }, Joi.object({
  reason: Joi.string().valid('item_not_as_described', 'item_not_received', 'damaged_on_arrival',
    'wrong_item_sent', 'counterfeit_suspected', 'other').required(),
  description: message,
  sellerId: id.optional()
}).required());
const orderDisputesSchema = schema({ orderId: id }, empty, filters);
const listDisputesSchema = schema({}, empty, filters);
const detailDisputeSchema = schema({ id });
const respondDisputeSchema = schema({ id }, Joi.object({
  message,
  // Image bytes are accepted through multipart only, never arbitrary URLs or disk paths.
  attachments: Joi.array().max(0).optional(),
  evidence: Joi.forbidden()
}).required());
const evidenceDisputeSchema = schema({ filename: Joi.string().pattern(DISPUTE_FILENAME_PATTERN).required() });

module.exports = { createDisputeSchema, orderDisputesSchema, listDisputesSchema,
  detailDisputeSchema, respondDisputeSchema, evidenceDisputeSchema };
