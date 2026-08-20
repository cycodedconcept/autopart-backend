const express = require('express');
const asyncHandler = require('../middleware/async-handler');
const { validateRequest } = require('../middleware/validate.middleware');
const {
  subscribeNewsletterSchema,
  unsubscribeNewsletterSchema
} = require('../validators/newsletter.validator');

function createNewsletterRouter({ newsletterController }) {
  const router = express.Router();

  router.post(
    '/subscribe',
    validateRequest(subscribeNewsletterSchema),
    asyncHandler(newsletterController.subscribe)
  );

  router.get(
    '/unsubscribe/:token',
    validateRequest(unsubscribeNewsletterSchema),
    asyncHandler(newsletterController.unsubscribe)
  );

  return router;
}

module.exports = {
  createNewsletterRouter
};
