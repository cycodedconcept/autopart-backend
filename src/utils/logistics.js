function sanitizeLogisticsCompany(company) {
  if (!company) {
    return null;
  }

  return {
    id: company.id,
    name: company.name,
    email: company.email,
    phone: company.phone,
    address: company.address,
    status: company.status,
    approvedBy: company.approvedBy,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt
  };
}

function sanitizeDeliveryZone(zone) {
  if (!zone) {
    return null;
  }

  return {
    id: zone.id,
    name: zone.name,
    state: zone.state,
    city: zone.city,
    createdAt: zone.createdAt,
    updatedAt: zone.updatedAt
  };
}

function sanitizeRider(rider) {
  if (!rider) {
    return null;
  }

  return {
    id: rider.id,
    companyId: rider.companyId,
    zoneId: rider.zoneId,
    fullName: rider.fullName,
    phone: rider.phone,
    email: rider.email,
    vehicleType: rider.vehicleType,
    status: rider.status,
    accountStatus: rider.accountStatus || 'active',
    createdAt: rider.createdAt,
    updatedAt: rider.updatedAt,
    zone: sanitizeDeliveryZone(rider.zone || null)
  };
}

function calculateCompletionRatePercent({ deliveredCount = 0, failedCount = 0 }) {
  const completedAttemptCount = Number(deliveredCount) + Number(failedCount);

  if (!completedAttemptCount) {
    return 0;
  }

  return Number(((Number(deliveredCount) / completedAttemptCount) * 100).toFixed(2));
}

function buildDeliveryJobsByStatus(summary = {}) {
  return {
    total: Number(summary.totalJobsCount) || 0,
    pending: Number(summary.pendingCount) || 0,
    assigned: Number(summary.assignedCount) || 0,
    picked_up: Number(summary.pickedUpCount) || 0,
    in_transit: Number(summary.inTransitCount) || 0,
    delivered: Number(summary.deliveredCount) || 0,
    failed: Number(summary.failedCount) || 0,
    cancelled: Number(summary.cancelledCount) || 0
  };
}

function buildDeliveryMetrics(summary = {}) {
  const deliveredCount = Number(summary.deliveredCount) || 0;
  const failedCount = Number(summary.failedCount) || 0;

  return {
    totalJobsCount: Number(summary.totalJobsCount) || 0,
    unassignedJobsCount: Number(summary.unassignedJobsCount) || 0,
    activeJobsCount: Number(summary.activeJobsCount) || 0,
    deliveredJobsCount: deliveredCount,
    failedJobsCount: failedCount,
    completionRatePercent: calculateCompletionRatePercent({
      deliveredCount,
      failedCount
    }),
    deliveryFeesKobo: Number(summary.deliveryFeesKobo) || 0,
    platformMarginKobo: Number(summary.platformMarginKobo) || 0,
    companyShareKobo: Number(summary.companyShareKobo) || 0,
    averageDeliveryFeeKobo: Number(summary.averageDeliveryFeeKobo) || 0
  };
}

function buildRiderStatusSummary(summary = {}) {
  return {
    totalRidersCount: Number(summary.totalRidersCount) || 0,
    availableCount: Number(summary.availableCount) || 0,
    onDeliveryCount: Number(summary.onDeliveryCount) || 0,
    unavailableCount: Number(summary.unavailableCount) || 0,
    inactiveCount: Number(summary.inactiveCount) || 0
  };
}

module.exports = {
  buildDeliveryJobsByStatus,
  buildDeliveryMetrics,
  buildRiderStatusSummary,
  calculateCompletionRatePercent,
  sanitizeDeliveryZone,
  sanitizeLogisticsCompany,
  sanitizeRider
};
