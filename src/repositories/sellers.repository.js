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

function createSellersRepository({ db }) {
  return {
    async createSellerAccount({ user, profile }) {
      const connection = await db.getConnection();

      try {
        await connection.beginTransaction();

        const [userResult] = await connection.execute(
          `
            INSERT INTO users (role, full_name, email, phone, password_hash, is_verified)
            VALUES (?, ?, ?, ?, ?, ?)
          `,
          [
            user.role,
            user.fullName,
            user.email,
            user.phone,
            user.passwordHash,
            user.isVerified ? 1 : 0
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
              rejection_reason
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            userResult.insertId,
            profile.businessName,
            profile.contactPhone,
            profile.contactEmail,
            profile.address,
            profile.cacNumber,
            profile.verificationStatus,
            profile.rejectionReason
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
