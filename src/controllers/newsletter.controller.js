const { sendSuccess } = require('../utils/responses');

function createNewsletterController({ newsletterService }) {
  return {
    async subscribe(req, res) {
      const result = await newsletterService.subscribe({
        email: req.body.email,
        ipAddress: req.ip
      });

      return sendSuccess(res, {
        data: result.data,
        message: result.message
      });
    },

    async unsubscribe(req, res) {
      const result = await newsletterService.unsubscribe(req.params.token);

      return sendSuccess(res, {
        data: result.data,
        message: result.message
      });
    }
  };
}

module.exports = {
  createNewsletterController
};
