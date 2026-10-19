const Joi = require('joi');
const empty = Joi.object({}).default({});
const createApiKeySchema = Joi.object({
  body: Joi.object({
    name: Joi.string().trim().min(1).max(160).required(),
    scopes: Joi.array().items(Joi.string().valid('catalog:read')).min(1).unique().default(['catalog:read']),
    expiresAt: Joi.date().iso().greater('now').allow(null).default(null)
  }).required(), params: empty, query: empty
});
const listApiKeysSchema = Joi.object({ body: empty, params: empty, query: empty });
const revokeApiKeySchema = Joi.object({ body: empty, query: empty,
  params: Joi.object({ id: Joi.number().integer().positive().required() }).required()
});
module.exports = { createApiKeySchema, listApiKeysSchema, revokeApiKeySchema };
