const { sendSuccess } = require('../utils/responses');

function createLogisticsController({ logisticsService }) {
  return {
    async registerCompany(req, res) {
      const result = await logisticsService.registerCompany(req.body);

      return sendSuccess(res, {
        statusCode: 201,
        data: result,
        message: 'Logistics company registered successfully.'
      });
    },

    async loginCompany(req, res) {
      const result = await logisticsService.loginCompany(req.body);

      return sendSuccess(res, {
        data: result,
        message: 'Logistics company login successful.'
      });
    },

    async getMe(req, res) {
      const result = await logisticsService.getCompanyProfile(req.user.id);

      return sendSuccess(res, {
        data: result,
        message: 'Logistics company profile fetched successfully.'
      });
    },

    async listZones(req, res) {
      const result = await logisticsService.listZones();

      return sendSuccess(res, {
        data: result,
        message: 'Delivery zones fetched successfully.'
      });
    },

    async createRider(req, res) {
      const result = await logisticsService.createRider({
        companyId: req.user.id,
        fullName: req.body.fullName,
        phone: req.body.phone,
        email: req.body.email,
        password: req.body.password,
        vehicleType: req.body.vehicleType,
        zoneId: req.body.zoneId,
        status: req.body.status
      });

      return sendSuccess(res, {
        statusCode: 201,
        data: result,
        message: 'Rider created successfully.'
      });
    },

    async listRiders(req, res) {
      const result = await logisticsService.listRiders({
        companyId: req.user.id,
        query: req.query
      });

      return sendSuccess(res, {
        data: result,
        message: 'Riders fetched successfully.'
      });
    },

    async getRider(req, res) {
      const result = await logisticsService.getCompanyRider({
        companyId: req.user.id,
        riderId: req.params.id
      });

      return sendSuccess(res, {
        data: result,
        message: 'Rider fetched successfully.'
      });
    },

    async updateRider(req, res) {
      const result = await logisticsService.updateRider({
        companyId: req.user.id,
        riderId: req.params.id,
        fullName: req.body.fullName,
        phone: req.body.phone,
        email: req.body.email,
        vehicleType: req.body.vehicleType,
        zoneId: req.body.zoneId,
        status: req.body.status
      });

      return sendSuccess(res, {
        data: result,
        message: 'Rider updated successfully.'
      });
    },

    async suspendRider(req, res) {
      const result = await logisticsService.suspendRider({
        companyId: req.user.id,
        riderId: req.params.id
      });

      return sendSuccess(res, {
        data: result,
        message: 'Rider suspended successfully.'
      });
    },

    async reactivateRider(req, res) {
      const result = await logisticsService.reactivateRider({
        companyId: req.user.id,
        riderId: req.params.id
      });

      return sendSuccess(res, {
        data: result,
        message: 'Rider reactivated successfully.'
      });
    },

    async listJobs(req, res) {
      const result = await logisticsService.listCompanyJobs({
        companyId: req.user.id,
        query: req.query
      });

      return sendSuccess(res, {
        data: result,
        message: 'Company delivery jobs fetched successfully.'
      });
    },

    async getEarnings(req, res) {
      const result = await logisticsService.getCompanyEarnings({
        companyId: req.user.id
      });

      return sendSuccess(res, {
        data: result,
        message: 'Logistics company earnings fetched successfully.'
      });
    },

    async createPayoutRequest(req, res) {
      const result = await logisticsService.createCompanyPayoutRequest({
        companyId: req.user.id,
        bankAccountRef: req.body.bankAccountRef
      });

      return sendSuccess(res, {
        statusCode: 201,
        data: result,
        message: 'Logistics company payout request created successfully.'
      });
    }
  };
}

module.exports = {
  createLogisticsController
};
