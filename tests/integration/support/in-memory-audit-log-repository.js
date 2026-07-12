function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

function createInMemoryAuditLogRepository({ adminRepository } = {}) {
  const logs = [];
  let auditLogIdCounter = 1;

  return {
    async createAuditLog(payload) {
      logs.push({
        id: auditLogIdCounter++,
        adminId: Number(payload.adminId),
        action: payload.action,
        targetType: payload.targetType,
        targetId: payload.targetId === undefined ? null : payload.targetId,
        detail: payload.detail === undefined ? null : JSON.parse(JSON.stringify(payload.detail)),
        createdAt: new Date().toISOString()
      });
    },

    async listAuditLogs(filters) {
      const matchedLogs = [];

      for (const entry of logs) {
        if (filters.adminId && entry.adminId !== Number(filters.adminId)) {
          continue;
        }

        if (filters.action && entry.action !== filters.action) {
          continue;
        }

        if (filters.targetType && entry.targetType !== filters.targetType) {
          continue;
        }

        if (filters.targetId && entry.targetId !== Number(filters.targetId)) {
          continue;
        }

        const admin = adminRepository && typeof adminRepository.findAdminById === 'function'
          ? await adminRepository.findAdminById(entry.adminId)
          : null;

        matchedLogs.push({
          id: entry.id,
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId,
          detail: clone(entry.detail),
          createdAt: entry.createdAt,
          admin: admin
            ? {
              id: admin.id,
              fullName: admin.fullName,
              email: admin.email
            }
            : {
              id: entry.adminId,
              fullName: null,
              email: null
            }
        });
      }

      matchedLogs.sort(
        (left, right) => new Date(right.createdAt) - new Date(left.createdAt) || right.id - left.id
      );

      return {
        logs: matchedLogs
          .slice(filters.offset, filters.offset + filters.limit)
          .map((entry) => clone(entry)),
        total: matchedLogs.length
      };
    },

    getLogs() {
      return logs.map((entry) => clone(entry));
    }
  };
}

module.exports = {
  createInMemoryAuditLogRepository
};
