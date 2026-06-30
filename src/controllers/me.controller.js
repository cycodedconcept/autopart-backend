const { sendSuccess } = require('../utils/responses');

function createMeController() {
  return {
    async getMe(req, res) {
      return sendSuccess(res, {
        data: req.user,
        message: 'Buyer profile fetched successfully.'
      });
    }
  };
}

module.exports = {
  createMeController
};
