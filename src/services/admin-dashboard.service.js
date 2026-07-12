const { ERROR_CODES } = require('../config/constants');
const AppError = require('../utils/app-error');
const {
  resolveCommissionRatePercent
} = require('../utils/platform-config');
const { sanitizeSellerAccount } = require('../utils/seller');
const { sanitizeUser } = require('../utils/user');

const DASHBOARD_PREVIEW_LIMIT = 5;
const DASHBOARD_PERIOD_DAYS = 30;
const DISPUTE_REVIEW_SLA_HOURS = 24;
const DISPUTE_URGENT_WINDOW_HOURS = 6;
const PREVIOUS_PERIOD_LABEL = 'vs previous 30 days';
const PREVIOUS_DAY_LABEL = 'vs yesterday';

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function subtractDays(date, days) {
  const clonedDate = new Date(date.getTime());

  clonedDate.setUTCDate(clonedDate.getUTCDate() - Number(days || 0));

  return clonedDate;
}

function resolveDashboardComparisonWindow(now = new Date()) {
  const anchorDate = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  ));

  return {
    todayDate: formatDateOnly(anchorDate),
    yesterdayDate: formatDateOnly(subtractDays(anchorDate, 1)),
    currentPeriodDateFrom: formatDateOnly(subtractDays(anchorDate, DASHBOARD_PERIOD_DAYS - 1)),
    currentPeriodDateTo: formatDateOnly(anchorDate),
    previousPeriodDateFrom: formatDateOnly(subtractDays(anchorDate, DASHBOARD_PERIOD_DAYS * 2 - 1)),
    previousPeriodDateTo: formatDateOnly(subtractDays(anchorDate, DASHBOARD_PERIOD_DAYS))
  };
}

function roundToOneDecimal(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function buildPercent(numerator, denominator) {
  if (!denominator) {
    return 0;
  }

  return roundToOneDecimal((Number(numerator || 0) / Number(denominator || 0)) * 100);
}

function buildTrend(currentValue, previousValue, label = PREVIOUS_PERIOD_LABEL) {
  const normalizedCurrentValue = Number(currentValue || 0);
  const normalizedPreviousValue = Number(previousValue || 0);
  const delta = normalizedCurrentValue - normalizedPreviousValue;
  let changePercent = 0;

  if (normalizedPreviousValue === 0) {
    changePercent = normalizedCurrentValue === 0 ? 0 : 100;
  } else {
    changePercent = roundToOneDecimal((delta / normalizedPreviousValue) * 100);
  }

  return {
    label,
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
    changePercent,
    delta,
    currentValue: normalizedCurrentValue,
    previousValue: normalizedPreviousValue
  };
}

function formatEntityCode(prefix, id) {
  return `#${prefix}-${String(id).padStart(4, '0')}`;
}

function resolveOperationalStatus(value, thresholds) {
  if (value >= thresholds.critical) {
    return 'critical';
  }

  if (value >= thresholds.warning) {
    return 'warning';
  }

  return 'healthy';
}

function buildDisputeSla(createdAt, now = new Date()) {
  const createdAtDate = new Date(createdAt);
  const ageHours = Math.max(
    Math.floor((now.getTime() - createdAtDate.getTime()) / (1000 * 60 * 60)),
    0
  );
  const remainingHours = DISPUTE_REVIEW_SLA_HOURS - ageHours;
  let state = 'healthy';
  let label = `${remainingHours}h left`;

  if (remainingHours <= 0) {
    state = 'critical';
    label = `${Math.abs(remainingHours)}h overdue`;
  } else if (remainingHours <= DISPUTE_URGENT_WINDOW_HOURS) {
    state = 'warning';
  }

  return {
    reviewSlaHours: DISPUTE_REVIEW_SLA_HOURS,
    ageHours,
    remainingHours,
    state,
    label
  };
}

function buildSellerLabel(primarySellerBusinessName, sellerCount) {
  if (!primarySellerBusinessName) {
    return 'Marketplace Order';
  }

  if (Number(sellerCount || 0) <= 1) {
    return primarySellerBusinessName;
  }

  return `${primarySellerBusinessName} +${Number(sellerCount) - 1} more`;
}

function mapSellerVerificationQueueItem(sellerAccount, now = new Date()) {
  const sanitizedAccount = sanitizeSellerAccount(sellerAccount, sanitizeUser);
  const createdAtDate = new Date(sanitizedAccount.sellerProfile.createdAt);
  const pendingSinceDays = Math.max(
    Math.floor((now.getTime() - createdAtDate.getTime()) / (1000 * 60 * 60 * 24)),
    0
  );

  return {
    sellerId: sanitizedAccount.sellerProfile.id,
    businessName: sanitizedAccount.sellerProfile.businessName,
    contactEmail: sanitizedAccount.sellerProfile.contactEmail,
    contactPhone: sanitizedAccount.sellerProfile.contactPhone,
    cacNumber: sanitizedAccount.sellerProfile.cacNumber,
    verificationStatus: sanitizedAccount.sellerProfile.verificationStatus,
    submittedAt: sanitizedAccount.sellerProfile.createdAt,
    updatedAt: sanitizedAccount.sellerProfile.updatedAt,
    pendingSinceDays
  };
}

function mapOpenDisputeItem(dispute, now = new Date()) {
  return {
    disputeId: dispute.id,
    orderId: dispute.orderId,
    orderCode: formatEntityCode('ORD', dispute.orderId),
    buyerName: dispute.buyer ? dispute.buyer.fullName : null,
    buyerEmail: dispute.buyer ? dispute.buyer.email : null,
    amountKobo: dispute.order ? dispute.order.totalKobo : 0,
    raisedBy: dispute.raisedBy,
    status: dispute.status,
    createdAt: dispute.createdAt,
    sellers: dispute.sellers || [],
    sla: buildDisputeSla(dispute.createdAt, now)
  };
}

function mapRecentOrderItem(order) {
  return {
    orderId: order.id,
    orderCode: formatEntityCode('ORD', order.id),
    sellerLabel: buildSellerLabel(order.primarySellerBusinessName, order.sellerCount),
    sellerCount: order.sellerCount,
    totalKobo: order.totalKobo,
    status: order.status,
    paymentStatus: order.paymentStatus,
    createdAt: order.createdAt
  };
}

function mapTopSellerItem(seller, index) {
  return {
    rank: index + 1,
    sellerId: seller.sellerId,
    userId: seller.userId,
    businessName: seller.businessName,
    fullName: seller.fullName,
    email: seller.email,
    phone: seller.phone,
    totalOrders: seller.totalOrders,
    totalItems: seller.totalItems,
    grossSalesKobo: seller.grossSalesKobo
  };
}

function mapPayoutQueueItem(payout, now = new Date()) {
  const requestedAtDate = new Date(payout.requestedAt);
  const waitDays = Math.max(
    Math.floor((now.getTime() - requestedAtDate.getTime()) / (1000 * 60 * 60 * 24)),
    0
  );

  return {
    payoutId: payout.payoutId,
    sellerId: payout.sellerId,
    userId: payout.userId,
    businessName: payout.businessName,
    fullName: payout.fullName,
    email: payout.email,
    amountKobo: payout.amountKobo,
    status: payout.status,
    requestedAt: payout.requestedAt,
    approvedAt: payout.approvedAt,
    waitDays
  };
}

function buildActivitySummary(log) {
  const detail = log.detail || {};

  switch (log.action) {
    case 'platform_config.updated':
      return 'Platform configuration updated.';
    case 'order_status.updated':
      return `Order ${formatEntityCode('ORD', log.targetId)} moved to ${detail.nextStatus}.`;
    case 'user_status.updated':
      return `User #${log.targetId} moved to ${detail.nextStatus}.`;
    case 'seller_verification.verified':
      return `Seller #${log.targetId} approved.`;
    case 'seller_verification.rejected':
      return `Seller #${log.targetId} rejected.`;
    case 'payout.approved':
      return `Payout #${log.targetId} approved.`;
    case 'payout.rejected':
      return `Payout #${log.targetId} rejected.`;
    case 'payout.paid':
      return `Payout #${log.targetId} marked as paid.`;
    case 'dispute.resolved':
      return `Dispute #${log.targetId} resolved.`;
    case 'dispute.rejected':
      return `Dispute #${log.targetId} rejected.`;
    default:
      return `${log.action} recorded for ${log.targetType} #${log.targetId}.`;
  }
}

function mapRecentActivityItem(log) {
  return {
    auditLogId: log.id,
    action: log.action,
    targetType: log.targetType,
    targetId: log.targetId,
    actorName: log.admin ? log.admin.fullName : null,
    createdAt: log.createdAt,
    summary: buildActivitySummary(log)
  };
}

function buildPlatformHealth(summary) {
  const sellerNetRevenueKobo = Math.max(
    Number(summary.platformGmvKobo || 0) - Number(summary.totalRevenueKobo || 0),
    0
  );
  const revenueMixTotal = sellerNetRevenueKobo
    + Number(summary.totalRevenueKobo || 0)
    + Number(summary.pendingPayoutQueueAmountKobo || 0);
  const disputeResolutionRatePercent = buildPercent(
    summary.resolvedDisputesCount,
    summary.totalDisputesCount
  );
  const payoutCompletionRatePercent = buildPercent(
    summary.paidPayoutsCount,
    summary.totalPayoutsCount
  );
  const sellerApprovalRatePercent = buildPercent(
    summary.verifiedSellersCount,
    summary.verifiedSellersCount + summary.rejectedSellersCount
  );

  return {
    status: summary.failedPayoutsCount > 0
      ? 'critical'
      : summary.urgentOpenDisputesCount > 0
        ? 'warning'
        : 'healthy',
    revenueMix: [
      {
        label: 'Seller Net',
        amountKobo: sellerNetRevenueKobo,
        percentage: buildPercent(sellerNetRevenueKobo, revenueMixTotal)
      },
      {
        label: 'Platform Commission',
        amountKobo: summary.totalRevenueKobo,
        percentage: buildPercent(summary.totalRevenueKobo, revenueMixTotal)
      },
      {
        label: 'Pending Settlements',
        amountKobo: summary.pendingPayoutQueueAmountKobo,
        percentage: buildPercent(summary.pendingPayoutQueueAmountKobo, revenueMixTotal)
      }
    ],
    metrics: {
      disputeResolutionRatePercent,
      payoutCompletionRatePercent,
      sellerApprovalRatePercent
    }
  };
}

function ensureDashboardRepository(adminDashboardRepository) {
  if (!adminDashboardRepository) {
    throw new AppError('Admin dashboard is unavailable.', {
      statusCode: 500,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR
    });
  }

  const requiredMethods = [
    'getDashboardSummary',
    'listRecentOrders',
    'listTopSellers',
    'listPayoutQueue'
  ];

  for (const methodName of requiredMethods) {
    if (typeof adminDashboardRepository[methodName] !== 'function') {
      throw new AppError('Admin dashboard is unavailable.', {
        statusCode: 500,
        code: ERROR_CODES.INTERNAL_SERVER_ERROR
      });
    }
  }
}

function createAdminDashboardService({
  adminDashboardRepository,
  adminRepository,
  auditLogRepository,
  disputesRepository,
  env,
  platformConfigRepository
}) {
  ensureDashboardRepository(adminDashboardRepository);

  return {
    async getDashboard() {
      const now = new Date();
      const comparison = resolveDashboardComparisonWindow(now);
      const commissionRatePercent = await resolveCommissionRatePercent({
        env,
        platformConfigRepository
      });
      const [
        summary,
        recentOrdersResult,
        topSellersResult,
        payoutQueueResult,
        sellerVerificationQueueResult,
        openDisputesResult,
        recentActivityResult
      ] = await Promise.all([
        adminDashboardRepository.getDashboardSummary({
          ...comparison,
          commissionRatePercent,
          reviewSlaHours: DISPUTE_REVIEW_SLA_HOURS,
          urgentWindowHours: DISPUTE_URGENT_WINDOW_HOURS
        }),
        adminDashboardRepository.listRecentOrders({
          limit: DASHBOARD_PREVIEW_LIMIT
        }),
        adminDashboardRepository.listTopSellers({
          limit: DASHBOARD_PREVIEW_LIMIT
        }),
        adminDashboardRepository.listPayoutQueue({
          limit: DASHBOARD_PREVIEW_LIMIT
        }),
        adminRepository.listSellerVerificationQueue({
          status: 'pending',
          limit: DASHBOARD_PREVIEW_LIMIT,
          offset: 0
        }),
        disputesRepository.listDisputesForAdmin({
          status: 'open',
          raisedBy: 'all',
          search: null,
          limit: DASHBOARD_PREVIEW_LIMIT,
          offset: 0
        }),
        auditLogRepository && typeof auditLogRepository.listAuditLogs === 'function'
          ? auditLogRepository.listAuditLogs({
            adminId: null,
            action: null,
            targetType: null,
            targetId: null,
            limit: DASHBOARD_PREVIEW_LIMIT,
            offset: 0
          })
          : Promise.resolve({
            logs: [],
            total: 0
          })
      ]);

      const openDisputeItems = openDisputesResult.disputes
        .map((dispute) => mapOpenDisputeItem(dispute, now))
        .sort((left, right) => (
          left.sla.remainingHours - right.sla.remainingHours
          || new Date(left.createdAt) - new Date(right.createdAt)
        ));

      return {
        generatedAt: now.toISOString(),
        commissionRatePercent,
        comparison: {
          currentPeriod: {
            dateFrom: comparison.currentPeriodDateFrom,
            dateTo: comparison.currentPeriodDateTo
          },
          previousPeriod: {
            dateFrom: comparison.previousPeriodDateFrom,
            dateTo: comparison.previousPeriodDateTo
          }
        },
        alerts: {
          openDisputes: {
            label: 'Open Disputes',
            count: summary.openDisputesCount,
            urgentCount: summary.urgentOpenDisputesCount,
            reviewSlaHours: DISPUTE_REVIEW_SLA_HOURS,
            severity: summary.urgentOpenDisputesCount > 0
              ? 'critical'
              : summary.openDisputesCount > 0
                ? 'warning'
                : 'healthy'
          },
          pendingVerifications: {
            label: 'Pending Verifications',
            count: summary.pendingVerificationsCount,
            severity: summary.pendingVerificationsCount > 0 ? 'warning' : 'healthy'
          },
          payoutRequests: {
            label: 'Payout Requests',
            count: summary.payoutRequestsCount,
            pendingAmountKobo: summary.payoutRequestsAmountKobo,
            currency: 'NGN',
            severity: summary.payoutRequestsCount > 0 ? 'warning' : 'healthy'
          }
        },
        overviewCards: {
          totalRevenue: {
            label: 'Total Revenue',
            valueKobo: summary.totalRevenueKobo,
            currency: 'NGN',
            trend: buildTrend(summary.currentRevenueKobo, summary.previousRevenueKobo)
          },
          activeSellers: {
            label: 'Active Sellers',
            value: summary.activeSellersCount,
            trend: buildTrend(
              summary.currentActiveSellersCount,
              summary.previousActiveSellersCount
            )
          },
          ordersToday: {
            label: 'Orders Today',
            value: summary.ordersTodayCount,
            trend: buildTrend(
              summary.ordersTodayCount,
              summary.ordersYesterdayCount,
              PREVIOUS_DAY_LABEL
            )
          },
          platformGmv: {
            label: 'Platform GMV',
            valueKobo: summary.platformGmvKobo,
            currency: 'NGN',
            trend: buildTrend(summary.currentPlatformGmvKobo, summary.previousPlatformGmvKobo)
          }
        },
        operationalCards: {
          disputeRate: {
            label: 'Dispute Rate',
            valuePercent: buildPercent(summary.openDisputesCount, summary.totalOrdersCount),
            status: resolveOperationalStatus(
              buildPercent(summary.openDisputesCount, summary.totalOrdersCount),
              {
                warning: 3,
                critical: 7
              }
            )
          },
          averagePayoutTime: {
            label: 'Avg Payout Time',
            valueDays: summary.averagePayoutTimeDays === null
              ? null
              : roundToOneDecimal(summary.averagePayoutTimeDays),
            status: summary.averagePayoutTimeDays === null
              ? 'healthy'
              : resolveOperationalStatus(summary.averagePayoutTimeDays, {
                warning: 2,
                critical: 5
              })
          },
          verificationQueue: {
            label: 'Verification Queue',
            value: summary.pendingVerificationsCount,
            status: resolveOperationalStatus(summary.pendingVerificationsCount, {
              warning: 1,
              critical: 6
            })
          },
          failedPayouts: {
            label: 'Failed Payouts',
            value: summary.failedPayoutsCount,
            status: summary.failedPayoutsCount > 0 ? 'critical' : 'healthy'
          }
        },
        sellerVerificationQueue: {
          total: sellerVerificationQueueResult.total,
          items: sellerVerificationQueueResult.sellers.map((sellerAccount) => (
            mapSellerVerificationQueueItem(sellerAccount, now)
          ))
        },
        openDisputes: {
          total: openDisputesResult.total,
          reviewSlaHours: DISPUTE_REVIEW_SLA_HOURS,
          items: openDisputeItems
        },
        recentOrders: {
          total: recentOrdersResult.total,
          items: recentOrdersResult.orders.map(mapRecentOrderItem)
        },
        topSellers: {
          total: topSellersResult.total,
          items: topSellersResult.sellers.map(mapTopSellerItem)
        },
        platformHealth: buildPlatformHealth(summary),
        payoutQueue: {
          total: payoutQueueResult.total,
          pendingAmountKobo: payoutQueueResult.pendingAmountKobo,
          currency: 'NGN',
          items: payoutQueueResult.payouts.map((payout) => mapPayoutQueueItem(payout, now))
        },
        recentActivity: recentActivityResult.logs.map(mapRecentActivityItem)
      };
    }
  };
}

module.exports = {
  createAdminDashboardService
};
