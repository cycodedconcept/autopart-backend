const {
  PLATFORM_CONFIG_KEYS
} = require('../config/constants');

const DEFAULT_COMMISSION_RATE_PERCENT = 10;

const PLATFORM_CONFIG_FIELDS = {
  commissionRateDefault: PLATFORM_CONFIG_KEYS.COMMISSION_RATE_DEFAULT,
  commissionRatesByCategory: PLATFORM_CONFIG_KEYS.COMMISSION_RATES_BY_CATEGORY,
  commissionRatesBySellerTier: PLATFORM_CONFIG_KEYS.COMMISSION_RATES_BY_SELLER_TIER,
  platformSettings: PLATFORM_CONFIG_KEYS.PLATFORM_SETTINGS
};

function cloneValue(value) {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function isValidRatePercent(value) {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

function normalizeCommissionRateDefault(value, fallbackValue = DEFAULT_COMMISSION_RATE_PERCENT) {
  const normalizedValue = Number(value);

  return isValidRatePercent(normalizedValue) ? normalizedValue : fallbackValue;
}

function normalizeCommissionRatesByCategory(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry) => (
      entry
      && Number.isInteger(Number(entry.categoryId))
      && Number(entry.categoryId) > 0
      && isValidRatePercent(Number(entry.ratePercent))
    ))
    .map((entry) => ({
      categoryId: Number(entry.categoryId),
      ratePercent: Number(entry.ratePercent)
    }));
}

function normalizeCommissionRatesBySellerTier(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry) => (
      entry
      && typeof entry.tier === 'string'
      && entry.tier.trim()
      && isValidRatePercent(Number(entry.ratePercent))
    ))
    .map((entry) => ({
      tier: entry.tier.trim(),
      ratePercent: Number(entry.ratePercent)
    }));
}

function normalizePlatformSettings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return cloneValue(value);
}

function buildPlatformConfig(entries = [], env = {}) {
  const entriesByKey = new Map(entries.map((entry) => [entry.key, entry]));
  const fallbackCommissionRatePercent = normalizeCommissionRateDefault(
    env.PLATFORM_COMMISSION_RATE_PERCENT
  );

  return {
    commissionRateDefault: normalizeCommissionRateDefault(
      entriesByKey.get(PLATFORM_CONFIG_FIELDS.commissionRateDefault)?.value,
      fallbackCommissionRatePercent
    ),
    commissionRatesByCategory: normalizeCommissionRatesByCategory(
      entriesByKey.get(PLATFORM_CONFIG_FIELDS.commissionRatesByCategory)?.value
    ),
    commissionRatesBySellerTier: normalizeCommissionRatesBySellerTier(
      entriesByKey.get(PLATFORM_CONFIG_FIELDS.commissionRatesBySellerTier)?.value
    ),
    platformSettings: normalizePlatformSettings(
      entriesByKey.get(PLATFORM_CONFIG_FIELDS.platformSettings)?.value
    )
  };
}

function buildPlatformConfigEntries(config) {
  return [
    {
      key: PLATFORM_CONFIG_FIELDS.commissionRateDefault,
      value: normalizeCommissionRateDefault(config.commissionRateDefault)
    },
    {
      key: PLATFORM_CONFIG_FIELDS.commissionRatesByCategory,
      value: normalizeCommissionRatesByCategory(config.commissionRatesByCategory)
    },
    {
      key: PLATFORM_CONFIG_FIELDS.commissionRatesBySellerTier,
      value: normalizeCommissionRatesBySellerTier(config.commissionRatesBySellerTier)
    },
    {
      key: PLATFORM_CONFIG_FIELDS.platformSettings,
      value: normalizePlatformSettings(config.platformSettings)
    }
  ];
}

async function resolveCommissionRatePercent({ env = {}, platformConfigRepository }) {
  if (
    platformConfigRepository
    && typeof platformConfigRepository.findPlatformConfigByKey === 'function'
  ) {
    const entry = await platformConfigRepository.findPlatformConfigByKey(
      PLATFORM_CONFIG_FIELDS.commissionRateDefault
    );

    if (entry && isValidRatePercent(Number(entry.value))) {
      return Number(entry.value);
    }
  }

  return normalizeCommissionRateDefault(env.PLATFORM_COMMISSION_RATE_PERCENT);
}

module.exports = {
  DEFAULT_COMMISSION_RATE_PERCENT,
  PLATFORM_CONFIG_FIELDS,
  buildPlatformConfig,
  buildPlatformConfigEntries,
  normalizeCommissionRateDefault,
  normalizeCommissionRatesByCategory,
  normalizeCommissionRatesBySellerTier,
  normalizePlatformSettings,
  resolveCommissionRatePercent
};
