const { sendSuccess } = require('../utils/responses');

function createRiderController({ logisticsService }) {
  return {
    async login(req, res) {
      const result = await logisticsService.loginRider(req.body);

      return sendSuccess(res, {
        data: result,
        message: 'Rider login successful.'
      });
    },

    async getMe(req, res) {
      const result = await logisticsService.getRiderProfile(req.user.id);

      return sendSuccess(res, {
        data: result,
        message: 'Rider profile fetched successfully.'
      });
    },

    async updateAvailability(req, res) {
      const result = await logisticsService.updateRiderAvailability({
        riderId: req.user.id,
        status: req.body.status
      });

      return sendSuccess(res, {
        data: result,
        message: 'Rider availability updated successfully.'
      });
    },

    async listJobs(req, res) {
      const result = await logisticsService.listRiderJobs({
        riderId: req.user.id,
        query: req.query
      });

      return sendSuccess(res, {
        data: result,
        message: 'Rider delivery jobs fetched successfully.'
      });
    },

    async getJobById(req, res) {
      const result = await logisticsService.getRiderJobById({
        riderId: req.user.id,
        jobId: req.params.id
      });

      return sendSuccess(res, {
        data: result,
        message: 'Rider delivery job fetched successfully.'
      });
    },

    async updateJobStatus(req, res) {
      const result = await logisticsService.updateRiderJobStatus({
        riderId: req.user.id,
        jobId: req.params.id,
        status: req.body.status,
        note: req.body.note,
        failureReason: req.body.failureReason
      });

      return sendSuccess(res, {
        data: result,
        message: 'Rider delivery job status updated successfully.'
      });
    }
  };
}

module.exports = {
  createRiderController
};
