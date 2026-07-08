const DEFAULT_COMMISSION_RATE_PERCENT = 10;
const DEFAULT_PERIOD_DAYS = 30;

function formatDateOnly(value) {
  return value.toISOString().slice(0, 10);
}

function subtractDays(date, days) {
  const result = new Date(date);

  result.setUTCDate(result.getUTCDate() - days);

  return result;
}

function getCommissionRatePercent(env) {
  // ADMIN-STUB: admin-managed commission configuration can replace this env-backed default later.
  const configuredRate = Number(env && env.PLATFORM_COMMISSION_RATE_PERCENT);

  if (Number.isFinite(configuredRate) && configuredRate >= 0) {
    return configuredRate;
  }

  return DEFAULT_COMMISSION_RATE_PERCENT;
}

function resolveSellerSalesPeriod(query = {}) {
  if (query.dateFrom && query.dateTo) {
    return {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo
    };
  }

  const today = new Date();

  return {
    dateFrom: formatDateOnly(subtractDays(today, DEFAULT_PERIOD_DAYS - 1)),
    dateTo: formatDateOnly(today)
  };
}

module.exports = {
  DEFAULT_COMMISSION_RATE_PERCENT,
  DEFAULT_PERIOD_DAYS,
  formatDateOnly,
  getCommissionRatePercent,
  resolveSellerSalesPeriod,
  subtractDays
};
