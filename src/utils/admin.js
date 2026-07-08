function sanitizeAdmin(admin) {
  if (!admin) {
    return null;
  }

  return {
    id: admin.id,
    fullName: admin.fullName,
    email: admin.email,
    isActive: admin.isActive,
    roles: (admin.roles || []).map((role) => role.name),
    permissions: (admin.permissions || []).map((permission) => permission.key),
    createdAt: admin.createdAt,
    updatedAt: admin.updatedAt
  };
}

module.exports = {
  sanitizeAdmin
};
