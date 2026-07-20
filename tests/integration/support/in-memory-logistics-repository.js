function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

function createDefaultZones(store) {
  if (store.deliveryZones.length) {
    return;
  }

  const now = new Date().toISOString();
  const zones = [
    {
      id: store.counters.deliveryZoneId++,
      name: 'Ikeja Central',
      state: 'Lagos',
      city: 'Ikeja',
      createdAt: now,
      updatedAt: now
    },
    {
      id: store.counters.deliveryZoneId++,
      name: 'Victoria Island',
      state: 'Lagos',
      city: 'Victoria Island',
      createdAt: now,
      updatedAt: now
    }
  ];

  store.deliveryZones.push(...zones);
}

function createInMemoryLogisticsRepository({ store }) {
  createDefaultZones(store);

  function buildCompany(company) {
    return company ? clone(company) : null;
  }

  function buildZone(zone) {
    return zone ? clone(zone) : null;
  }

  function buildRider(rider) {
    if (!rider) {
      return null;
    }

    const zone = store.deliveryZones.find((entry) => entry.id === rider.zoneId) || null;
    const company = store.logisticsCompanies.find((entry) => entry.id === rider.companyId) || null;

    return clone({
      ...rider,
      zone,
      company
    });
  }

  function matchesSearch(value, search) {
    return String(value || '').toLowerCase().includes(String(search || '').toLowerCase());
  }

  return {
    async createLogisticsCompany(payload) {
      const now = new Date().toISOString();
      const company = {
        id: store.counters.logisticsCompanyId++,
        name: payload.name,
        email: payload.email,
        phone: payload.phone,
        passwordHash: payload.passwordHash,
        address: payload.address,
        status: payload.status,
        approvedBy: payload.approvedBy || null,
        createdAt: now,
        updatedAt: now
      };

      store.logisticsCompanies.push(company);

      return buildCompany(company);
    },

    async findCompanyByEmail(email) {
      const company = store.logisticsCompanies.find((entry) => entry.email === email) || null;

      return buildCompany(company);
    },

    async findCompanyById(companyId) {
      const company = store.logisticsCompanies.find((entry) => entry.id === Number(companyId)) || null;

      return buildCompany(company);
    },

    async findCompanyByPhone(phone) {
      const company = store.logisticsCompanies.find((entry) => entry.phone === phone) || null;

      return buildCompany(company);
    },

    async listCompanies(filters) {
      const companies = store.logisticsCompanies.filter((entry) => {
        if (filters.status && filters.status !== 'all' && entry.status !== filters.status) {
          return false;
        }

        if (filters.search) {
          const matches = [
            entry.name,
            entry.email,
            entry.phone,
            entry.address
          ].some((value) => matchesSearch(value, filters.search));

          if (!matches) {
            return false;
          }
        }

        return true;
      });

      companies.sort((left, right) => (
        new Date(right.createdAt) - new Date(left.createdAt) || right.id - left.id
      ));

      return {
        companies: companies
          .slice(filters.offset, filters.offset + filters.limit)
          .map((entry) => buildCompany(entry)),
        total: companies.length
      };
    },

    async summarizeCompanies(filters = {}) {
      const companies = store.logisticsCompanies.filter((entry) => {
        if (filters.search) {
          const matches = [
            entry.name,
            entry.email,
            entry.phone,
            entry.address
          ].some((value) => matchesSearch(value, filters.search));

          if (!matches) {
            return false;
          }
        }

        return true;
      });

      return {
        totalCompaniesCount: companies.length,
        pendingCount: companies.filter((entry) => entry.status === 'pending').length,
        approvedCount: companies.filter((entry) => entry.status === 'approved').length,
        suspendedCount: companies.filter((entry) => entry.status === 'suspended').length
      };
    },

    async updateCompanyStatus({ companyId, status, approvedBy }) {
      const company = store.logisticsCompanies.find((entry) => entry.id === Number(companyId)) || null;

      if (!company) {
        return null;
      }

      company.status = status;
      company.approvedBy = approvedBy || null;
      company.updatedAt = new Date().toISOString();

      return buildCompany(company);
    },

    async createRider(payload) {
      const now = new Date().toISOString();
      const rider = {
        id: store.counters.riderId++,
        companyId: Number(payload.companyId),
        zoneId: Number(payload.zoneId),
        fullName: payload.fullName,
        phone: payload.phone,
        email: payload.email,
        passwordHash: payload.passwordHash,
        vehicleType: payload.vehicleType,
        status: payload.status,
        createdAt: now,
        updatedAt: now
      };

      store.riders.push(rider);

      return buildRider(rider);
    },

    async findRiderByEmail(email) {
      const rider = store.riders.find((entry) => entry.email === email) || null;

      return buildRider(rider);
    },

    async findRiderById(riderId) {
      const rider = store.riders.find((entry) => entry.id === Number(riderId)) || null;

      return buildRider(rider);
    },

    async findRiderByIdForCompany(companyId, riderId) {
      const rider = store.riders.find((entry) => (
        entry.id === Number(riderId) && entry.companyId === Number(companyId)
      )) || null;

      return buildRider(rider);
    },

    async findRiderByPhone(phone) {
      const rider = store.riders.find((entry) => entry.phone === phone) || null;

      return buildRider(rider);
    },

    async listRiders(filters) {
      const riders = store.riders.filter((entry) => {
        if (filters.companyId && entry.companyId !== Number(filters.companyId)) {
          return false;
        }

        if (filters.status && filters.status !== 'all' && entry.status !== filters.status) {
          return false;
        }

        if (filters.search) {
          const zone = store.deliveryZones.find((zoneEntry) => zoneEntry.id === entry.zoneId) || null;
          const company = store.logisticsCompanies.find((companyEntry) => (
            companyEntry.id === entry.companyId
          )) || null;
          const matches = [
            entry.fullName,
            entry.email,
            entry.phone,
            entry.vehicleType,
            zone ? zone.name : null,
            zone ? zone.city : null,
            zone ? zone.state : null,
            company ? company.name : null
          ].some((value) => matchesSearch(value, filters.search));

          if (!matches) {
            return false;
          }
        }

        return true;
      });

      riders.sort((left, right) => (
        new Date(right.createdAt) - new Date(left.createdAt) || right.id - left.id
      ));

      return {
        riders: riders
          .slice(filters.offset, filters.offset + filters.limit)
          .map((entry) => buildRider(entry)),
        total: riders.length
      };
    },

    async summarizeRiders(filters = {}) {
      const riders = store.riders.filter((entry) => {
        if (filters.companyId && entry.companyId !== Number(filters.companyId)) {
          return false;
        }

        if (filters.search) {
          const zone = store.deliveryZones.find((zoneEntry) => zoneEntry.id === entry.zoneId) || null;
          const company = store.logisticsCompanies.find((companyEntry) => (
            companyEntry.id === entry.companyId
          )) || null;
          const matches = [
            entry.fullName,
            entry.email,
            entry.phone,
            entry.vehicleType,
            zone ? zone.name : null,
            zone ? zone.city : null,
            zone ? zone.state : null,
            company ? company.name : null
          ].some((value) => matchesSearch(value, filters.search));

          if (!matches) {
            return false;
          }
        }

        return true;
      });

      return {
        totalRidersCount: riders.length,
        availableCount: riders.filter((entry) => entry.status === 'available').length,
        onDeliveryCount: riders.filter((entry) => entry.status === 'on_delivery').length,
        unavailableCount: riders.filter((entry) => entry.status === 'unavailable').length,
        inactiveCount: riders.filter((entry) => entry.status === 'inactive').length
      };
    },

    async findAssignableRiders() {
      const riders = store.riders
        .filter((entry) => {
          if (entry.status !== 'available') {
            return false;
          }

          const company = store.logisticsCompanies.find((companyEntry) => (
            companyEntry.id === entry.companyId
          ));

          return company && company.status !== 'suspended';
        })
        .sort((left, right) => {
          const leftCompany = store.logisticsCompanies.find((entry) => entry.id === left.companyId) || null;
          const rightCompany = store.logisticsCompanies.find((entry) => entry.id === right.companyId) || null;
          const leftPriority = leftCompany && leftCompany.status === 'approved' ? 0 : 1;
          const rightPriority = rightCompany && rightCompany.status === 'approved' ? 0 : 1;

          return (
            leftPriority - rightPriority
            || new Date(left.updatedAt) - new Date(right.updatedAt)
            || left.id - right.id
          );
        });

      return riders.map((entry) => buildRider(entry));
    },

    async updateRider(riderId, payload) {
      const rider = store.riders.find((entry) => entry.id === Number(riderId)) || null;

      if (!rider) {
        return null;
      }

      if (payload.fullName !== undefined) {
        rider.fullName = payload.fullName;
      }

      if (payload.phone !== undefined) {
        rider.phone = payload.phone;
      }

      if (payload.email !== undefined) {
        rider.email = payload.email;
      }

      if (payload.vehicleType !== undefined) {
        rider.vehicleType = payload.vehicleType;
      }

      if (payload.zoneId !== undefined) {
        rider.zoneId = Number(payload.zoneId);
      }

      if (payload.status !== undefined) {
        rider.status = payload.status;
      }

      rider.updatedAt = new Date().toISOString();

      return buildRider(rider);
    },

    async findZoneById(zoneId) {
      const zone = store.deliveryZones.find((entry) => entry.id === Number(zoneId)) || null;

      return buildZone(zone);
    },

    async listZones() {
      return store.deliveryZones
        .slice()
        .sort((left, right) => (
          left.state.localeCompare(right.state)
          || left.city.localeCompare(right.city)
          || left.name.localeCompare(right.name)
          || left.id - right.id
        ))
        .map((entry) => buildZone(entry));
    }
  };
}

module.exports = {
  createInMemoryLogisticsRepository
};
