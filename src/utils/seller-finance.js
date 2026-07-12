const DEFAULT_PERIOD_DAYS = 30;

function formatDateOnly(value) {
  return value.toISOString().slice(0, 10);
}

function subtractDays(date, days) {
  const result = new Date(date);

  result.setUTCDate(result.getUTCDate() - days);

  return result;
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
  DEFAULT_PERIOD_DAYS,
  formatDateOnly,
  resolveSellerSalesPeriod,
  subtractDays
};
