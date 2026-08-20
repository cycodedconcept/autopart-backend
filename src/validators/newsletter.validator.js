const Joi = require('joi');

const subscribeNewsletterSchema = Joi.object({
  body: Joi.object({
    email: Joi.string().trim().lowercase().email({
      tlds: {
        allow: false
      }
    }).required()
  }).required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const unsubscribeNewsletterSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({
    token: Joi.string().trim().length(64).hex().required()
  }).required(),
  query: Joi.object({}).default({})
});

module.exports = {
  subscribeNewsletterSchema,
  unsubscribeNewsletterSchema
};
