function mapUserRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    role: row.role,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    passwordHash: row.password_hash,
    passwordResetTokenHash: row.password_reset_token_hash,
    passwordResetExpiresAt: row.password_reset_expires_at,
    isVerified: Boolean(row.is_verified),
    accountStatus: row.account_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function createUsersRepository({ db }) {
  return {
    async createUser(payload) {
      const [result] = await db.execute(
        `
          INSERT INTO users (role, full_name, email, phone, password_hash, is_verified, account_status)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          payload.role,
          payload.fullName,
          payload.email,
          payload.phone,
          payload.passwordHash,
          payload.isVerified ? 1 : 0,
          payload.accountStatus || 'active'
        ]
      );

      return this.findById(result.insertId);
    },

    async findByEmail(email) {
      const [rows] = await db.execute(
        `
          SELECT
            id,
            role,
            full_name,
            email,
            phone,
            password_hash,
            password_reset_token_hash,
            password_reset_expires_at,
            is_verified,
            account_status,
            created_at,
            updated_at
          FROM users
          WHERE email = ?
          LIMIT 1
        `,
        [email]
      );

      return mapUserRow(rows[0]);
    },

    async findById(id) {
      const [rows] = await db.execute(
        `
          SELECT
            id,
            role,
            full_name,
            email,
            phone,
            password_hash,
            password_reset_token_hash,
            password_reset_expires_at,
            is_verified,
            account_status,
            created_at,
            updated_at
          FROM users
          WHERE id = ?
          LIMIT 1
        `,
        [id]
      );

      return mapUserRow(rows[0]);
    },

    async findByPhone(phone) {
      const [rows] = await db.execute(
        `
          SELECT
            id,
            role,
            full_name,
            email,
            phone,
            password_hash,
            password_reset_token_hash,
            password_reset_expires_at,
            is_verified,
            account_status,
            created_at,
            updated_at
          FROM users
          WHERE phone = ?
          LIMIT 1
        `,
        [phone]
      );

      return mapUserRow(rows[0]);
    },

    async findByPasswordResetTokenHash(passwordResetTokenHash) {
      const [rows] = await db.execute(
        `
          SELECT
            id,
            role,
            full_name,
            email,
            phone,
            password_hash,
            password_reset_token_hash,
            password_reset_expires_at,
            is_verified,
            account_status,
            created_at,
            updated_at
          FROM users
          WHERE password_reset_token_hash = ?
          LIMIT 1
        `,
        [passwordResetTokenHash]
      );

      return mapUserRow(rows[0]);
    },

    async storePasswordResetToken({ userId, passwordResetTokenHash, passwordResetExpiresAt }) {
      await db.execute(
        `
          UPDATE users
          SET password_reset_token_hash = ?, password_reset_expires_at = ?
          WHERE id = ?
        `,
        [passwordResetTokenHash, passwordResetExpiresAt, userId]
      );

      return this.findById(userId);
    },

    async clearPasswordResetToken(userId) {
      await db.execute(
        `
          UPDATE users
          SET password_reset_token_hash = NULL, password_reset_expires_at = NULL
          WHERE id = ?
        `,
        [userId]
      );

      return this.findById(userId);
    },

    async updatePassword(userId, passwordHash) {
      await db.execute(
        `
          UPDATE users
          SET
            password_hash = ?,
            password_reset_token_hash = NULL,
            password_reset_expires_at = NULL
          WHERE id = ?
        `,
        [passwordHash, userId]
      );

      return this.findById(userId);
    },

    async findManagedUserById(userId) {
      const [rows] = await db.execute(
        `
          SELECT
            id,
            role,
            full_name,
            email,
            phone,
            password_hash,
            password_reset_token_hash,
            password_reset_expires_at,
            is_verified,
            account_status,
            created_at,
            updated_at
          FROM users
          WHERE id = ? AND role <> 'admin'
          LIMIT 1
        `,
        [userId]
      );

      return mapUserRow(rows[0]);
    },

    async listManagedUsers(filters) {
      const whereClauses = ['role <> ?'];
      const params = ['admin'];

      if (filters.role && filters.role !== 'all') {
        whereClauses.push('role = ?');
        params.push(filters.role);
      }

      if (filters.status && filters.status !== 'all') {
        whereClauses.push('account_status = ?');
        params.push(filters.status);
      }

      if (filters.search) {
        const normalizedSearch = `%${filters.search.trim().toLowerCase()}%`;

        whereClauses.push(`
          (
            LOWER(full_name) LIKE ?
            OR LOWER(COALESCE(email, '')) LIKE ?
            OR LOWER(COALESCE(phone, '')) LIKE ?
          )
        `);
        params.push(normalizedSearch, normalizedSearch, normalizedSearch);
      }

      const [countRows] = await db.execute(
        `
          SELECT COUNT(*) AS total
          FROM users
          WHERE ${whereClauses.join(' AND ')}
        `,
        params
      );

      const [rows] = await db.execute(
        `
          SELECT
            id,
            role,
            full_name,
            email,
            phone,
            password_hash,
            password_reset_token_hash,
            password_reset_expires_at,
            is_verified,
            account_status,
            created_at,
            updated_at
          FROM users
          WHERE ${whereClauses.join(' AND ')}
          ORDER BY created_at DESC, id DESC
          LIMIT ? OFFSET ?
        `,
        [...params, filters.limit, filters.offset]
      );

      return {
        users: rows.map(mapUserRow),
        total: Number(countRows[0].total || 0)
      };
    },

    async updateAccountStatus(userId, accountStatus) {
      await db.execute(
        `
          UPDATE users
          SET account_status = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND role <> 'admin'
        `,
        [accountStatus, userId]
      );

      return this.findManagedUserById(userId);
    }
  };
}

module.exports = {
  createUsersRepository
};
