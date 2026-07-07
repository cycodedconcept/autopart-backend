const {
  ORDER_ITEM_STATUSES,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  PAYOUT_STATUSES
} = require('../../../src/config/constants');
const {
  calculateCommissionAmountKobo,
  calculateNetAmountKobo
} = require('../../../src/utils/money');

const PAYOUT_HOLD_STATUSES = new Set([
  PAYOUT_STATUSES.REQUESTED,
  PAYOUT_STATUSES.APPROVED,
  PAYOUT_STATUSES.PAID
]);

function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

function getItemCount(store, payoutId) {
  return store.payoutItems.filter((entry) => entry.payoutId === payoutId).length;
}

function mapPayout(store, payout) {
  if (!payout) {
    return null;
  }

  return {
    ...clone(payout),
    itemCount: getItemCount(store, payout.id)
  };
}

function parseDateBoundary(dateValue, endOfDay = false) {
  return Date.parse(`${dateValue}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
}

function createInMemorySellerFinanceRepository({ store }) {
  function findPaidAt(orderId) {
    const paidPayments = store.payments
      .filter((payment) => payment.orderId === orderId && payment.status === PAYMENT_STATUSES.PAID)
      .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt));

    return paidPayments[0] ? paidPayments[0].updatedAt : null;
  }

  function isAllocatedToOpenPayout(orderItemId) {
    return store.payoutItems.some((entry) => {
      if (entry.orderItemId !== orderItemId) {
        return false;
      }

      const payout = store.payouts.find((record) => record.id === entry.payoutId);

      return payout ? PAYOUT_HOLD_STATUSES.has(payout.status) : false;
    });
  }

  function buildPaidSellerItems(sellerId) {
    return store.orderItems.reduce((items, orderItem) => {
      if (orderItem.sellerId !== Number(sellerId)) {
        return items;
      }

      const order = store.orders.find((entry) => entry.id === orderItem.orderId);
      const paidAt = findPaidAt(orderItem.orderId);

      if (
        !order
        || !paidAt
        || order.paymentStatus !== PAYMENT_STATUSES.PAID
        || order.status === ORDER_STATUSES.CANCELLED
        || orderItem.itemStatus === ORDER_ITEM_STATUSES.CANCELLED
      ) {
        return items;
      }

      items.push({
        orderId: order.id,
        orderItemId: orderItem.id,
        quantity: Number(orderItem.quantity),
        grossAmountKobo: Number(orderItem.lineTotalKobo),
        paidAt
      });

      return items;
    }, []);
  }

  function buildEligiblePayoutItems(sellerId, commissionRatePercent) {
    return buildPaidSellerItems(sellerId)
      .filter((item) => !isAllocatedToOpenPayout(item.orderItemId))
      .map((item) => ({
        ...item,
        commissionAmountKobo: calculateCommissionAmountKobo(
          item.grossAmountKobo,
          commissionRatePercent
        ),
        netAmountKobo: calculateNetAmountKobo(item.grossAmountKobo, commissionRatePercent)
      }));
  }

  return {
    async getSellerSalesSummary({ commissionRatePercent, dateFrom, dateTo, sellerId }) {
      const fromTime = parseDateBoundary(dateFrom);
      const toTime = parseDateBoundary(dateTo, true);
      const paidItems = buildPaidSellerItems(sellerId).filter((item) => {
        const paidAtTime = Date.parse(item.paidAt);

        return paidAtTime >= fromTime && paidAtTime <= toTime;
      });
      const orderIds = new Set(paidItems.map((item) => item.orderId));

      return {
        totalOrders: orderIds.size,
        totalItems: paidItems.reduce((sum, item) => sum + item.quantity, 0),
        grossSalesKobo: paidItems.reduce((sum, item) => sum + item.grossAmountKobo, 0),
        commissionKobo: paidItems.reduce((sum, item) => (
          sum + calculateCommissionAmountKobo(item.grossAmountKobo, commissionRatePercent)
        ), 0),
        netSalesKobo: paidItems.reduce((sum, item) => (
          sum + calculateNetAmountKobo(item.grossAmountKobo, commissionRatePercent)
        ), 0)
      };
    },

    async summarizeSellerPayoutBalances({ commissionRatePercent, sellerId }) {
      const payouts = store.payouts.filter((entry) => entry.sellerId === Number(sellerId));

      return {
        pendingKobo: buildEligiblePayoutItems(sellerId, commissionRatePercent)
          .reduce((sum, item) => sum + item.netAmountKobo, 0),
        requestedKobo: payouts
          .filter((entry) => entry.status === PAYOUT_STATUSES.REQUESTED)
          .reduce((sum, entry) => sum + Number(entry.amountKobo), 0),
        approvedKobo: payouts
          .filter((entry) => entry.status === PAYOUT_STATUSES.APPROVED)
          .reduce((sum, entry) => sum + Number(entry.amountKobo), 0),
        paidKobo: payouts
          .filter((entry) => entry.status === PAYOUT_STATUSES.PAID)
          .reduce((sum, entry) => sum + Number(entry.amountKobo), 0)
      };
    },

    async createSellerPayoutRequest({ bankAccountRef, commissionRatePercent, sellerId }) {
      const eligibleItems = buildEligiblePayoutItems(sellerId, commissionRatePercent);

      if (!eligibleItems.length) {
        return null;
      }

      const now = new Date().toISOString();
      const payout = {
        id: store.counters.payoutId,
        sellerId: Number(sellerId),
        grossAmountKobo: eligibleItems.reduce((sum, item) => sum + item.grossAmountKobo, 0),
        commissionAmountKobo: eligibleItems.reduce((sum, item) => sum + item.commissionAmountKobo, 0),
        amountKobo: eligibleItems.reduce((sum, item) => sum + item.netAmountKobo, 0),
        status: PAYOUT_STATUSES.REQUESTED,
        bankAccountRef,
        requestedAt: now,
        settledAt: null,
        createdAt: now,
        updatedAt: now
      };

      store.payouts.push(payout);
      store.counters.payoutId += 1;

      for (const item of eligibleItems) {
        store.payoutItems.push({
          id: store.counters.payoutItemId,
          payoutId: payout.id,
          orderItemId: item.orderItemId,
          grossAmountKobo: item.grossAmountKobo,
          commissionAmountKobo: item.commissionAmountKobo,
          netAmountKobo: item.netAmountKobo,
          createdAt: now,
          updatedAt: now
        });
        store.counters.payoutItemId += 1;
      }

      return mapPayout(store, payout);
    },

    async listSellerPayouts({ limit, offset, sellerId, status }) {
      const matchedPayouts = store.payouts
        .filter((entry) => (
          entry.sellerId === Number(sellerId)
          && (!status || entry.status === status)
        ))
        .sort((left, right) => new Date(right.requestedAt) - new Date(left.requestedAt) || right.id - left.id);

      return {
        payouts: matchedPayouts
          .slice(offset, offset + limit)
          .map((entry) => mapPayout(store, entry)),
        total: matchedPayouts.length
      };
    }
  };
}

module.exports = {
  createInMemorySellerFinanceRepository
};
