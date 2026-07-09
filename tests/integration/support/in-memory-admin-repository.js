const {
  ADMIN_PERMISSION_DEFINITIONS,
  ADMIN_ROLE_DEFINITIONS
} = require('../../../src/config/constants');

function createAccessControlStore() {
  const permissions = ADMIN_PERMISSION_DEFINITIONS.map((definition, index) => ({
    id: index + 1,
    key: definition.key,
    description: definition.description
  }));
  const permissionsByKey = new Map(permissions.map((permission) => [permission.key, permission]));
  const roles = ADMIN_ROLE_DEFINITIONS.map((definition, index) => ({
    id: index + 1,
    name: definition.name,
    description: definition.description,
    permissionKeys: definition.permissionKeys
  }));
  const rolesByName = new Map(roles.map((role) => [role.name, role]));

  return {
    permissionsByKey,
    rolesByName
  };
}

function createInMemoryAdminRepository({ sellersRepository }) {
  const accessControl = createAccessControlStore();
  const admins = [];
  let adminIdCounter = 1;

  function cloneAdmin(admin) {
    return admin ? { ...admin, roleNames: [...admin.roleNames] } : null;
  }

  function hydrateAdmin(admin) {
    if (!admin) {
      return null;
    }

    const roles = admin.roleNames
      .map((roleName) => accessControl.rolesByName.get(roleName))
      .filter(Boolean)
      .map((role) => ({
        id: role.id,
        name: role.name,
        description: role.description
      }));
    const permissionKeys = new Set();

    for (const role of roles) {
      const storedRole = accessControl.rolesByName.get(role.name);

      for (const permissionKey of storedRole.permissionKeys) {
        permissionKeys.add(permissionKey);
      }
    }

    const permissions = Array.from(permissionKeys)
      .map((permissionKey) => accessControl.permissionsByKey.get(permissionKey))
      .filter(Boolean)
      .sort((left, right) => left.id - right.id)
      .map((permission) => ({
        id: permission.id,
        key: permission.key,
        description: permission.description
      }));

    return {
      id: admin.id,
      fullName: admin.fullName,
      email: admin.email,
      passwordHash: admin.passwordHash,
      isActive: admin.isActive,
      roles,
      permissions,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt
    };
  }

  return {
    async createAdmin(payload) {
      const now = new Date().toISOString();
      const admin = {
        id: adminIdCounter,
        fullName: payload.fullName,
        email: payload.email,
        passwordHash: payload.passwordHash,
        isActive: payload.isActive !== false,
        roleNames: Array.from(new Set(payload.roleNames || [])),
        createdAt: now,
        updatedAt: now
      };

      admins.push(admin);
      adminIdCounter += 1;

      return hydrateAdmin(admin);
    },

    async findAdminByEmail(email) {
      const admin = admins.find((entry) => entry.email === email) || null;

      return hydrateAdmin(cloneAdmin(admin));
    },

    async findAdminById(adminId) {
      const admin = admins.find((entry) => entry.id === Number(adminId)) || null;

      return hydrateAdmin(cloneAdmin(admin));
    },

    async findSellerAccountBySellerId(sellerId) {
      return sellersRepository.findBySellerId(Number(sellerId));
    },

    async listSellerVerificationQueue({ limit, offset, status }) {
      const allStatuses = status === 'all';
      const sellerAccounts = await sellersRepository.listSellerAccountsForReview({
        status: allStatuses ? null : status
      });

      return {
        sellers: sellerAccounts.slice(offset, offset + limit),
        total: sellerAccounts.length
      };
    },

    async updateSellerVerificationStatus({ adminId, rejectionReason, sellerId, status }) {
      return sellersRepository.updateVerificationStatus({
        approvedBy: status === 'verified' ? Number(adminId) : null,
        sellerId: Number(sellerId),
        status,
        rejectionReason
      });
    }
  };
}

module.exports = {
  createInMemoryAdminRepository
};
