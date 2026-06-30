const Joi = require('joi');

const addCartItemSchema = Joi.object({
  body: Joi.object({
    productId: Joi.number().integer().positive().required(),
    quantity: Joi.number().integer().min(1).required()
  }).required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const deleteCartItemSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }).required(),
  query: Joi.object({}).default({})
});

const getCartSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const updateCartItemSchema = Joi.object({
  body: Joi.object({
    quantity: Joi.number().integer().min(1).required()
  }).required(),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }).required(),
  query: Joi.object({}).default({})
});

module.exports = {
  addCartItemSchema,
  deleteCartItemSchema,
  getCartSchema,
  updateCartItemSchema
};
