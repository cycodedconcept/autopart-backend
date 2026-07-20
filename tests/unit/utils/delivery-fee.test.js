require('../../setup/jest');

const {
  calculateDeliveryFeeKobo,
  calculateLogisticsSettlement,
  calculateShipmentWeightKg,
  resolveDeliveryDistanceKm
} = require('../../../src/utils/delivery-fee');

describe('delivery fee utils', () => {
  it('calculates a same-state shipment fee with a weight surcharge', () => {
    const totalWeightKg = calculateShipmentWeightKg({
      quantity: 2
    });
    const distanceKm = resolveDeliveryDistanceKm({
      sellerLocation: 'Lagos',
      deliveryCity: 'Ikeja',
      deliveryState: 'Lagos'
    });
    const deliveryFeeKobo = calculateDeliveryFeeKobo({
      baseFeeKobo: 100000,
      deliveryPerKmKobo: 5000,
      distanceKm,
      totalWeightKg
    });

    expect(distanceKm).toBe(20);
    expect(totalWeightKg).toBe(2);
    expect(deliveryFeeKobo).toBe(205000);
  });

  it('splits a delivery fee into platform margin and company share', () => {
    const settlement = calculateLogisticsSettlement({
      deliveryFeeKobo: 205000,
      logisticsPlatformMarginPercent: 10
    });

    expect(settlement).toEqual({
      platformMarginKobo: 20500,
      companyShareKobo: 184500
    });
  });
});
