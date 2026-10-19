const { sendSuccess } = require('../utils/responses');
function createPartnerController({ partnerService }) {
  return {
    async listProducts(req, res) { return sendSuccess(res, { data: await partnerService.listProducts(req.query) }); },
    async listSellers(req, res) { return sendSuccess(res, { data: await partnerService.listSellers(req.query) }); },
    async listSellerProducts(req, res) { return sendSuccess(res, { data: await partnerService.listSellerProducts(req.params.id, req.query) }); }
  };
}
module.exports = { createPartnerController };
