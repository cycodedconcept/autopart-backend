function calculateLineTotalKobo(quantity, unitPriceKobo) {
  return Number(quantity) * Number(unitPriceKobo);
}

function calculateCartSummary(items, options = {}) {
  const deliveryFeeKobo = Number(options.deliveryFeeKobo || 0);
  const itemCount = items.reduce((total, item) => total + Number(item.quantity), 0);
  const subtotalKobo = items.reduce(
    (total, item) => total + calculateLineTotalKobo(item.quantity, item.unitPriceKobo),
    0
  );

  return {
    itemCount,
    subtotalKobo,
    deliveryFeeKobo,
    totalKobo: subtotalKobo + deliveryFeeKobo
  };
}

module.exports = {
  calculateCartSummary,
  calculateLineTotalKobo
};
