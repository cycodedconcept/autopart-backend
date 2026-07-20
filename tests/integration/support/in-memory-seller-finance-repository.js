const {
  ORDER_ITEM_STATUSES,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  PAYOUT_PAYEE_TYPES,
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

function mapAdminPayoutItem(store, payoutItem) {
  const orderItem = store.orderItems.find((entry) => entry.id === payoutItem.orderItemId);
  const order = orderItem
    ? store.orders.find((entry) => entry.id === orderItem.orderId)
    : null;
  const deliveryJob = payoutItem.deliveryJobId
    ? store.deliveryJobs.find((entry) => entry.id === payoutItem.deliveryJobId)
    : null;

  return {
    id: payoutItem.id,
    payoutId: payoutItem.payoutId,
    orderItemId: payoutItem.orderItemId,
    deliveryJobId: payoutItem.deliveryJobId || null,
    orderId: orderItem ? orderItem.orderId : null,
    productId: orderItem ? orderItem.productId : null,
    quantity: orderItem ? Number(orderItem.quantity) : 0,
    grossAmountKobo: Number(payoutItem.grossAmountKobo),
    commissionAmountKobo: Number(payoutItem.commissionAmountKobo),
    netAmountKobo: Number(payoutItem.netAmountKobo),
    orderStatus: order ? order.status : null,
    deliveryJobStatus: deliveryJob ? deliveryJob.status : null,
    paidAt: orderItem ? findPaidAtForStore(store, orderItem.orderId) : null,
    createdAt: payoutItem.createdAt,
    updatedAt: payoutItem.updatedAt
  };
}

function findPaidAtForStore(store, orderId) {
  const paidPayments = store.payments
    .filter((payment) => payment.orderId === orderId && payment.status === PAYMENT_STATUSES.PAID)
    .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt));

  return paidPayments[0] ? paidPayments[0].updatedAt : null;
}

function parseDateBoundary(dateValue, endOfDay = false) {
  return Date.parse(`${dateValue}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
}

function createInMemorySellerFinanceRepository({ sellersRepository, store }) {
  function findPaidAt(orderId) {
    return findPaidAtForStore(store, orderId);
  }

  function isAllocatedToOpenSellerPayout(orderItemId) {
    return store.payoutItems.some((entry) => {
      if (entry.orderItemId !== orderItemId) {
        return false;
      }

      const payout = store.payouts.find((record) => record.id === entry.payoutId);

      return payout
        ? (
          payout.payeeType === PAYOUT_PAYEE_TYPES.SELLER
          && PAYOUT_HOLD_STATUSES.has(payout.status)
        )
        : false;
    });
  }

  function isAllocatedToOpenLogisticsPayout(deliveryJobId) {
    return store.payoutItems.some((entry) => {
      if (entry.deliveryJobId !== deliveryJobId) {
        return false;
      }

      const payout = store.payouts.find((record) => record.id === entry.payoutId);

      return payout
        ? (
          payout.payeeType === PAYOUT_PAYEE_TYPES.LOGISTICS_COMPANY
          && PAYOUT_HOLD_STATUSES.has(payout.status)
        )
        : false;
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
      .filter((item) => {
        const orderItem = store.orderItems.find((entry) => entry.id === item.orderItemId);

        return orderItem && orderItem.itemStatus === ORDER_ITEM_STATUSES.DELIVERED;
      })
      .filter((item) => !isAllocatedToOpenSellerPayout(item.orderItemId))
      .map((item) => ({
        ...item,
        commissionAmountKobo: calculateCommissionAmountKobo(
          item.grossAmountKobo,
          commissionRatePercent
        ),
        netAmountKobo: calculateNetAmountKobo(item.grossAmountKobo, commissionRatePercent)
      }));
  }

  function buildEligibleLogisticsPayoutJobs(companyId) {
    return store.deliveryJobs
      .filter((job) => (
        job.companyId === Number(companyId)
        && job.status === 'delivered'
        && Number(job.companyShareKobo || 0) > 0
      ))
      .filter((job) => {
        const order = store.orders.find((entry) => entry.id === job.orderId);
        const paidAt = findPaidAt(job.orderId);

        return (
          order
          && paidAt
          && order.paymentStatus === PAYMENT_STATUSES.PAID
          && order.status !== ORDER_STATUSES.CANCELLED
        );
      })
      .filter((job) => !isAllocatedToOpenLogisticsPayout(job.id))
      .map((job) => ({
        deliveryJobId: job.id,
        orderItemId: job.orderItemId,
        grossAmountKobo: Number(job.deliveryFeeKobo || 0),
        commissionAmountKobo: Number(job.platformMarginKobo || 0),
        netAmountKobo: Number(job.companyShareKobo || 0)
      }));
  }

  async function buildAdminPayout(payout) {
    const sellerAccount = sellersRepository
      ? await sellersRepository.findBySellerId(Number(payout.sellerId))
      : null;
    const logisticsCompany = payout.logisticsCompanyId
      ? store.logisticsCompanies.find((entry) => entry.id === Number(payout.logisticsCompanyId)) || null
      : null;

    return {
      ...mapPayout(store, payout),
      seller: sellerAccount
        ? {
          id: sellerAccount.sellerProfile.id,
          userId: sellerAccount.user.id,
          businessName: sellerAccount.sellerProfile.businessName,
          contactEmail: sellerAccount.sellerProfile.contactEmail,
          contactPhone: sellerAccount.sellerProfile.contactPhone,
          fullName: sellerAccount.user.fullName,
          email: sellerAccount.user.email,
          phone: sellerAccount.user.phone
        }
        : null,
      logisticsCompany: logisticsCompany
        ? {
          id: logisticsCompany.id,
          name: logisticsCompany.name,
          email: logisticsCompany.email,
          phone: logisticsCompany.phone,
          address: logisticsCompany.address,
          status: logisticsCompany.status
        }
        : null,
      items: store.payoutItems
        .filter((entry) => entry.payoutId === payout.id)
        .sort((left, right) => left.id - right.id)
        .map((entry) => mapAdminPayoutItem(store, entry))
    };
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

    async getSellerRevenueTrend({
      currentDateFrom,
      currentDateTo,
      previousDateFrom,
      previousDateTo,
      sellerId
    }) {
      const currentFromTime = parseDateBoundary(currentDateFrom);
      const currentToTime = parseDateBoundary(currentDateTo, true);
      const previousFromTime = parseDateBoundary(previousDateFrom);
      const previousToTime = parseDateBoundary(previousDateTo, true);
      const paidItems = buildPaidSellerItems(sellerId);

      return {
        currentGrossSalesKobo: paidItems
          .filter((item) => {
            const paidAtTime = Date.parse(item.paidAt);

            return paidAtTime >= currentFromTime && paidAtTime <= currentToTime;
          })
          .reduce((sum, item) => sum + item.grossAmountKobo, 0),
        previousGrossSalesKobo: paidItems
          .filter((item) => {
            const paidAtTime = Date.parse(item.paidAt);

            return paidAtTime >= previousFromTime && paidAtTime <= previousToTime;
          })
          .reduce((sum, item) => sum + item.grossAmountKobo, 0)
      };
    },

    async getSellerRevenueTimeline({ commissionRatePercent, sellerId, year }) {
      const byMonth = new Map();

      for (const item of buildPaidSellerItems(sellerId)) {
        const paidAtDate = new Date(item.paidAt);

        if (paidAtDate.getUTCFullYear() !== Number(year)) {
          continue;
        }

        const monthNumber = paidAtDate.getUTCMonth() + 1;
        const entry = byMonth.get(monthNumber) || {
          monthNumber,
          orderIds: new Set(),
          totalItems: 0,
          grossSalesKobo: 0,
          commissionKobo: 0,
          netSalesKobo: 0
        };

        entry.orderIds.add(item.orderId);
        entry.totalItems += item.quantity;
        entry.grossSalesKobo += item.grossAmountKobo;
        entry.commissionKobo += calculateCommissionAmountKobo(
          item.grossAmountKobo,
          commissionRatePercent
        );
        entry.netSalesKobo += calculateNetAmountKobo(item.grossAmountKobo, commissionRatePercent);
        byMonth.set(monthNumber, entry);
      }

      return Array.from(byMonth.values())
        .sort((left, right) => left.monthNumber - right.monthNumber)
        .map((entry) => ({
          monthNumber: entry.monthNumber,
          totalOrders: entry.orderIds.size,
          totalItems: entry.totalItems,
          grossSalesKobo: entry.grossSalesKobo,
          commissionKobo: entry.commissionKobo,
          netSalesKobo: entry.netSalesKobo
        }));
    },

    async summarizeSellerPayoutBalances({ commissionRatePercent, sellerId }) {
      const payouts = store.payouts.filter((entry) => (
        entry.payeeType === PAYOUT_PAYEE_TYPES.SELLER
        && entry.sellerId === Number(sellerId)
      ));

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

    async getLogisticsCompanyEarningsSummary({ companyId }) {
      const deliveredJobs = store.deliveryJobs.filter((job) => (
        job.companyId === Number(companyId)
        && job.status === 'delivered'
      ));

      return {
        completedJobsCount: deliveredJobs.length,
        deliveryFeesKobo: deliveredJobs.reduce((sum, job) => sum + Number(job.deliveryFeeKobo || 0), 0),
        platformMarginKobo: deliveredJobs.reduce((sum, job) => sum + Number(job.platformMarginKobo || 0), 0),
        companyShareKobo: deliveredJobs.reduce((sum, job) => sum + Number(job.companyShareKobo || 0), 0)
      };
    },

    async summarizeLogisticsCompanyPayoutBalances({ companyId }) {
      const payouts = store.payouts.filter((entry) => (
        entry.payeeType === PAYOUT_PAYEE_TYPES.LOGISTICS_COMPANY
        && entry.logisticsCompanyId === Number(companyId)
      ));

      return {
        pendingKobo: buildEligibleLogisticsPayoutJobs(companyId)
          .reduce((sum, job) => sum + job.netAmountKobo, 0),
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
        payeeType: PAYOUT_PAYEE_TYPES.SELLER,
        sellerId: Number(sellerId),
        logisticsCompanyId: null,
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
          deliveryJobId: null,
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

    async createLogisticsCompanyPayoutRequest({ bankAccountRef, companyId }) {
      const eligibleJobs = buildEligibleLogisticsPayoutJobs(companyId);

      if (!eligibleJobs.length) {
        return null;
      }

      const now = new Date().toISOString();
      const payout = {
        id: store.counters.payoutId,
        payeeType: PAYOUT_PAYEE_TYPES.LOGISTICS_COMPANY,
        sellerId: null,
        logisticsCompanyId: Number(companyId),
        grossAmountKobo: eligibleJobs.reduce((sum, job) => sum + job.grossAmountKobo, 0),
        commissionAmountKobo: eligibleJobs.reduce((sum, job) => sum + job.commissionAmountKobo, 0),
        amountKobo: eligibleJobs.reduce((sum, job) => sum + job.netAmountKobo, 0),
        status: PAYOUT_STATUSES.REQUESTED,
        bankAccountRef,
        requestedAt: now,
        settledAt: null,
        createdAt: now,
        updatedAt: now
      };

      store.payouts.push(payout);
      store.counters.payoutId += 1;

      for (const job of eligibleJobs) {
        store.payoutItems.push({
          id: store.counters.payoutItemId,
          payoutId: payout.id,
          orderItemId: job.orderItemId,
          deliveryJobId: job.deliveryJobId,
          grossAmountKobo: job.grossAmountKobo,
          commissionAmountKobo: job.commissionAmountKobo,
          netAmountKobo: job.netAmountKobo,
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
          entry.payeeType === PAYOUT_PAYEE_TYPES.SELLER
          && entry.sellerId === Number(sellerId)
          && (!status || entry.status === status)
        ))
        .sort((left, right) => new Date(right.requestedAt) - new Date(left.requestedAt) || right.id - left.id);

      return {
        payouts: matchedPayouts
          .slice(offset, offset + limit)
          .map((entry) => mapPayout(store, entry)),
        total: matchedPayouts.length
      };
    },

    async listPayoutsForAdmin({ companyId, limit, offset, payeeType, search, sellerId, status }) {
      const normalizedSearch = typeof search === 'string' ? search.trim().toLowerCase() : '';
      const matchedPayouts = [];

      for (const payout of store.payouts) {
        if (status && status !== 'all' && payout.status !== status) {
          continue;
        }

        if (payeeType && payeeType !== 'all' && payout.payeeType !== payeeType) {
          continue;
        }

        if (sellerId && payout.sellerId !== Number(sellerId)) {
          continue;
        }

        if (companyId && payout.logisticsCompanyId !== Number(companyId)) {
          continue;
        }

        const sellerAccount = sellersRepository
          && payout.sellerId
          ? await sellersRepository.findBySellerId(Number(payout.sellerId))
          : null;
        const logisticsCompany = payout.logisticsCompanyId
          ? store.logisticsCompanies.find((entry) => entry.id === Number(payout.logisticsCompanyId)) || null
          : null;
        const searchableText = [
          sellerAccount && sellerAccount.sellerProfile.businessName,
          sellerAccount && sellerAccount.user.fullName,
          sellerAccount && sellerAccount.user.email,
          logisticsCompany && logisticsCompany.name,
          logisticsCompany && logisticsCompany.email,
          logisticsCompany && logisticsCompany.phone,
          payout.bankAccountRef
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        if (normalizedSearch && !searchableText.includes(normalizedSearch)) {
          continue;
        }

        matchedPayouts.push(payout);
      }

      matchedPayouts.sort(
        (left, right) => new Date(right.requestedAt) - new Date(left.requestedAt) || right.id - left.id
      );

      return {
        payouts: await Promise.all(
          matchedPayouts
            .slice(offset, offset + limit)
            .map((entry) => buildAdminPayout(entry))
        ),
        total: matchedPayouts.length
      };
    },

    async findPayoutByIdForAdmin(payoutId) {
      const payout = store.payouts.find((entry) => entry.id === Number(payoutId)) || null;

      return payout ? buildAdminPayout(payout) : null;
    },

    async updatePayoutStatusForAdmin({ adminId, payoutId, rejectionReason, status }) {
      const payout = store.payouts.find((entry) => entry.id === Number(payoutId)) || null;

      if (!payout) {
        return null;
      }

      const now = new Date().toISOString();

      payout.status = status;
      payout.updatedAt = now;

      if (status === PAYOUT_STATUSES.APPROVED) {
        payout.approvedBy = Number(adminId);
        payout.approvedAt = now;
        payout.rejectionReason = null;
      }

      if (status === PAYOUT_STATUSES.REJECTED) {
        payout.approvedBy = null;
        payout.approvedAt = null;
        payout.rejectionReason = rejectionReason;
      }

      if (status === PAYOUT_STATUSES.PAID) {
        payout.settledAt = now;
      }

      return buildAdminPayout(payout);
    }
  };
}

module.exports = {
  createInMemorySellerFinanceRepository
};
