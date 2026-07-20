const DEFAULT_DELIVERY_BASE_FEE_KOBO = 100000;
const DEFAULT_DELIVERY_PER_KM_KOBO = 5000;
const DEFAULT_LOGISTICS_PLATFORM_MARGIN_PCT = 10;
const SAME_CITY_DISTANCE_KM = 10;
const SAME_STATE_DISTANCE_KM = 20;
const OTHER_DISTANCE_KM = 35;

function toPositiveNumber(value, fallbackValue) {
  const normalizedValue = Number(value);

  if (!Number.isFinite(normalizedValue) || normalizedValue < 0) {
    return fallbackValue;
  }

  return normalizedValue;
}

function normalizeLocationValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function resolveDeliveryFeeConfig(env = {}) {
  return {
    deliveryBaseFeeKobo: Math.round(toPositiveNumber(
      env.DELIVERY_BASE_FEE_KOBO,
      DEFAULT_DELIVERY_BASE_FEE_KOBO
    )),
    deliveryPerKmKobo: Math.round(toPositiveNumber(
      env.DELIVERY_PER_KM_KOBO,
      DEFAULT_DELIVERY_PER_KM_KOBO
    )),
    logisticsPlatformMarginPercent: toPositiveNumber(
      env.LOGISTICS_PLATFORM_MARGIN_PCT,
      DEFAULT_LOGISTICS_PLATFORM_MARGIN_PCT
    )
  };
}

function calculateShipmentWeightKg({ quantity, weightKgPerUnit = 1 }) {
  const normalizedQuantity = Math.max(1, Math.ceil(toPositiveNumber(quantity, 1)));
  const normalizedWeightKgPerUnit = Math.max(1, toPositiveNumber(weightKgPerUnit, 1));

  return Math.ceil(normalizedQuantity * normalizedWeightKgPerUnit);
}

function resolveDeliveryDistanceKm({ deliveryCity, deliveryState, sellerLocation }) {
  const normalizedSellerLocation = normalizeLocationValue(sellerLocation);
  const normalizedDeliveryCity = normalizeLocationValue(deliveryCity);
  const normalizedDeliveryState = normalizeLocationValue(deliveryState);

  if (
    normalizedSellerLocation
    && normalizedDeliveryCity
    && normalizedSellerLocation.includes(normalizedDeliveryCity)
  ) {
    return SAME_CITY_DISTANCE_KM;
  }

  if (
    normalizedSellerLocation
    && normalizedDeliveryState
    && normalizedSellerLocation.includes(normalizedDeliveryState)
  ) {
    return SAME_STATE_DISTANCE_KM;
  }

  return OTHER_DISTANCE_KM;
}

function calculateDeliveryFeeKobo({
  baseFeeKobo,
  deliveryPerKmKobo,
  distanceKm,
  totalWeightKg
}) {
  const normalizedBaseFeeKobo = Math.round(toPositiveNumber(
    baseFeeKobo,
    DEFAULT_DELIVERY_BASE_FEE_KOBO
  ));
  const normalizedDeliveryPerKmKobo = Math.round(toPositiveNumber(
    deliveryPerKmKobo,
    DEFAULT_DELIVERY_PER_KM_KOBO
  ));
  const normalizedDistanceKm = Math.max(0, Math.ceil(toPositiveNumber(distanceKm, OTHER_DISTANCE_KM)));
  const normalizedWeightKg = Math.max(1, Math.ceil(toPositiveNumber(totalWeightKg, 1)));
  const distanceComponentKobo = normalizedDeliveryPerKmKobo * normalizedDistanceKm;
  const weightSurchargeKobo = normalizedDeliveryPerKmKobo * Math.max(0, normalizedWeightKg - 1);

  return normalizedBaseFeeKobo + distanceComponentKobo + weightSurchargeKobo;
}

function calculateLogisticsSettlement({
  deliveryFeeKobo,
  logisticsPlatformMarginPercent
}) {
  const normalizedDeliveryFeeKobo = Math.max(0, Math.round(toPositiveNumber(deliveryFeeKobo, 0)));
  const normalizedMarginPercent = Math.min(
    100,
    Math.max(0, toPositiveNumber(logisticsPlatformMarginPercent, DEFAULT_LOGISTICS_PLATFORM_MARGIN_PCT))
  );
  const platformMarginKobo = Math.round(
    (normalizedDeliveryFeeKobo * normalizedMarginPercent) / 100
  );

  return {
    platformMarginKobo,
    companyShareKobo: normalizedDeliveryFeeKobo - platformMarginKobo
  };
}

module.exports = {
  DEFAULT_DELIVERY_BASE_FEE_KOBO,
  DEFAULT_DELIVERY_PER_KM_KOBO,
  DEFAULT_LOGISTICS_PLATFORM_MARGIN_PCT,
  OTHER_DISTANCE_KM,
  SAME_CITY_DISTANCE_KM,
  SAME_STATE_DISTANCE_KM,
  calculateDeliveryFeeKobo,
  calculateLogisticsSettlement,
  calculateShipmentWeightKg,
  resolveDeliveryDistanceKm,
  resolveDeliveryFeeConfig
};
