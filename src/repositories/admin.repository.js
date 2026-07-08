function mapAdminRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.admin_id,
    fullName: row.admin_full_name,
    email: row.admin_email,
    passwordHash: row.admin_password_hash,
    isActive: Boolean(row.admin_is_active),
    createdAt: row.admin_created_at,
    updatedAt: row.admin_updated_at
  };
}

function mapAdminAccessRows(rows) {
  if (!rows.length) {
    return null;
  }

  const admin = mapAdminRow(rows[0]);
  const rolesById = new Map();
  const permissionsById = new Map();

  for (const row of rows) {
    if (row.role_id && !rolesById.has(row.role_id)) {
      rolesById.set(row.role_id, {
        id: row.role_id,
        name: row.role_name,
        description: row.role_description
      });
    }

    if (row.permission_id && !permissionsById.has(row.permission_id)) {
      permissionsById.set(row.permission_id, {
        id: row.permission_id,
        key: row.permission_key,
        description: row.permission_description
      });
    }
  }

  return {
    ...admin,
    roles: Array.from(rolesById.values()),
    permissions: Array.from(permissionsById.values())
  };
}

function mapUserRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.user_id,
    role: row.role,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    passwordHash: row.password_hash,
    passwordResetTokenHash: row.password_reset_token_hash,
    passwordResetExpiresAt: row.password_reset_expires_at,
    isVerified: Boolean(row.is_verified),
    createdAt: row.user_created_at,
    updatedAt: row.user_updated_at
  };
}

function mapSellerProfileRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.seller_id,
    userId: row.user_id,
    businessName: row.business_name,
    rating: row.rating === null || row.rating === undefined ? null : Number(row.rating),
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    address: row.address,
    cacNumber: row.cac_number,
    verificationStatus: row.verification_status,
    rejectionReason: row.rejection_reason,
    createdAt: row.seller_created_at,
    updatedAt: row.seller_updated_at
  };
}

function mapSellerDocumentRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    sellerId: row.seller_id,
    type: row.type,
    filePath: row.file_path,
    uploadedAt: row.uploaded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function buildStatusFilter(status, tableAlias = 'sp') {
  if (!status || status === 'all') {
    return {
      clause: '',
      params: []
    };
  }

  return {
    clause: `AND ${tableAlias}.verification_status = ?`,
    params: [status]
  };
}

function mapSellerAccountRow(row, documents = []) {
  if (!row) {
    return null;
  }

  return {
    user: mapUserRow(row),
    sellerProfile: {
      ...mapSellerProfileRow(row),
      documents
    }
  };
}

function groupDocumentsBySellerId(rows) {
  return rows.reduce((accumulator, row) => {
    const existingDocuments = accumulator.get(row.seller_id) || [];

    existingDocuments.push(mapSellerDocumentRow(row));
    accumulator.set(row.seller_id, existingDocuments);

    return accumulator;
  }, new Map());
}

function createAdminRepository({ db }) {
  async function findAdminAccessRows(whereClause, params) {
    const [rows] = await db.execute(
      `
        SELECT
          a.id AS admin_id,
          a.full_name AS admin_full_name,
          a.email AS admin_email,
          a.password_hash AS admin_password_hash,
          a.is_active AS admin_is_active,
          a.created_at AS admin_created_at,
          a.updated_at AS admin_updated_at,
          r.id AS role_id,
          r.name AS role_name,
          r.description AS role_description,
          p.id AS permission_id,
          p.\`key\` AS permission_key,
          p.description AS permission_description
        FROM admins a
        LEFT JOIN admin_roles ar ON ar.admin_id = a.id
        LEFT JOIN roles r ON r.id = ar.role_id
        LEFT JOIN role_permissions rp ON rp.role_id = r.id
        LEFT JOIN permissions p ON p.id = rp.permission_id
        WHERE ${whereClause}
        ORDER BY r.id ASC, p.id ASC
      `,
      params
    );

    return mapAdminAccessRows(rows);
  }

  async function findDocumentsBySellerIds(sellerIds) {
    if (!sellerIds.length) {
      return new Map();
    }

    const placeholders = sellerIds.map(() => '?').join(', ');
    const [rows] = await db.execute(
      `
        SELECT
          id,
          seller_id,
          type,
          file_path,
          uploaded_at,
          created_at,
          updated_at
        FROM seller_documents
        WHERE seller_id IN (${placeholders})
        ORDER BY seller_id ASC, id ASC
      `,
      sellerIds
    );

    return groupDocumentsBySellerId(rows);
  }

  async function findSellerAccountBySellerIdWithConnection(connection, sellerId) {
    const [rows] = await connection.execute(
      `
        SELECT
          sp.id AS seller_id,
          sp.user_id,
          sp.business_name,
          sp.rating,
          sp.contact_phone,
          sp.contact_email,
          sp.address,
          sp.cac_number,
          sp.verification_status,
          sp.rejection_reason,
          sp.created_at AS seller_created_at,
          sp.updated_at AS seller_updated_at,
          u.role,
          u.full_name,
          u.email,
          u.phone,
          u.password_hash,
          u.password_reset_token_hash,
          u.password_reset_expires_at,
          u.is_verified,
          u.created_at AS user_created_at,
          u.updated_at AS user_updated_at
        FROM seller_profiles sp
        INNER JOIN users u ON u.id = sp.user_id
        WHERE sp.id = ?
        LIMIT 1
      `,
      [sellerId]
    );

    if (!rows[0]) {
      return null;
    }

    const [documentRows] = await connection.execute(
      `
        SELECT
          id,
          seller_id,
          type,
          file_path,
          uploaded_at,
          created_at,
          updated_at
        FROM seller_documents
        WHERE seller_id = ?
        ORDER BY id ASC
      `,
      [sellerId]
    );

    return mapSellerAccountRow(rows[0], documentRows.map(mapSellerDocumentRow));
  }

  return {
    async findAdminByEmail(email) {
      return findAdminAccessRows('a.email = ?', [email]);
    },

    async findAdminById(adminId) {
      return findAdminAccessRows('a.id = ?', [adminId]);
    },

    async findSellerAccountBySellerId(sellerId) {
      const connection = await db.getConnection();

      try {
        return findSellerAccountBySellerIdWithConnection(connection, sellerId);
      } finally {
        connection.release();
      }
    },

    async listSellerVerificationQueue({ limit, offset, status }) {
      const statusFilter = buildStatusFilter(status);
      const countParams = [...statusFilter.params];
      const rowParams = [...statusFilter.params, limit, offset];
      const [countRows] = await db.execute(
        `
          SELECT COUNT(*) AS total
          FROM seller_profiles sp
          WHERE EXISTS (
            SELECT 1
            FROM seller_documents sd
            WHERE sd.seller_id = sp.id
          )
          ${statusFilter.clause}
        `,
        countParams
      );
      const [rows] = await db.execute(
        `
          SELECT
            sp.id AS seller_id,
            sp.user_id,
            sp.business_name,
            sp.rating,
            sp.contact_phone,
            sp.contact_email,
            sp.address,
            sp.cac_number,
            sp.verification_status,
            sp.rejection_reason,
            sp.created_at AS seller_created_at,
            sp.updated_at AS seller_updated_at,
            u.role,
            u.full_name,
            u.email,
            u.phone,
            u.password_hash,
            u.password_reset_token_hash,
            u.password_reset_expires_at,
            u.is_verified,
            u.created_at AS user_created_at,
            u.updated_at AS user_updated_at
          FROM seller_profiles sp
          INNER JOIN users u ON u.id = sp.user_id
          WHERE EXISTS (
            SELECT 1
            FROM seller_documents sd
            WHERE sd.seller_id = sp.id
          )
          ${statusFilter.clause}
          ORDER BY sp.updated_at ASC, sp.id ASC
          LIMIT ? OFFSET ?
        `,
        rowParams
      );
      const sellerIds = rows.map((row) => row.seller_id);
      const documentsBySellerId = await findDocumentsBySellerIds(sellerIds);

      return {
        sellers: rows.map((row) => mapSellerAccountRow(
          row,
          documentsBySellerId.get(row.seller_id) || []
        )),
        total: Number(countRows[0].total || 0)
      };
    },

    async updateSellerVerificationStatus({ rejectionReason, sellerId, status }) {
      const connection = await db.getConnection();

      try {
        await connection.beginTransaction();
        await connection.execute(
          `
            UPDATE seller_profiles
            SET verification_status = ?, rejection_reason = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          [status, rejectionReason, sellerId]
        );

        const sellerAccount = await findSellerAccountBySellerIdWithConnection(connection, sellerId);
        await connection.commit();

        return sellerAccount;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
  };
}

module.exports = {
  createAdminRepository
};
