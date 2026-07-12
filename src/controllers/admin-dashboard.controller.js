const { sendSuccess } = require('../utils/responses');

function createAdminDashboardController({ adminDashboardService }) {
  return {
    async getDashboard(_req, res) {
      const result = await adminDashboardService.getDashboard();

      return sendSuccess(res, {
        data: result,
        message: 'Admin dashboard fetched successfully.'
      });
    }
  };
}

module.exports = {
  createAdminDashboardController
};
