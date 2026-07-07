function calculateCommissionAmountKobo(grossAmountKobo, commissionRatePercent) {
  return Math.round((Number(grossAmountKobo || 0) * Number(commissionRatePercent || 0)) / 100);
}

function calculateNetAmountKobo(grossAmountKobo, commissionRatePercent) {
  return Number(grossAmountKobo || 0) - calculateCommissionAmountKobo(
    grossAmountKobo,
    commissionRatePercent
  );
}

module.exports = {
  calculateCommissionAmountKobo,
  calculateNetAmountKobo
};
