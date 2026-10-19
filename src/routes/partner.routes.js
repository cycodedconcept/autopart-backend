const express = require('express');
const rateLimit = require('express-rate-limit');
const asyncHandler = require('../middleware/async-handler');
const { validateRequest } = require('../middleware/validate.middleware');
const { partnerProductsSchema, partnerSellersSchema, partnerSellerProductsSchema } = require('../validators/partner.validator');
function createPartnerRouter({ requireApiKey, partnerController }) {
  const router = express.Router();
  router.use(requireApiKey('catalog:read'));
  router.use(rateLimit({ windowMs: 60000, limit: 120, standardHeaders: true, legacyHeaders: false,
    keyGenerator: (req) => String(req.partner.id),
    message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many partner requests. Please try again later.' } }
  }));
  router.get('/products', validateRequest(partnerProductsSchema), asyncHandler(partnerController.listProducts));
  router.get('/sellers', validateRequest(partnerSellersSchema), asyncHandler(partnerController.listSellers));
  router.get('/sellers/:id/products', validateRequest(partnerSellerProductsSchema), asyncHandler(partnerController.listSellerProducts));
  return router;
}
module.exports = { createPartnerRouter };
