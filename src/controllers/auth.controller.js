const { sendSuccess } = require('../utils/responses');

function createAuthController({ authService }) {
  return {
    async changePassword(req, res) {
      const result = await authService.changePassword({
        userId: req.user.id,
        currentPassword: req.body.currentPassword,
        newPassword: req.body.newPassword
      });

      return sendSuccess(res, {
        data: result.data,
        message: result.message
      });
    },

    async forgotPassword(req, res) {
      const identifier = req.body.identifier || req.body.email || req.body.phone;
      const result = await authService.forgotPassword({ identifier });

      return sendSuccess(res, {
        data: result.data,
        message: result.message
      });
    },

    async register(req, res) {
      const result = await authService.register(req.body);

      return sendSuccess(res, {
        statusCode: 201,
        data: result,
        message: 'Buyer account created successfully.'
      });
    },

    async login(req, res) {
      const identifier = req.body.identifier || req.body.email || req.body.phone;
      const result = await authService.login({
        identifier,
        password: req.body.password
      });

      return sendSuccess(res, {
        data: result,
        message: 'Login successful.'
      });
    },

    async resetPassword(req, res) {
      const result = await authService.resetPassword({
        token: req.body.token,
        newPassword: req.body.newPassword
      });

      return sendSuccess(res, {
        data: result.data,
        message: result.message
      });
    }
  };
}

module.exports = {
  createAuthController
};
