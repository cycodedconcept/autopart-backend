require('../../setup/jest');

const {
  calculateCommissionAmountKobo,
  calculateNetAmountKobo
} = require('../../../src/utils/money');

describe('money utils', () => {
  it('calculates commission in kobo using the configured percentage', () => {
    expect(calculateCommissionAmountKobo(9000000, 10)).toBe(900000);
  });

  it('calculates the net payout amount after commission', () => {
    expect(calculateNetAmountKobo(9000000, 10)).toBe(8100000);
  });
});
