const {
  ORDER_ITEM_STATUSES,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  PAYOUT_STATUSES
} = require('../../../src/config/constants');
const { calculateCommissionAmountKobo } = require('../../../src/utils/money');

function parseDateBoundary(dateValue, endOfDay = false) {
  return Date.parse(`${dateValue}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
}

function toNumber(value) {
  return value === null || value === undefined ? 0 : Number(value);
}

function createInMemoryAdminDashboardRepository({ sellersRepository, store, usersRepository }) {
  async function listSellerAccounts() {
    const result = await usersRepository.listManagedUsers({
      role: 'seller',
      status: 'all',
      search: null,
      limit: 500,
      offset: 0
    });

    return Promise.all(result.users.map((user) => sellersRepository.findByUserId(user.id)));
  }

  function getPaidOrderIdsInRange(dateFrom, dateTo) {
    const fromTime = parseDateBoundary(dateFrom);
    const toTime = parseDateBoundary(dateTo, true);

    return new Set(
      store.payments
        .filter((payment) => (
          payment.status === PAYMENT_STATUSES.PAID
          && Date.parse(payment.updatedAt) >= fromTime
          && Date.parse(payment.updatedAt) <= toTime
        ))
        .map((payment) => Number(payment.orderId))
    );
  }

  function buildPaidOrderItems({ paidOrderIds = null } = {}) {
    return store.orderItems.reduce((items, orderItem) => {
      const order = store.orders.find((entry) => entry.id === Number(orderItem.orderId));

      if (
        !order
        || order.paymentStatus !== PAYMENT_STATUSES.PAID
        || order.status === ORDER_STATUSES.CANCELLED
        || orderItem.itemStatus === ORDER_ITEM_STATUSES.CANCELLED
      ) {
        return items;
      }

      if (paidOrderIds && !paidOrderIds.has(Number(order.id))) {
        return items;
      }

      items.push({
        ...orderItem,
        lineTotalKobo: toNumber(orderItem.lineTotalKobo)
      });

      return items;
    }, []);
  }

  async function resolveSellerBusinessName(sellerId) {
    const sellerAccount = await sellersRepository.findBySellerId(Number(sellerId));

    return sellerAccount ? sellerAccount.sellerProfile.businessName : null;
  }

  return {
    async getDashboardSummary(filters) {
      const sellerAccounts = (await listSellerAccounts()).filter(Boolean);
      const activeSellersCount = sellerAccounts.filter((account) => (
        account.user.accountStatus === 'active'
        && account.sellerProfile.verificationStatus === 'verified'
      )).length;
      const todayOrders = store.orders.filter((order) => (
        order.createdAt.slice(0, 10) === filters.todayDate
      ));
      const yesterdayOrders = store.orders.filter((order) => (
        order.createdAt.slice(0, 10) === filters.yesterdayDate
      ));
      const paidOrderItems = buildPaidOrderItems();
      const currentPeriodOrderIds = getPaidOrderIdsInRange(
        filters.currentPeriodDateFrom,
        filters.currentPeriodDateTo
      );
      const previousPeriodOrderIds = getPaidOrderIdsInRange(
        filters.previousPeriodDateFrom,
        filters.previousPeriodDateTo
      );
      const currentPeriodItems = buildPaidOrderItems({
        paidOrderIds: currentPeriodOrderIds
      });
      const previousPeriodItems = buildPaidOrderItems({
        paidOrderIds: previousPeriodOrderIds
      });
      const openDisputes = store.disputes.filter((entry) => entry.status === 'open');
      const urgentOpenDisputesCount = openDisputes.filter((entry) => {
        const ageHours = Math.floor(
          (Date.now() - Date.parse(entry.createdAt)) / (1000 * 60 * 60)
        );

        return ageHours >= Math.max(filters.reviewSlaHours - filters.urgentWindowHours, 0);
      }).length;
      const pendingVerificationAccounts = sellerAccounts.filter((account) => (
        account.sellerProfile.verificationStatus === 'pending'
        && Array.isArray(account.sellerProfile.documents)
        && account.sellerProfile.documents.length > 0
      ));
      const payoutRequests = store.payouts.filter((entry) => entry.status === PAYOUT_STATUSES.REQUESTED);
      const rejectedPayouts = store.payouts.filter((entry) => entry.status === PAYOUT_STATUSES.REJECTED);
      const paidPayouts = store.payouts.filter((entry) => (
        entry.status === PAYOUT_STATUSES.PAID && entry.settledAt
      ));
      const averagePayoutTimeDays = paidPayouts.length
        ? paidPayouts.reduce((sum, payout) => (
          sum + ((Date.parse(payout.settledAt) - Date.parse(payout.requestedAt)) / (1000 * 60 * 60 * 24))
        ), 0) / paidPayouts.length
        : null;
      const pendingPayoutQueueAmountKobo = store.payouts
        .filter((entry) => (
          entry.status === PAYOUT_STATUSES.REQUESTED || entry.status === PAYOUT_STATUSES.APPROVED
        ))
        .reduce((sum, payout) => sum + toNumber(payout.amountKobo), 0);

      return {
        activeSellersCount,
        ordersTodayCount: todayOrders.length,
        ordersYesterdayCount: yesterdayOrders.length,
        totalOrdersCount: store.orders.length,
        platformGmvKobo: store.orders
          .filter((order) => order.paymentStatus === PAYMENT_STATUSES.PAID)
          .reduce((sum, order) => sum + toNumber(order.totalKobo), 0),
        totalRevenueKobo: paidOrderItems.reduce((sum, item) => (
          sum + calculateCommissionAmountKobo(item.lineTotalKobo, filters.commissionRatePercent)
        ), 0),
        openDisputesCount: openDisputes.length,
        urgentOpenDisputesCount,
        totalDisputesCount: store.disputes.length,
        resolvedDisputesCount: store.disputes.filter((entry) => entry.status === 'resolved').length,
        pendingVerificationsCount: pendingVerificationAccounts.length,
        verifiedSellersCount: sellerAccounts.filter((account) => (
          account.sellerProfile.verificationStatus === 'verified'
        )).length,
        rejectedSellersCount: sellerAccounts.filter((account) => (
          account.sellerProfile.verificationStatus === 'rejected'
        )).length,
        payoutRequestsCount: payoutRequests.length,
        payoutRequestsAmountKobo: payoutRequests.reduce((sum, payout) => (
          sum + toNumber(payout.amountKobo)
        ), 0),
        failedPayoutsCount: rejectedPayouts.length,
        totalPayoutsCount: store.payouts.length,
        paidPayoutsCount: paidPayouts.length,
        pendingPayoutQueueAmountKobo,
        averagePayoutTimeDays,
        currentRevenueKobo: currentPeriodItems.reduce((sum, item) => (
          sum + calculateCommissionAmountKobo(item.lineTotalKobo, filters.commissionRatePercent)
        ), 0),
        previousRevenueKobo: previousPeriodItems.reduce((sum, item) => (
          sum + calculateCommissionAmountKobo(item.lineTotalKobo, filters.commissionRatePercent)
        ), 0),
        currentPlatformGmvKobo: store.orders
          .filter((order) => currentPeriodOrderIds.has(Number(order.id)))
          .reduce((sum, order) => sum + toNumber(order.totalKobo), 0),
        previousPlatformGmvKobo: store.orders
          .filter((order) => previousPeriodOrderIds.has(Number(order.id)))
          .reduce((sum, order) => sum + toNumber(order.totalKobo), 0),
        currentActiveSellersCount: new Set(
          currentPeriodItems.map((item) => Number(item.sellerId))
        ).size,
        previousActiveSellersCount: new Set(
          previousPeriodItems.map((item) => Number(item.sellerId))
        ).size
      };
    },

    async listRecentOrders({ limit }) {
      const orders = [];

      for (const order of [...store.orders].sort(
        (left, right) => new Date(right.createdAt) - new Date(left.createdAt) || right.id - left.id
      ).slice(0, limit)) {
        const sellerIds = Array.from(new Set(
          store.orderItems
            .filter((item) => item.orderId === Number(order.id))
            .map((item) => Number(item.sellerId))
        ));

        orders.push({
          id: Number(order.id),
          status: order.status,
          paymentStatus: order.paymentStatus,
          totalKobo: toNumber(order.totalKobo),
          sellerCount: sellerIds.length,
          primarySellerBusinessName: sellerIds.length
            ? await resolveSellerBusinessName(sellerIds[0])
            : null,
          createdAt: order.createdAt
        });
      }

      return {
        orders,
        total: store.orders.length
      };
    },

    async listTopSellers({ limit }) {
      const paidItems = buildPaidOrderItems();
      const aggregates = new Map();

      for (const item of paidItems) {
        const existingEntry = aggregates.get(Number(item.sellerId)) || {
          sellerId: Number(item.sellerId),
          totalOrdersSet: new Set(),
          totalItems: 0,
          grossSalesKobo: 0
        };

        existingEntry.totalOrdersSet.add(Number(item.orderId));
        existingEntry.totalItems += toNumber(item.quantity);
        existingEntry.grossSalesKobo += toNumber(item.lineTotalKobo);
        aggregates.set(Number(item.sellerId), existingEntry);
      }

      const sellers = [];

      for (const aggregate of aggregates.values()) {
        const sellerAccount = await sellersRepository.findBySellerId(aggregate.sellerId);

        if (!sellerAccount || sellerAccount.user.accountStatus !== 'active') {
          continue;
        }

        sellers.push({
          sellerId: aggregate.sellerId,
          userId: sellerAccount.user.id,
          businessName: sellerAccount.sellerProfile.businessName,
          fullName: sellerAccount.user.fullName,
          email: sellerAccount.user.email,
          phone: sellerAccount.user.phone,
          totalOrders: aggregate.totalOrdersSet.size,
          totalItems: aggregate.totalItems,
          grossSalesKobo: aggregate.grossSalesKobo
        });
      }

      sellers.sort((left, right) => (
        right.grossSalesKobo - left.grossSalesKobo
        || right.totalOrders - left.totalOrders
        || left.sellerId - right.sellerId
      ));

      return {
        sellers: sellers.slice(0, limit),
        total: sellers.length
      };
    },

    async listPayoutQueue({ limit }) {
      const pendingPayouts = store.payouts
        .filter((entry) => (
          entry.status === PAYOUT_STATUSES.REQUESTED || entry.status === PAYOUT_STATUSES.APPROVED
        ))
        .sort((left, right) => (
          new Date(right.requestedAt) - new Date(left.requestedAt) || right.id - left.id
        ));
      const payouts = [];

      for (const payout of pendingPayouts.slice(0, limit)) {
        const sellerAccount = await sellersRepository.findBySellerId(Number(payout.sellerId));

        payouts.push({
          payoutId: Number(payout.id),
          sellerId: Number(payout.sellerId),
          userId: sellerAccount ? sellerAccount.user.id : null,
          businessName: sellerAccount ? sellerAccount.sellerProfile.businessName : null,
          fullName: sellerAccount ? sellerAccount.user.fullName : null,
          email: sellerAccount ? sellerAccount.user.email : null,
          amountKobo: toNumber(payout.amountKobo),
          status: payout.status,
          requestedAt: payout.requestedAt,
          approvedAt: payout.approvedAt || null
        });
      }

      return {
        payouts,
        total: pendingPayouts.length,
        pendingAmountKobo: pendingPayouts.reduce((sum, payout) => (
          sum + toNumber(payout.amountKobo)
        ), 0)
      };
    }
  };
}

module.exports = {
  createInMemoryAdminDashboardRepository
};
