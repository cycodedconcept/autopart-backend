require('../../setup/jest');

const {
  calculateCartSummary,
  calculateLineTotalKobo
} = require('../../../src/utils/cart');

describe('cart utils', () => {
  it('calculates a line total in kobo', () => {
    expect(calculateLineTotalKobo(3, 1850000)).toBe(5550000);
  });

  it('calculates cart summary totals', () => {
    expect(calculateCartSummary([
      {
        quantity: 2,
        unitPriceKobo: 1850000
      },
      {
        quantity: 1,
        unitPriceKobo: 650000
      }
    ], {
      deliveryFeeKobo: 0
    })).toEqual({
      itemCount: 3,
      subtotalKobo: 4350000,
      deliveryFeeKobo: 0,
      totalKobo: 4350000
    });
  });
});
