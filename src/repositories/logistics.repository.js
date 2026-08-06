const { sanitizeLimitOffset } = require('./pagination.repository');

function toNumber(value) {
  return value === null || value === undefined ? null : Number(value);
}

function mapDeliveryZoneRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.zone_id),
    name: row.zone_name,
    state: row.zone_state,
    city: row.zone_city,
    createdAt: row.zone_created_at,
    updatedAt: row.zone_updated_at
  };
}

function mapLogisticsCompanyRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.company_id),
    name: row.company_name,
    email: row.company_email,
    phone: row.company_phone,
    passwordHash: row.company_password_hash,
    address: row.company_address,
    status: row.company_status,
    approvedBy: toNumber(row.company_approved_by),
    createdAt: row.company_created_at,
    updatedAt: row.company_updated_at
  };
}

function mapRiderRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.rider_id),
    companyId: Number(row.rider_company_id),
    zoneId: Number(row.rider_zone_id),
    fullName: row.rider_full_name,
    phone: row.rider_phone,
    email: row.rider_email,
    passwordHash: row.rider_password_hash,
    vehicleType: row.rider_vehicle_type,
    status: row.rider_availability_status,
    accountStatus: row.rider_account_status || 'active',
    createdAt: row.rider_created_at,
    updatedAt: row.rider_updated_at,
    zone: row.zone_id ? mapDeliveryZoneRow(row) : null,
    company: row.company_id
      ? mapLogisticsCompanyRow(row)
      : null
  };
}

const logisticsCompanySelectSql = `
  lc.id AS company_id,
  lc.name AS company_name,
  lc.email AS company_email,
  lc.phone AS company_phone,
  lc.password_hash AS company_password_hash,
  lc.address AS company_address,
  lc.status AS company_status,
  lc.approved_by AS company_approved_by,
  lc.created_at AS company_created_at,
  lc.updated_at AS company_updated_at
`;

const riderSelectSql = `
  r.id AS rider_id,
  r.company_id AS rider_company_id,
  r.zone_id AS rider_zone_id,
  r.full_name AS rider_full_name,
  r.phone AS rider_phone,
  r.email AS rider_email,
  r.password_hash AS rider_password_hash,
  r.vehicle_type AS rider_vehicle_type,
  r.availability_status AS rider_availability_status,
  r.status AS rider_account_status,
  r.created_at AS rider_created_at,
  r.updated_at AS rider_updated_at,
  dz.id AS zone_id,
  dz.name AS zone_name,
  dz.state AS zone_state,
  dz.city AS zone_city,
  dz.created_at AS zone_created_at,
  dz.updated_at AS zone_updated_at,
  lc.id AS company_id,
  lc.name AS company_name,
  lc.email AS company_email,
  lc.phone AS company_phone,
  lc.password_hash AS company_password_hash,
  lc.address AS company_address,
  lc.status AS company_status,
  lc.approved_by AS company_approved_by,
  lc.created_at AS company_created_at,
  lc.updated_at AS company_updated_at
`;

function buildCompanyFilters(filters = {}, options = {}) {
  const whereClauses = [];
  const params = [];

  if (!options.ignoreStatus && filters.status && filters.status !== 'all') {
    whereClauses.push('lc.status = ?');
    params.push(filters.status);
  }

  if (filters.search) {
    const searchPattern = `%${String(filters.search).trim().toLowerCase()}%`;

    whereClauses.push(`
      (
        LOWER(lc.name) LIKE ?
        OR LOWER(lc.email) LIKE ?
        OR LOWER(lc.phone) LIKE ?
        OR LOWER(lc.address) LIKE ?
      )
    `);
    params.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }

  return {
    whereSql: whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '',
    params
  };
}

function buildRiderFilters(filters = {}, options = {}) {
  const whereClauses = [];
  const params = [];

  if (filters.companyId) {
    whereClauses.push('r.company_id = ?');
    params.push(filters.companyId);
  }

  if (!options.ignoreStatus && filters.status && filters.status !== 'all') {
    whereClauses.push('r.availability_status = ?');
    params.push(filters.status);
  }

  if (filters.search) {
    const searchPattern = `%${String(filters.search).trim().toLowerCase()}%`;

    whereClauses.push(`
      (
        LOWER(r.full_name) LIKE ?
        OR LOWER(r.email) LIKE ?
        OR LOWER(r.phone) LIKE ?
        OR LOWER(r.vehicle_type) LIKE ?
        OR LOWER(lc.name) LIKE ?
        OR LOWER(dz.name) LIKE ?
        OR LOWER(dz.city) LIKE ?
        OR LOWER(dz.state) LIKE ?
      )
    `);
    params.push(
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern
    );
  }

  return {
    whereSql: whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '',
    params
  };
}

function mapCompanySummaryRow(row) {
  return {
    totalCompaniesCount: Number(row && row.total_companies_count) || 0,
    pendingCount: Number(row && row.pending_count) || 0,
    approvedCount: Number(row && row.approved_count) || 0,
    suspendedCount: Number(row && row.suspended_count) || 0
  };
}

function mapRiderSummaryRow(row) {
  return {
    totalRidersCount: Number(row && row.total_riders_count) || 0,
    availableCount: Number(row && row.available_count) || 0,
    onDeliveryCount: Number(row && row.on_delivery_count) || 0,
    unavailableCount: Number(row && row.unavailable_count) || 0,
    inactiveCount: Number(row && row.inactive_count) || 0
  };
}

function createLogisticsRepository({ db }) {
  return {
    async createLogisticsCompany(payload) {
      const [result] = await db.execute(
        `
          INSERT INTO logistics_companies (
            name,
            email,
            phone,
            password_hash,
            address,
            status,
            approved_by
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          payload.name,
          payload.email,
          payload.phone,
          payload.passwordHash,
          payload.address,
          payload.status,
          payload.approvedBy || null
        ]
      );

      return this.findCompanyById(result.insertId);
    },

    async findCompanyByEmail(email) {
      const [rows] = await db.execute(
        `
          SELECT ${logisticsCompanySelectSql}
          FROM logistics_companies lc
          WHERE lc.email = ?
          LIMIT 1
        `,
        [email]
      );

      return mapLogisticsCompanyRow(rows[0]);
    },

    async findCompanyById(companyId) {
      const [rows] = await db.execute(
        `
          SELECT ${logisticsCompanySelectSql}
          FROM logistics_companies lc
          WHERE lc.id = ?
          LIMIT 1
        `,
        [companyId]
      );

      return mapLogisticsCompanyRow(rows[0]);
    },

    async findCompanyByPhone(phone) {
      const [rows] = await db.execute(
        `
          SELECT ${logisticsCompanySelectSql}
          FROM logistics_companies lc
          WHERE lc.phone = ?
          LIMIT 1
        `,
        [phone]
      );

      return mapLogisticsCompanyRow(rows[0]);
    },

    async listCompanies(filters) {
      const pagination = sanitizeLimitOffset(filters);
      const builtFilters = buildCompanyFilters(filters);
      const [countRows] = await db.execute(
        `
          SELECT COUNT(*) AS total
          FROM logistics_companies lc
          ${builtFilters.whereSql}
        `,
        builtFilters.params
      );
      const [rows] = await db.execute(
        `
          SELECT ${logisticsCompanySelectSql}
          FROM logistics_companies lc
          ${builtFilters.whereSql}
          ORDER BY lc.created_at DESC, lc.id DESC
          LIMIT ${pagination.limit} OFFSET ${pagination.offset}
        `,
        builtFilters.params
      );

      return {
        companies: rows.map(mapLogisticsCompanyRow),
        total: Number((countRows[0] && countRows[0].total) || 0)
      };
    },

    async summarizeCompanies(filters = {}) {
      const builtFilters = buildCompanyFilters(filters, {
        ignoreStatus: true
      });
      const [rows] = await db.execute(
        `
          SELECT
            COUNT(*) AS total_companies_count,
            COALESCE(SUM(CASE WHEN lc.status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_count,
            COALESCE(SUM(CASE WHEN lc.status = 'approved' THEN 1 ELSE 0 END), 0) AS approved_count,
            COALESCE(SUM(CASE WHEN lc.status = 'suspended' THEN 1 ELSE 0 END), 0) AS suspended_count
          FROM logistics_companies lc
          ${builtFilters.whereSql}
        `,
        builtFilters.params
      );

      return mapCompanySummaryRow(rows[0]);
    },

    async updateCompanyStatus({ companyId, status, approvedBy }) {
      await db.execute(
        `
          UPDATE logistics_companies
          SET
            status = ?,
            approved_by = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [status, approvedBy || null, companyId]
      );

      return this.findCompanyById(companyId);
    },

    async createRider(payload) {
      const [result] = await db.execute(
        `
          INSERT INTO riders (
            company_id,
            zone_id,
            full_name,
            phone,
            email,
            password_hash,
            vehicle_type,
            availability_status
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          payload.companyId,
          payload.zoneId,
          payload.fullName,
          payload.phone,
          payload.email,
          payload.passwordHash,
          payload.vehicleType,
          payload.status
        ]
      );

      return this.findRiderById(result.insertId);
    },

    async findRiderByEmail(email) {
      const [rows] = await db.execute(
        `
          SELECT ${riderSelectSql}
          FROM riders r
          INNER JOIN logistics_companies lc ON lc.id = r.company_id
          INNER JOIN delivery_zones dz ON dz.id = r.zone_id
          WHERE r.email = ?
          LIMIT 1
        `,
        [email]
      );

      return mapRiderRow(rows[0]);
    },

    async findRiderById(riderId) {
      const [rows] = await db.execute(
        `
          SELECT ${riderSelectSql}
          FROM riders r
          INNER JOIN logistics_companies lc ON lc.id = r.company_id
          INNER JOIN delivery_zones dz ON dz.id = r.zone_id
          WHERE r.id = ?
          LIMIT 1
        `,
        [riderId]
      );

      return mapRiderRow(rows[0]);
    },

    async findRiderByIdForCompany(companyId, riderId) {
      const [rows] = await db.execute(
        `
          SELECT ${riderSelectSql}
          FROM riders r
          INNER JOIN logistics_companies lc ON lc.id = r.company_id
          INNER JOIN delivery_zones dz ON dz.id = r.zone_id
          WHERE r.company_id = ? AND r.id = ?
          LIMIT 1
        `,
        [companyId, riderId]
      );

      return mapRiderRow(rows[0]);
    },

    async findRiderByPhone(phone) {
      const [rows] = await db.execute(
        `
          SELECT ${riderSelectSql}
          FROM riders r
          INNER JOIN logistics_companies lc ON lc.id = r.company_id
          INNER JOIN delivery_zones dz ON dz.id = r.zone_id
          WHERE r.phone = ?
          LIMIT 1
        `,
        [phone]
      );

      return mapRiderRow(rows[0]);
    },

    async listRiders(filters) {
      const pagination = sanitizeLimitOffset(filters);
      const builtFilters = buildRiderFilters(filters);
      const [countRows] = await db.execute(
        `
          SELECT COUNT(*) AS total
          FROM riders r
          INNER JOIN logistics_companies lc ON lc.id = r.company_id
          INNER JOIN delivery_zones dz ON dz.id = r.zone_id
          ${builtFilters.whereSql}
        `,
        builtFilters.params
      );
      const [rows] = await db.execute(
        `
          SELECT ${riderSelectSql}
          FROM riders r
          INNER JOIN logistics_companies lc ON lc.id = r.company_id
          INNER JOIN delivery_zones dz ON dz.id = r.zone_id
          ${builtFilters.whereSql}
          ORDER BY r.created_at DESC, r.id DESC
          LIMIT ${pagination.limit} OFFSET ${pagination.offset}
        `,
        builtFilters.params
      );

      return {
        riders: rows.map(mapRiderRow),
        total: Number((countRows[0] && countRows[0].total) || 0)
      };
    },

    async summarizeRiders(filters = {}) {
      const builtFilters = buildRiderFilters(filters, {
        ignoreStatus: true
      });
      const [rows] = await db.execute(
        `
          SELECT
            COUNT(*) AS total_riders_count,
            COALESCE(SUM(CASE WHEN r.availability_status = 'available' THEN 1 ELSE 0 END), 0) AS available_count,
            COALESCE(SUM(CASE WHEN r.availability_status = 'on_delivery' THEN 1 ELSE 0 END), 0) AS on_delivery_count,
            COALESCE(SUM(CASE WHEN r.availability_status = 'unavailable' THEN 1 ELSE 0 END), 0) AS unavailable_count,
            COALESCE(SUM(CASE WHEN r.availability_status = 'inactive' THEN 1 ELSE 0 END), 0) AS inactive_count
          FROM riders r
          INNER JOIN logistics_companies lc ON lc.id = r.company_id
          INNER JOIN delivery_zones dz ON dz.id = r.zone_id
          ${builtFilters.whereSql}
        `,
        builtFilters.params
      );

      return mapRiderSummaryRow(rows[0]);
    },

    async findAssignableRiders() {
      const [rows] = await db.execute(
        `
          SELECT ${riderSelectSql}
          FROM riders r
          INNER JOIN logistics_companies lc ON lc.id = r.company_id
          INNER JOIN delivery_zones dz ON dz.id = r.zone_id
          WHERE r.availability_status = ? AND r.status <> ? AND lc.status <> ?
          ORDER BY
            CASE lc.status
              WHEN 'approved' THEN 1
              ELSE 2
            END ASC,
            r.updated_at ASC,
            r.id ASC
        `,
        ['available', 'suspended', 'suspended']
      );

      return rows.map(mapRiderRow);
    },

    async updateRider(riderId, payload) {
      const updateClauses = [];
      const params = [];

      if (payload.fullName !== undefined) {
        updateClauses.push('full_name = ?');
        params.push(payload.fullName);
      }

      if (payload.phone !== undefined) {
        updateClauses.push('phone = ?');
        params.push(payload.phone);
      }

      if (payload.email !== undefined) {
        updateClauses.push('email = ?');
        params.push(payload.email);
      }

      if (payload.vehicleType !== undefined) {
        updateClauses.push('vehicle_type = ?');
        params.push(payload.vehicleType);
      }

      if (payload.zoneId !== undefined) {
        updateClauses.push('zone_id = ?');
        params.push(payload.zoneId);
      }

      if (payload.status !== undefined) {
        updateClauses.push('availability_status = ?');
        params.push(payload.status);
      }

      if (!updateClauses.length) {
        return this.findRiderById(riderId);
      }

      updateClauses.push('updated_at = CURRENT_TIMESTAMP');

      await db.execute(
        `
          UPDATE riders
          SET ${updateClauses.join(', ')}
          WHERE id = ?
        `,
        [...params, riderId]
      );

      return this.findRiderById(riderId);
    },

    async updateRiderAccountStatus(riderId, accountStatus) {
      await db.execute(
        `
          UPDATE riders
          SET
            status = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [accountStatus, riderId]
      );

      return this.findRiderById(riderId);
    },

    async findZoneById(zoneId) {
      const [rows] = await db.execute(
        `
          SELECT
            dz.id AS zone_id,
            dz.name AS zone_name,
            dz.state AS zone_state,
            dz.city AS zone_city,
            dz.created_at AS zone_created_at,
            dz.updated_at AS zone_updated_at
          FROM delivery_zones dz
          WHERE dz.id = ?
          LIMIT 1
        `,
        [zoneId]
      );

      return mapDeliveryZoneRow(rows[0]);
    },

    async listZones() {
      const [rows] = await db.execute(
        `
          SELECT
            dz.id AS zone_id,
            dz.name AS zone_name,
            dz.state AS zone_state,
            dz.city AS zone_city,
            dz.created_at AS zone_created_at,
            dz.updated_at AS zone_updated_at
          FROM delivery_zones dz
          ORDER BY dz.state ASC, dz.city ASC, dz.name ASC, dz.id ASC
        `
      );

      return rows.map(mapDeliveryZoneRow);
    }
  };
}

module.exports = {
  createLogisticsRepository
};
