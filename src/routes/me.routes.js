const express = require('express');
const asyncHandler = require('../middleware/async-handler');

function createMeRouter({ meController, authMiddleware }) {
  const router = express.Router();

  router.get('/me', authMiddleware, asyncHandler(meController.getMe));

  return router;
}

module.exports = {
  createMeRouter
};
