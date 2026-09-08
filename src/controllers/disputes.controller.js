const { sendSuccess } = require('../utils/responses');

function createDisputesController({ disputesService, party }) {
  return {
    async createDispute(req, res) {
      const data = await disputesService.createDispute({ user: req.user, orderId: req.params.orderId,
        ...req.body, files: req.disputeFiles || [] });
      return sendSuccess(res, { statusCode: 201, data, message: 'Dispute opened successfully.' });
    },
    async listDisputes(req, res) {
      const data = await disputesService.listDisputes({ user: req.user, party,
        orderId: req.params.orderId, query: req.query });
      return sendSuccess(res, { data, message: 'Disputes fetched successfully.' });
    },
    async getDispute(req, res) {
      const data = await disputesService.getDispute({ user: req.user, party, disputeId: req.params.id });
      return sendSuccess(res, { data, message: 'Dispute fetched successfully.' });
    },
    async respond(req, res) {
      const data = await disputesService.respond({ user: req.user, party, disputeId: req.params.id,
        message: req.body.message, files: req.disputeFiles || [] });
      return sendSuccess(res, { data, message: 'Dispute response submitted successfully.' });
    }
  };
}

module.exports = { createDisputesController };
