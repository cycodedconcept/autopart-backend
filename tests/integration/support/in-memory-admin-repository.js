function createInMemoryAdminRepository({ sellersRepository }) {
  return {
    async findSellerAccountBySellerId(sellerId) {
      return sellersRepository.findBySellerId(Number(sellerId));
    },

    async listSellerVerificationQueue({ limit, offset, status }) {
      const allStatuses = status === 'all';
      const sellerAccounts = await sellersRepository.listSellerAccountsForReview({
        status: allStatuses ? null : status
      });

      return {
        sellers: sellerAccounts.slice(offset, offset + limit),
        total: sellerAccounts.length
      };
    },

    async updateSellerVerificationStatus({ rejectionReason, sellerId, status }) {
      return sellersRepository.updateVerificationStatus({
        sellerId: Number(sellerId),
        status,
        rejectionReason
      });
    }
  };
}

module.exports = {
  createInMemoryAdminRepository
};
