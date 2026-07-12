function createInMemoryUsersRepository() {
  const users = [];
  let idCounter = 1;

  function cloneUser(user) {
    return user ? { ...user } : null;
  }

  return {
    async createUser(payload) {
      const now = new Date().toISOString();
      const user = {
        id: idCounter,
        role: payload.role,
        fullName: payload.fullName,
        email: payload.email,
        phone: payload.phone,
        passwordHash: payload.passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        isVerified: payload.isVerified,
        accountStatus: payload.accountStatus || 'active',
        createdAt: now,
        updatedAt: now
      };

      users.push(user);
      idCounter += 1;

      return cloneUser(user);
    },

    async findByEmail(email) {
      return cloneUser(users.find((user) => user.email === email) || null);
    },

    async findById(id) {
      return cloneUser(users.find((user) => user.id === id) || null);
    },

    async findByPhone(phone) {
      return cloneUser(users.find((user) => user.phone === phone) || null);
    },

    async findByPasswordResetTokenHash(passwordResetTokenHash) {
      return cloneUser(
        users.find((user) => user.passwordResetTokenHash === passwordResetTokenHash) || null
      );
    },

    async storePasswordResetToken({ userId, passwordResetTokenHash, passwordResetExpiresAt }) {
      const user = users.find((entry) => entry.id === userId);

      if (!user) {
        return null;
      }

      user.passwordResetTokenHash = passwordResetTokenHash;
      user.passwordResetExpiresAt = passwordResetExpiresAt instanceof Date
        ? passwordResetExpiresAt.toISOString()
        : passwordResetExpiresAt;
      user.updatedAt = new Date().toISOString();

      return cloneUser(user);
    },

    async clearPasswordResetToken(userId) {
      const user = users.find((entry) => entry.id === userId);

      if (!user) {
        return null;
      }

      user.passwordResetTokenHash = null;
      user.passwordResetExpiresAt = null;
      user.updatedAt = new Date().toISOString();

      return cloneUser(user);
    },

    async updatePassword(userId, passwordHash) {
      const user = users.find((entry) => entry.id === userId);

      if (!user) {
        return null;
      }

      user.passwordHash = passwordHash;
      user.passwordResetTokenHash = null;
      user.passwordResetExpiresAt = null;
      user.updatedAt = new Date().toISOString();

      return cloneUser(user);
    },

    async updateVerificationStatus(userId, isVerified) {
      const user = users.find((entry) => entry.id === userId);

      if (!user) {
        return null;
      }

      user.isVerified = Boolean(isVerified);
      user.updatedAt = new Date().toISOString();

      return cloneUser(user);
    },

    async findManagedUserById(userId) {
      const user = users.find((entry) => (
        entry.id === Number(userId) && entry.role !== 'admin'
      ));

      return cloneUser(user || null);
    },

    async listManagedUsers(filters) {
      const matchedUsers = users
        .filter((user) => user.role !== 'admin')
        .filter((user) => !filters.role || filters.role === 'all' || user.role === filters.role)
        .filter((user) => (
          !filters.status || filters.status === 'all' || user.accountStatus === filters.status
        ))
        .filter((user) => {
          if (!filters.search) {
            return true;
          }

          const search = String(filters.search).toLowerCase();

          return [
            user.fullName,
            user.email,
            user.phone
          ].some((value) => String(value || '').toLowerCase().includes(search));
        })
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));

      return {
        users: matchedUsers
          .slice(filters.offset, filters.offset + filters.limit)
          .map(cloneUser),
        total: matchedUsers.length
      };
    },

    async updateAccountStatus(userId, accountStatus) {
      const user = users.find((entry) => (
        entry.id === Number(userId) && entry.role !== 'admin'
      ));

      if (!user) {
        return null;
      }

      user.accountStatus = accountStatus;
      user.updatedAt = new Date().toISOString();

      return cloneUser(user);
    }
  };
}

module.exports = {
  createInMemoryUsersRepository
};
