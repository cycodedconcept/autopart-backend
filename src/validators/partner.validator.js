const Joi = require('joi');
const empty = Joi.object({}).default({});
const pagination = { page: Joi.number().integer().min(1).default(1), limit: Joi.number().integer().min(1).max(100).default(10) };
const productFilters = {
  ...pagination, search: Joi.string().trim().min(1).max(255),
  category: Joi.alternatives().try(Joi.number().integer().positive(), Joi.string().trim().min(1).max(140)),
  sellerId: Joi.number().integer().positive(),
  minPrice: Joi.number().integer().min(0), maxPrice: Joi.number().integer().min(0),
  sort: Joi.string().valid('newest', 'price').default('newest')
};
function productQuery() {
  return Joi.object(productFilters).custom((value, helpers) => {
    if (value.minPrice !== undefined && value.maxPrice !== undefined && value.maxPrice < value.minPrice) return helpers.message('maxPrice must be greater than or equal to minPrice');
    return value;
  }).default({});
}
const partnerProductsSchema = Joi.object({ body: empty, params: empty, query: productQuery() });
const partnerSellersSchema = Joi.object({ body: empty, params: empty, query: Joi.object(pagination).default({}) });
const partnerSellerProductsSchema = Joi.object({ body: empty, query: productQuery(),
  params: Joi.object({ id: Joi.number().integer().positive().required() }).required()
});
module.exports = { partnerProductsSchema, partnerSellersSchema, partnerSellerProductsSchema };
