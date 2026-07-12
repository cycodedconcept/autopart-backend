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
    accountStatus: row.account_status,
    createdAt: row.user_created_at,
    updatedAt: row.user_updated_at
  };
}

function mapSellerProfileRow(row) {
  if (!row) {
    return null;
  }

  const cacVerificationResponse = parseJsonColumn(row.cac_verification_response);
  const normalizedCacVerificationResponse = cacVerificationResponse
    && typeof cacVerificationResponse === 'object'
    && cacVerificationResponse.response !== undefined
    ? cacVerificationResponse.response
    : cacVerificationResponse;
  const normalizedCacVerificationError = cacVerificationResponse
    && typeof cacVerificationResponse === 'object'
    && cacVerificationResponse.error !== undefined
    ? cacVerificationResponse.error
    : null;
  const normalizedCacVerificationProvider = cacVerificationResponse
    && typeof cacVerificationResponse === 'object'
    && cacVerificationResponse.provider !== undefined
    ? cacVerificationResponse.provider
    : null;

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
    cacVerification: row.cac_verification_status || cacVerificationResponse || row.cac_verification_checked_at
      ? {
        checkedAt: row.cac_verification_checked_at,
        error: normalizedCacVerificationError,
        provider: normalizedCacVerificationProvider,
        response: normalizedCacVerificationResponse,
        status: row.cac_verification_status
      }
      : null,
    verifiedAt: row.verified_at,
    verifiedBy: row.verified_by === null || row.verified_by === undefined
      ? null
      : Number(row.verified_by),
    createdAt: row.seller_created_at,
    updatedAt: row.seller_updated_at
  };
}

function parseJsonColumn(value) {
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

function normalizeSqlTimestamp(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return null;
    }

    return value.toISOString().slice(0, 19).replace('T', ' ');
  }

  if (typeof value === 'string') {
    const parsedValue = new Date(value);

    if (Number.isNaN(parsedValue.getTime())) {
      return value;
    }

    return parsedValue.toISOString().slice(0, 19).replace('T', ' ');
  }

  return value;
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

function createSellersRepository({ db }) {
  return {
    async createSellerAccount({ user, profile }) {
      const connection = await db.getConnection();

      try {
        await connection.beginTransaction();

        const [userResult] = await connection.execute(
          `
            INSERT INTO users (role, full_name, email, phone, password_hash, is_verified, account_status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            user.role,
            user.fullName,
            user.email,
            user.phone,
            user.passwordHash,
            user.isVerified ? 1 : 0,
            user.accountStatus || 'active'
          ]
        );

        await connection.execute(
          `
            INSERT INTO seller_profiles (
              user_id,
              business_name,
              contact_phone,
              contact_email,
              address,
              cac_number,
              verification_status,
              rejection_reason,
              cac_verification_status,
              cac_verification_response,
              cac_verification_checked_at,
              verified_by,
              verified_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            userResult.insertId,
            profile.businessName,
            profile.contactPhone,
            profile.contactEmail,
            profile.address,
            profile.cacNumber,
            profile.verificationStatus,
            profile.rejectionReason,
            profile.cacVerificationStatus,
            profile.cacVerificationResponse ? JSON.stringify(profile.cacVerificationResponse) : null,
            normalizeSqlTimestamp(profile.cacVerificationCheckedAt),
            profile.verifiedBy,
            normalizeSqlTimestamp(profile.verifiedAt)
          ]
        );

        await connection.commit();

        return this.findByUserId(userResult.insertId);
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async findByCacNumber(cacNumber) {
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
            sp.cac_verification_status,
            sp.cac_verification_response,
            sp.cac_verification_checked_at,
            sp.verified_by,
            sp.verified_at,
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
            u.account_status,
            u.created_at AS user_created_at,
            u.updated_at AS user_updated_at
          FROM seller_profiles sp
          INNER JOIN users u ON u.id = sp.user_id
          WHERE sp.cac_number = ?
          LIMIT 1
        `,
        [cacNumber]
      );

      if (!rows[0]) {
        return null;
      }

      return {
        user: mapUserRow(rows[0]),
        sellerProfile: {
          ...mapSellerProfileRow(rows[0]),
          documents: await this.findDocumentsBySellerId(rows[0].seller_id)
        }
      };
    },

    async findBySellerId(sellerId) {
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
            sp.cac_verification_status,
            sp.cac_verification_response,
            sp.cac_verification_checked_at,
            sp.verified_by,
            sp.verified_at,
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
            u.account_status,
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

      return {
        user: mapUserRow(rows[0]),
        sellerProfile: {
          ...mapSellerProfileRow(rows[0]),
          documents: await this.findDocumentsBySellerId(sellerId)
        }
      };
    },

    async findByUserId(userId) {
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
            sp.cac_verification_status,
            sp.cac_verification_response,
            sp.cac_verification_checked_at,
            sp.verified_by,
            sp.verified_at,
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
            u.account_status,
            u.created_at AS user_created_at,
            u.updated_at AS user_updated_at
          FROM seller_profiles sp
          INNER JOIN users u ON u.id = sp.user_id
          WHERE sp.user_id = ?
          LIMIT 1
        `,
        [userId]
      );

      if (!rows[0]) {
        return null;
      }

      return {
        user: mapUserRow(rows[0]),
        sellerProfile: {
          ...mapSellerProfileRow(rows[0]),
          documents: await this.findDocumentsBySellerId(rows[0].seller_id)
        }
      };
    },

    async findDocumentsBySellerId(sellerId) {
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
          WHERE seller_id = ?
          ORDER BY id ASC
        `,
        [sellerId]
      );

      return rows.map(mapSellerDocumentRow);
    },

    async replaceDocuments({ sellerId, documents, verificationStatus, rejectionReason }) {
      const connection = await db.getConnection();

      try {
        await connection.beginTransaction();
        await connection.execute(
          'DELETE FROM seller_documents WHERE seller_id = ?',
          [sellerId]
        );

        for (const document of documents) {
          await connection.execute(
            `
              INSERT INTO seller_documents (seller_id, type, file_path)
              VALUES (?, ?, ?)
            `,
            [sellerId, document.type, document.filePath]
          );
        }

        await connection.execute(
          `
            UPDATE seller_profiles
            SET verification_status = ?, rejection_reason = ?
            WHERE id = ?
          `,
          [verificationStatus, rejectionReason, sellerId]
        );

        await connection.commit();

        return this.findBySellerId(sellerId);
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async updateCacVerificationResult({
      sellerId,
      cacVerificationStatus,
      cacVerificationResponse,
      cacVerificationCheckedAt
    }) {
      const [result] = await db.execute(
        `
          UPDATE seller_profiles
          SET
            cac_verification_status = ?,
            cac_verification_response = ?,
            cac_verification_checked_at = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [
          cacVerificationStatus,
          cacVerificationResponse ? JSON.stringify(cacVerificationResponse) : null,
          normalizeSqlTimestamp(cacVerificationCheckedAt),
          sellerId
        ]
      );

      if (!result.affectedRows) {
        return null;
      }

      return this.findBySellerId(sellerId);
    },

    async updateVerificationStatus({ sellerId, status, rejectionReason }) {
      await db.execute(
        `
          UPDATE seller_profiles
          SET verification_status = ?, rejection_reason = ?
          WHERE id = ?
        `,
        [status, rejectionReason, sellerId]
      );

      return this.findBySellerId(sellerId);
    }
  };
}

module.exports = {
  createSellersRepository
};
