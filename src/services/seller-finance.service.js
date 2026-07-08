const { ERROR_CODES } = require('../config/constants');
const AppError = require('../utils/app-error');
const { buildPagination, normalizePagination } = require('../utils/pagination');
const {
  getCommissionRatePercent,
  resolveSellerSalesPeriod
} = require('../utils/seller-finance');

function mapPayout(payout) {
  return {
    id: payout.id,
    grossAmountKobo: payout.grossAmountKobo,
    commissionAmountKobo: payout.commissionAmountKobo,
    amountKobo: payout.amountKobo,
    status: payout.status,
    bankAccountRef: payout.bankAccountRef,
    itemCount: payout.itemCount,
    requestedAt: payout.requestedAt,
    settledAt: payout.settledAt,
    createdAt: payout.createdAt,
    updatedAt: payout.updatedAt
  };
}

function createSellerFinanceService({ env, sellerFinanceRepository, sellersRepository }) {
  async function ensureSellerProfile(userId) {
    const sellerAccount = await sellersRepository.findByUserId(userId);

    if (!sellerAccount) {
      throw new AppError('Seller profile was not found.', {
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND
      });
    }

    return sellerAccount;
  }

  return {
    async getSellerSalesSummary(payload) {
      const sellerAccount = await ensureSellerProfile(payload.userId);
      const period = resolveSellerSalesPeriod(payload.query);
      const commissionRatePercent = getCommissionRatePercent(env);
      const sales = await sellerFinanceRepository.getSellerSalesSummary({
        sellerId: sellerAccount.sellerProfile.id,
        commissionRatePercent,
        dateFrom: period.dateFrom,
        dateTo: period.dateTo
      });
      // LOGISTICS-STUB: payout eligibility currently uses paid, non-cancelled seller items
      // until delivered-item settlement rules land with the logistics module.
      const payouts = await sellerFinanceRepository.summarizeSellerPayoutBalances({
        sellerId: sellerAccount.sellerProfile.id,
        commissionRatePercent
      });

      return {
        period,
        commissionRatePercent,
        sales,
        payouts
      };
    },

    async createPayoutRequest(payload) {
      const sellerAccount = await ensureSellerProfile(payload.userId);
      const payout = await sellerFinanceRepository.createSellerPayoutRequest({
        sellerId: sellerAccount.sellerProfile.id,
        bankAccountRef: payload.bankAccountRef.trim(),
        commissionRatePercent: getCommissionRatePercent(env)
      });

      if (!payout) {
        throw new AppError('No completed sales are currently available for payout.', {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT
        });
      }

      // ADMIN-STUB: admin approval and settlement will later own the payout lifecycle.
      return mapPayout(payout);
    },

    async listPayouts(payload) {
      const sellerAccount = await ensureSellerProfile(payload.userId);
      const pagination = normalizePagination(payload.query, {
        defaultLimit: 10,
        maxLimit: 50
      });
      const result = await sellerFinanceRepository.listSellerPayouts({
        sellerId: sellerAccount.sellerProfile.id,
        status: payload.query.status || null,
        limit: pagination.limit,
        offset: pagination.offset
      });

      return {
        payouts: result.payouts.map(mapPayout),
        pagination: buildPagination({
          page: pagination.page,
          limit: pagination.limit,
          total: result.total
        })
      };
    }
  };
}

module.exports = {
  createSellerFinanceService
};
