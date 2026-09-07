const DAY_MS = 86400000;
const LAGOS_OFFSET_MS = 3600000;

function lagosDate(value = new Date()) {
  return new Date(new Date(value).getTime() + LAGOS_OFFSET_MS).toISOString().slice(0, 10);
}

function dateEpoch(date) {
  return Date.parse(`${date}T00:00:00+01:00`) / 1000;
}

function addDays(date, days) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function monday(date) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((day + 6) % 7));
}

function nextMonth(date) {
  const value = new Date(`${date.slice(0, 7)}-01T00:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + 1);
  return value.toISOString().slice(0, 10);
}

function analyticsWindow(period, now = new Date()) {
  const days = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }[period];
  const dateTo = addDays(lagosDate(now), 1);
  const dateFrom = addDays(dateTo, -days);
  const bucketType = period === '1y' ? 'monthly' : period === '90d' ? 'weekly' : 'daily';
  const buckets = [];
  let bucket = bucketType === 'monthly' ? `${dateFrom.slice(0, 7)}-01`
    : bucketType === 'weekly' ? monday(dateFrom) : dateFrom;
  while (bucket < dateTo) {
    buckets.push(bucket);
    bucket = bucketType === 'monthly' ? nextMonth(bucket)
      : addDays(bucket, bucketType === 'weekly' ? 7 : 1);
  }
  const currentMonday = monday(lagosDate(now));
  const weeks = Array.from({ length: 8 }, (_, index) => addDays(currentMonday, (index - 7) * 7));
  return {
    period, bucketType, buckets, weeks, dateFrom, dateTo,
    currentFrom: dateEpoch(dateFrom), currentTo: dateEpoch(dateTo),
    previousFrom: dateEpoch(addDays(dateFrom, -days)),
    weeksFrom: dateEpoch(weeks[0])
  };
}

function jsonValue(value, fallback = []) {
  if (value === null || value === undefined) return fallback;
  return typeof value === 'string' ? JSON.parse(value) : value;
}

function epochIso(value) {
  return value === null || value === undefined ? null : new Date(Number(value) * 1000).toISOString();
}

async function disputeSlaHours(platformConfigRepository) {
  const entry = await platformConfigRepository.findPlatformConfigByKey('platform_settings');
  const hours = Number(entry && entry.value && entry.value.disputeReviewSlaHours);
  return Number.isInteger(hours) && hours > 0 && hours <= 8760 ? hours : 24;
}

function disputeSla(dispute, hours, now = new Date()) {
  const deadline = new Date(dispute.createdAt).getTime() + hours * 3600000;
  // Terminal cases stop the clock at their recorded resolution/closure.
  const stoppedAt = ['resolved', 'rejected', 'closed'].includes(dispute.status)
    ? (dispute.resolvedAt || dispute.closedAt) : null;
  const elapsedAt = stoppedAt ? new Date(stoppedAt).getTime() : now.getTime();
  return {
    deadlineAt: new Date(deadline).toISOString(),
    remainingMinutes: Math.floor((deadline - elapsedAt) / 60000),
    breached: elapsedAt > deadline
  };
}

module.exports = { analyticsWindow, dateEpoch, disputeSla, disputeSlaHours, epochIso, jsonValue };
