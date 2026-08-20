const express = require('express');

function createWebhooksRouter({ paymentsController }) {
  const router = express.Router();

  router.post('/paystack', paymentsController.handlePaystackWebhook);

  return router;
}

module.exports = {
  createWebhooksRouter
};
