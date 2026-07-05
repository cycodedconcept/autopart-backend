const Joi = require('joi');
const { ORDER_ITEM_STATUSES } = require('../config/constants');

const listSellerOrdersSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: Joi.object({
    itemStatus: Joi.string()
      .valid(...Object.values(ORDER_ITEM_STATUSES))
      .optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(10)
  }).default({})
});

const updateSellerOrderItemStatusSchema = Joi.object({
  body: Joi.object({
    itemStatus: Joi.string()
      .valid(
        ORDER_ITEM_STATUSES.READY_FOR_PICKUP,
        ORDER_ITEM_STATUSES.CANCELLED
      )
      .required()
  }).required(),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }).required(),
  query: Joi.object({}).default({})
});

module.exports = {
  listSellerOrdersSchema,
  updateSellerOrderItemStatusSchema
};
