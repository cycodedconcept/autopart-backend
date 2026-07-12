const {
  PLATFORM_CONFIG_KEYS
} = require('../../../src/config/constants');

function cloneValue(value) {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function createDefaultEntries() {
  return [
    {
      key: PLATFORM_CONFIG_KEYS.COMMISSION_RATE_DEFAULT,
      value: 10
    },
    {
      key: PLATFORM_CONFIG_KEYS.COMMISSION_RATES_BY_CATEGORY,
      value: []
    },
    {
      key: PLATFORM_CONFIG_KEYS.COMMISSION_RATES_BY_SELLER_TIER,
      value: []
    },
    {
      key: PLATFORM_CONFIG_KEYS.PLATFORM_SETTINGS,
      value: {}
    }
  ];
}

function createInMemoryPlatformConfigRepository({ initialEntries = [] } = {}) {
  const entriesByKey = new Map();
  let idCounter = 1;

  function hydrateEntry(entry, existingEntry = null) {
    const now = new Date().toISOString();

    return {
      id: existingEntry ? existingEntry.id : idCounter++,
      key: entry.key,
      value: cloneValue(entry.value),
      createdAt: existingEntry ? existingEntry.createdAt : now,
      updatedAt: now
    };
  }

  for (const entry of [...createDefaultEntries(), ...initialEntries]) {
    entriesByKey.set(entry.key, hydrateEntry(entry, entriesByKey.get(entry.key) || null));
  }

  function cloneEntry(entry) {
    return entry
      ? {
        ...entry,
        value: cloneValue(entry.value)
      }
      : null;
  }

  return {
    async findPlatformConfigByKey(key) {
      return cloneEntry(entriesByKey.get(key) || null);
    },

    async listPlatformConfigByKeys(keys) {
      const matchedEntries = Array.isArray(keys) && keys.length
        ? keys.map((key) => entriesByKey.get(key)).filter(Boolean)
        : Array.from(entriesByKey.values());

      return matchedEntries
        .sort((left, right) => left.key.localeCompare(right.key))
        .map(cloneEntry);
    },

    async upsertPlatformConfigEntries(entries) {
      for (const entry of entries) {
        const existingEntry = entriesByKey.get(entry.key) || null;

        entriesByKey.set(entry.key, hydrateEntry(entry, existingEntry));
      }

      return this.listPlatformConfigByKeys(entries.map((entry) => entry.key));
    }
  };
}

module.exports = {
  createInMemoryPlatformConfigRepository
};
