const Joi = require('joi');
const { ORDER_ITEM_STATUSES } = require('../config/constants');
const { buildPaginationQuerySchema } = require('./pagination.validator');

const listSellerOrdersSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: buildPaginationQuerySchema({
    itemStatus: Joi.string()
      .valid(...Object.values(ORDER_ITEM_STATUSES))
      .optional()
  })
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
