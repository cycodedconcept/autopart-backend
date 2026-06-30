const express = require('express');
const asyncHandler = require('../middleware/async-handler');
const { createAuthRateLimiter } = require('../middleware/rate-limit.middleware');
const { validateRequest } = require('../middleware/validate.middleware');
const {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  registerSchema
} = require('../validators/auth.validator');

function createAuthRouter({ authController, authMiddleware }) {
  const router = express.Router();
  const authRateLimiter = createAuthRateLimiter();

  router.post(
    '/register',
    authRateLimiter,
    validateRequest(registerSchema),
    asyncHandler(authController.register)
  );

  router.post(
    '/login',
    authRateLimiter,
    validateRequest(loginSchema),
    asyncHandler(authController.login)
  );

  router.post(
    '/forgot-password',
    authRateLimiter,
    validateRequest(forgotPasswordSchema),
    asyncHandler(authController.forgotPassword)
  );

  router.post(
    '/reset-password',
    authRateLimiter,
    validateRequest(resetPasswordSchema),
    asyncHandler(authController.resetPassword)
  );

  router.patch(
    '/password',
    authMiddleware,
    validateRequest(changePasswordSchema),
    asyncHandler(authController.changePassword)
  );

  return router;
}

module.exports = {
  createAuthRouter
};
