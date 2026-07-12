function parseJsonValue(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
}

function mapPlatformConfigRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    key: row.key,
    value: parseJsonValue(row.value),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function createPlatformConfigRepository({ db }) {
  return {
    async findPlatformConfigByKey(key) {
      const [rows] = await db.execute(
        `
          SELECT
            id,
            \`key\`,
            value,
            created_at,
            updated_at
          FROM platform_config
          WHERE \`key\` = ?
          LIMIT 1
        `,
        [key]
      );

      return mapPlatformConfigRow(rows[0]);
    },

    async listPlatformConfigByKeys(keys) {
      if (!Array.isArray(keys) || !keys.length) {
        const [rows] = await db.execute(
          `
            SELECT
              id,
              \`key\`,
              value,
              created_at,
              updated_at
            FROM platform_config
            ORDER BY \`key\` ASC
          `
        );

        return rows.map(mapPlatformConfigRow);
      }

      const placeholders = keys.map(() => '?').join(', ');
      const [rows] = await db.execute(
        `
          SELECT
            id,
            \`key\`,
            value,
            created_at,
            updated_at
          FROM platform_config
          WHERE \`key\` IN (${placeholders})
          ORDER BY \`key\` ASC
        `,
        keys
      );

      return rows.map(mapPlatformConfigRow);
    },

    async upsertPlatformConfigEntries(entries) {
      if (!Array.isArray(entries) || !entries.length) {
        return [];
      }

      for (const entry of entries) {
        await db.execute(
          `
            INSERT INTO platform_config (
              \`key\`,
              value
            )
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE
              value = VALUES(value),
              updated_at = CURRENT_TIMESTAMP
          `,
          [entry.key, JSON.stringify(entry.value)]
        );
      }

      return this.listPlatformConfigByKeys(entries.map((entry) => entry.key));
    }
  };
}

module.exports = {
  createPlatformConfigRepository
};
