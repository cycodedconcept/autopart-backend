const {
  DELIVERY_JOB_STATUSES,
  ERROR_CODES,
  LOGISTICS_COMPANY_STATUSES,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  PAYOUT_PAYEE_TYPES,
  RIDER_STATUSES,
  TOKEN_SUBJECT_TYPES,
  USER_ROLES
} = require('../config/constants');
const AppError = require('../utils/app-error');
const {
  calculateLogisticsSettlement,
  resolveDeliveryFeeConfig
} = require('../utils/delivery-fee');
const {
  buildDeliveryJobsByStatus,
  buildRiderStatusSummary,
  calculateCompletionRatePercent,
  sanitizeDeliveryZone,
  sanitizeLogisticsCompany,
  sanitizeRider
} = require('../utils/logistics');
const { buildPagination, normalizePagination } = require('../utils/pagination');
const { isValidNigerianPhone, normalizeNigerianPhone } = require('../utils/phone');

function normalizeEmail(email) {
  return email ? email.trim().toLowerCase() : null;
}

function normalizeSearchTerm(search) {
  if (typeof search !== 'string') {
    return null;
  }

  const trimmed = search.trim();

  return trimmed || null;
}

function resolveIdentifier(identifier) {
  if (!identifier || typeof identifier !== 'string') {
    return {
      email: null,
      phone: null
    };
  }

  const trimmedIdentifier = identifier.trim();

  if (trimmedIdentifier.includes('@')) {
    return {
      email: normalizeEmail(trimmedIdentifier),
      phone: null
    };
  }

  if (isValidNigerianPhone(trimmedIdentifier)) {
    return {
      email: null,
      phone: normalizeNigerianPhone(trimmedIdentifier)
    };
  }

  return {
    email: null,
    phone: null
  };
}

function formatDeliveryJobCode(jobId) {
  return `DLV-${String(jobId).padStart(4, '0')}`;
}

function mapCompanyPrincipal(company) {
  if (!company) {
    return null;
  }

  return {
    ...sanitizeLogisticsCompany(company),
    role: USER_ROLES.LOGISTICS_COMPANY
  };
}

function mapRiderPrincipal(rider) {
  if (!rider) {
    return null;
  }

  return {
    ...sanitizeRider(rider),
    role: USER_ROLES.RIDER,
    company: sanitizeLogisticsCompany(rider.company || null)
  };
}

function mapDeliveryJob(job, options = {}) {
  if (!job) {
    return null;
  }

  return {
    id: job.id,
    jobCode: formatDeliveryJobCode(job.id),
    orderId: job.orderId,
    orderItemId: job.orderItemId,
    sellerId: job.sellerId,
    companyId: job.companyId || null,
    riderId: job.riderId || null,
    status: job.status,
    failureReason: job.failureReason || null,
    deliveryFeeKobo: job.deliveryFeeKobo || 0,
    platformMarginKobo: job.platformMarginKobo || 0,
    companyShareKobo: job.companyShareKobo || 0,
    pickupAddress: job.pickupAddress,
    assignedAt: job.assignedAt,
    pickedUpAt: job.pickedUpAt,
    inTransitAt: job.inTransitAt,
    deliveredAt: job.deliveredAt,
    settlementRecordedAt: job.settlementRecordedAt || null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    zone: sanitizeDeliveryZone(job.zone || null),
    order: job.order,
    item: job.item,
    buyer: job.buyer,
    seller: job.seller,
    assignedCompany: sanitizeLogisticsCompany(job.assignedCompany || null),
    assignedRider: job.assignedRider
      ? {
        ...sanitizeRider(job.assignedRider),
        company: sanitizeLogisticsCompany(job.assignedRider.company || null)
      }
      : null,
    ...(options.statusHistory
      ? {
        statusHistory: options.statusHistory
      }
      : {})
  };
}

function mapCompanyEarningsSummary(summary) {
  return {
    completedJobsCount: Number(summary && summary.completedJobsCount) || 0,
    deliveryFeesKobo: Number(summary && summary.deliveryFeesKobo) || 0,
    platformMarginKobo: Number(summary && summary.platformMarginKobo) || 0,
    companyShareKobo: Number(summary && summary.companyShareKobo) || 0
  };
}

function mapCompanyPayoutSummary(summary) {
  return {
    pendingKobo: Number(summary && summary.pendingKobo) || 0,
    requestedKobo: Number(summary && summary.requestedKobo) || 0,
    approvedKobo: Number(summary && summary.approvedKobo) || 0,
    paidKobo: Number(summary && summary.paidKobo) || 0
  };
}

function mapCompanyPayout(payout) {
  if (!payout) {
    return null;
  }

  return {
    id: payout.id,
    payeeType: payout.payeeType || PAYOUT_PAYEE_TYPES.LOGISTICS_COMPANY,
    deliveryFeeKobo: payout.grossAmountKobo,
    platformMarginKobo: payout.commissionAmountKobo,
    companyShareKobo: payout.amountKobo,
    status: payout.status,
    bankAccountRef: payout.bankAccountRef,
    itemCount: payout.itemCount,
    requestedAt: payout.requestedAt,
    approvedAt: payout.approvedAt || null,
    rejectionReason: payout.rejectionReason || null,
    settledAt: payout.settledAt,
    createdAt: payout.createdAt,
    updatedAt: payout.updatedAt
  };
}

function mapRiderPerformanceEntry(entry) {
  if (!entry) {
    return null;
  }

  return {
    rider: {
      ...sanitizeRider(entry.rider),
      company: sanitizeLogisticsCompany(entry.rider && entry.rider.company)
    },
    totalJobsCount: Number(entry.totalJobsCount) || 0,
    assignedJobsCount: Number(entry.assignedJobsCount) || 0,
    pickedUpJobsCount: Number(entry.pickedUpJobsCount) || 0,
    inTransitJobsCount: Number(entry.inTransitJobsCount) || 0,
    activeJobsCount: Number(entry.activeJobsCount) || 0,
    deliveredJobsCount: Number(entry.deliveredJobsCount) || 0,
    failedJobsCount: Number(entry.failedJobsCount) || 0,
    cancelledJobsCount: Number(entry.cancelledJobsCount) || 0,
    deliveryFeesKobo: Number(entry.deliveryFeesKobo) || 0,
    companyShareKobo: Number(entry.companyShareKobo) || 0,
    completionRatePercent: calculateCompletionRatePercent({
      deliveredCount: entry.deliveredJobsCount,
      failedCount: entry.failedJobsCount
    })
  };
}

function buildCompanyRiderPerformanceSummary(riderSummary, riderPerformanceEntries) {
  const entries = riderPerformanceEntries.map(mapRiderPerformanceEntry);
  const aggregate = entries.reduce((accumulator, entry) => ({
    activeJobsCount: accumulator.activeJobsCount + entry.activeJobsCount,
    deliveredJobsCount: accumulator.deliveredJobsCount + entry.deliveredJobsCount,
    failedJobsCount: accumulator.failedJobsCount + entry.failedJobsCount
  }), {
    activeJobsCount: 0,
    deliveredJobsCount: 0,
    failedJobsCount: 0
  });

  return {
    summary: {
      ...buildRiderStatusSummary(riderSummary),
      activeJobsCount: aggregate.activeJobsCount,
      deliveredJobsCount: aggregate.deliveredJobsCount,
      failedJobsCount: aggregate.failedJobsCount,
      completionRatePercent: calculateCompletionRatePercent({
        deliveredCount: aggregate.deliveredJobsCount,
        failedCount: aggregate.failedJobsCount
      })
    },
    riders: entries
  };
}

function canTransitionDeliveryJob(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) {
    return false;
  }

  switch (currentStatus) {
    case DELIVERY_JOB_STATUSES.ASSIGNED:
      return (
        nextStatus === DELIVERY_JOB_STATUSES.PICKED_UP
        || nextStatus === DELIVERY_JOB_STATUSES.FAILED
      );
    case DELIVERY_JOB_STATUSES.PICKED_UP:
      return (
        nextStatus === DELIVERY_JOB_STATUSES.IN_TRANSIT
        || nextStatus === DELIVERY_JOB_STATUSES.FAILED
      );
    case DELIVERY_JOB_STATUSES.IN_TRANSIT:
      return (
        nextStatus === DELIVERY_JOB_STATUSES.DELIVERED
        || nextStatus === DELIVERY_JOB_STATUSES.FAILED
      );
    default:
      return false;
  }
}

function createUnauthorizedTokenError() {
  return new AppError('Invalid or expired access token.', {
    statusCode: 401,
    code: ERROR_CODES.UNAUTHORIZED
  });
}

function createLogisticsService({
  deliveryJobsRepository,
  env,
  jwtUtils,
  logisticsRepository,
  passwordUtils,
  sellerFinanceRepository
}) {
  const deliveryFeeConfig = resolveDeliveryFeeConfig(env);

  async function ensureZoneExists(zoneId) {
    const zone = await logisticsRepository.findZoneById(zoneId);

    if (!zone) {
      throw new AppError('Delivery zone was not found.', {
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND
      });
    }

    return zone;
  }

  async function ensureCompanyExists(companyId) {
    const company = await logisticsRepository.findCompanyById(companyId);

    if (!company) {
      throw new AppError('Logistics company was not found.', {
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND
      });
    }

    return company;
  }

  async function ensureRiderExists(riderId) {
    const rider = await logisticsRepository.findRiderById(riderId);

    if (!rider) {
      throw new AppError('Rider was not found.', {
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND
      });
    }

    return rider;
  }

  async function ensureCompanyOwnsRider(companyId, riderId) {
    const rider = await logisticsRepository.findRiderByIdForCompany(companyId, riderId);

    if (!rider) {
      throw new AppError('Rider was not found.', {
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND
      });
    }

    return rider;
  }

  function ensureCompanyNotSuspended(company) {
    if (company.status === LOGISTICS_COMPANY_STATUSES.SUSPENDED) {
      throw new AppError('This logistics company has been suspended.', {
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN
      });
    }

    return company;
  }

  function ensureRiderIsActive(rider) {
    if (rider.status === RIDER_STATUSES.INACTIVE) {
      throw new AppError('This rider account is inactive.', {
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN
      });
    }

    return rider;
  }

  async function findCompanyByIdentifier(identifier) {
    const resolvedIdentifier = resolveIdentifier(identifier);

    if (resolvedIdentifier.email) {
      return logisticsRepository.findCompanyByEmail(resolvedIdentifier.email);
    }

    if (resolvedIdentifier.phone) {
      return logisticsRepository.findCompanyByPhone(resolvedIdentifier.phone);
    }

    return null;
  }

  async function findRiderByIdentifier(identifier) {
    const resolvedIdentifier = resolveIdentifier(identifier);

    if (resolvedIdentifier.email) {
      return logisticsRepository.findRiderByEmail(resolvedIdentifier.email);
    }

    if (resolvedIdentifier.phone) {
      return logisticsRepository.findRiderByPhone(resolvedIdentifier.phone);
    }

    return null;
  }

  async function ensureUniqueCompanyEmailAndPhone({ email, phone, excludeCompanyId = null }) {
    const existingCompanyByEmail = await logisticsRepository.findCompanyByEmail(email);

    if (existingCompanyByEmail && existingCompanyByEmail.id !== excludeCompanyId) {
      throw new AppError('A logistics company with this email already exists.', {
        statusCode: 409,
        code: ERROR_CODES.CONFLICT
      });
    }

    const existingCompanyByPhone = await logisticsRepository.findCompanyByPhone(phone);

    if (existingCompanyByPhone && existingCompanyByPhone.id !== excludeCompanyId) {
      throw new AppError('A logistics company with this phone number already exists.', {
        statusCode: 409,
        code: ERROR_CODES.CONFLICT
      });
    }
  }

  async function ensureUniqueRiderEmailAndPhone({ email, phone, excludeRiderId = null }) {
    const existingRiderByEmail = await logisticsRepository.findRiderByEmail(email);

    if (existingRiderByEmail && existingRiderByEmail.id !== excludeRiderId) {
      throw new AppError('A rider with this email already exists.', {
        statusCode: 409,
        code: ERROR_CODES.CONFLICT
      });
    }

    const existingRiderByPhone = await logisticsRepository.findRiderByPhone(phone);

    if (existingRiderByPhone && existingRiderByPhone.id !== excludeRiderId) {
      throw new AppError('A rider with this phone number already exists.', {
        statusCode: 409,
        code: ERROR_CODES.CONFLICT
      });
    }
  }

  async function getAuthenticatedLogisticsCompany(token) {
    let decodedToken;

    try {
      decodedToken = jwtUtils.verifyAccessToken(token);
    } catch (_error) {
      throw createUnauthorizedTokenError();
    }

    if (decodedToken.actorType !== TOKEN_SUBJECT_TYPES.LOGISTICS_COMPANY) {
      throw createUnauthorizedTokenError();
    }

    const company = await logisticsRepository.findCompanyById(decodedToken.sub);

    if (!company) {
      throw createUnauthorizedTokenError();
    }

    ensureCompanyNotSuspended(company);

    return mapCompanyPrincipal(company);
  }

  async function getAuthenticatedRider(token) {
    let decodedToken;

    try {
      decodedToken = jwtUtils.verifyAccessToken(token);
    } catch (_error) {
      throw createUnauthorizedTokenError();
    }

    if (decodedToken.actorType !== TOKEN_SUBJECT_TYPES.RIDER) {
      throw createUnauthorizedTokenError();
    }

    const rider = await logisticsRepository.findRiderById(decodedToken.sub);

    if (!rider) {
      throw createUnauthorizedTokenError();
    }

    ensureRiderIsActive(rider);
    ensureCompanyNotSuspended(rider.company);

    return mapRiderPrincipal(rider);
  }

  return {
    async registerCompany(payload) {
      const email = normalizeEmail(payload.email);
      const name = payload.name.trim();
      const address = payload.address.trim();

      if (!isValidNigerianPhone(payload.phone)) {
        throw new AppError('Phone must be a valid Nigerian phone number.', {
          statusCode: 422,
          code: ERROR_CODES.VALIDATION_ERROR
        });
      }

      const phone = normalizeNigerianPhone(payload.phone);
      await ensureUniqueCompanyEmailAndPhone({ email, phone });

      const passwordHash = await passwordUtils.hashPassword(payload.password);
      const company = await logisticsRepository.createLogisticsCompany({
        name,
        email,
        phone,
        passwordHash,
        address,
        status: LOGISTICS_COMPANY_STATUSES.PENDING,
        approvedBy: null
      });
      const token = jwtUtils.signAccessToken({
        sub: company.id,
        role: USER_ROLES.LOGISTICS_COMPANY,
        actorType: TOKEN_SUBJECT_TYPES.LOGISTICS_COMPANY
      });

      return {
        token,
        company: sanitizeLogisticsCompany(company)
      };
    },

    async loginCompany(payload) {
      const company = await findCompanyByIdentifier(payload.identifier);

      if (!company) {
        throw new AppError('Invalid email/phone or password.', {
          statusCode: 401,
          code: ERROR_CODES.INVALID_CREDENTIALS
        });
      }

      const isPasswordValid = await passwordUtils.comparePassword(payload.password, company.passwordHash);

      if (!isPasswordValid) {
        throw new AppError('Invalid email/phone or password.', {
          statusCode: 401,
          code: ERROR_CODES.INVALID_CREDENTIALS
        });
      }

      ensureCompanyNotSuspended(company);

      const token = jwtUtils.signAccessToken({
        sub: company.id,
        role: USER_ROLES.LOGISTICS_COMPANY,
        actorType: TOKEN_SUBJECT_TYPES.LOGISTICS_COMPANY
      });

      return {
        token,
        company: sanitizeLogisticsCompany(company)
      };
    },

    async getCompanyProfile(companyId) {
      const company = await ensureCompanyExists(companyId);

      ensureCompanyNotSuspended(company);

      return {
        company: sanitizeLogisticsCompany(company)
      };
    },

    async listZones() {
      const zones = await logisticsRepository.listZones();

      return {
        zones: zones.map((zone) => sanitizeDeliveryZone(zone))
      };
    },

    async createRider(payload) {
      const company = await ensureCompanyExists(payload.companyId);

      ensureCompanyNotSuspended(company);
      await ensureZoneExists(payload.zoneId);

      const email = normalizeEmail(payload.email);

      if (!isValidNigerianPhone(payload.phone)) {
        throw new AppError('Phone must be a valid Nigerian phone number.', {
          statusCode: 422,
          code: ERROR_CODES.VALIDATION_ERROR
        });
      }

      const phone = normalizeNigerianPhone(payload.phone);
      await ensureUniqueRiderEmailAndPhone({ email, phone });

      const passwordHash = await passwordUtils.hashPassword(payload.password);
      const rider = await logisticsRepository.createRider({
        companyId: company.id,
        zoneId: payload.zoneId,
        fullName: payload.fullName.trim(),
        phone,
        email,
        passwordHash,
        vehicleType: payload.vehicleType.trim(),
        status: payload.status || RIDER_STATUSES.UNAVAILABLE
      });

      return {
        rider: {
          ...sanitizeRider(rider),
          company: sanitizeLogisticsCompany(rider.company)
        }
      };
    },

    async listRiders(payload) {
      await ensureCompanyExists(payload.companyId);

      const pagination = normalizePagination(payload.query, {
        defaultLimit: 10,
        maxLimit: 50
      });
      const status = payload.query.status || 'all';
      const search = normalizeSearchTerm(payload.query.search);
      const result = await logisticsRepository.listRiders({
        companyId: payload.companyId,
        status,
        search,
        limit: pagination.limit,
        offset: pagination.offset
      });

      return {
        riders: result.riders.map((rider) => ({
          ...sanitizeRider(rider),
          company: sanitizeLogisticsCompany(rider.company)
        })),
        pagination: buildPagination({
          page: pagination.page,
          limit: pagination.limit,
          total: result.total
        }),
        filters: {
          status,
          search
        }
      };
    },

    async getCompanyRider(payload) {
      const rider = await ensureCompanyOwnsRider(payload.companyId, payload.riderId);

      return {
        rider: {
          ...sanitizeRider(rider),
          company: sanitizeLogisticsCompany(rider.company)
        }
      };
    },

    async updateRider(payload) {
      const existingRider = await ensureCompanyOwnsRider(payload.companyId, payload.riderId);

      if (payload.zoneId !== undefined) {
        await ensureZoneExists(payload.zoneId);
      }

      let normalizedPhone;

      if (payload.phone !== undefined) {
        if (!isValidNigerianPhone(payload.phone)) {
          throw new AppError('Phone must be a valid Nigerian phone number.', {
            statusCode: 422,
            code: ERROR_CODES.VALIDATION_ERROR
          });
        }

        normalizedPhone = normalizeNigerianPhone(payload.phone);
      }

      const normalizedEmail = payload.email !== undefined
        ? normalizeEmail(payload.email)
        : undefined;

      if (normalizedEmail !== undefined || normalizedPhone !== undefined) {
        await ensureUniqueRiderEmailAndPhone({
          email: normalizedEmail !== undefined ? normalizedEmail : existingRider.email,
          phone: normalizedPhone !== undefined ? normalizedPhone : existingRider.phone,
          excludeRiderId: existingRider.id
        });
      }

      const updatedRider = await logisticsRepository.updateRider(existingRider.id, {
        fullName: payload.fullName !== undefined ? payload.fullName.trim() : undefined,
        email: normalizedEmail,
        phone: normalizedPhone,
        vehicleType: payload.vehicleType !== undefined ? payload.vehicleType.trim() : undefined,
        zoneId: payload.zoneId,
        status: payload.status
      });

      return {
        rider: {
          ...sanitizeRider(updatedRider),
          company: sanitizeLogisticsCompany(updatedRider.company)
        }
      };
    },

    async listCompanyJobs(payload) {
      await ensureCompanyExists(payload.companyId);

      const pagination = normalizePagination(payload.query, {
        defaultLimit: 10,
        maxLimit: 50
      });
      const status = payload.query.status || 'all';
      const search = normalizeSearchTerm(payload.query.search);
      const [result, jobsSummary, riderSummary, riderPerformance] = await Promise.all([
        deliveryJobsRepository.listJobs({
          companyId: payload.companyId,
          status,
          search,
          limit: pagination.limit,
          offset: pagination.offset
        }),
        deliveryJobsRepository.summarizeJobs({
          companyId: payload.companyId,
          search
        }),
        logisticsRepository.summarizeRiders({
          companyId: payload.companyId
        }),
        deliveryJobsRepository.listCompanyRiderPerformance({
          companyId: payload.companyId
        })
      ]);

      return {
        jobs: result.jobs.map((job) => mapDeliveryJob(job)),
        pagination: buildPagination({
          page: pagination.page,
          limit: pagination.limit,
          total: result.total
        }),
        filters: {
          status,
          search
        },
        summary: {
          jobsByStatus: buildDeliveryJobsByStatus(jobsSummary),
          riderPerformance: buildCompanyRiderPerformanceSummary(riderSummary, riderPerformance)
        }
      };
    },

    async getCompanyEarnings(payload) {
      const company = await ensureCompanyExists(payload.companyId);

      ensureCompanyNotSuspended(company);

      if (!sellerFinanceRepository) {
        throw new AppError('Logistics company earnings are unavailable.', {
          statusCode: 500,
          code: ERROR_CODES.INTERNAL_SERVER_ERROR
        });
      }

      const [summary, payouts] = await Promise.all([
        sellerFinanceRepository.getLogisticsCompanyEarningsSummary({
          companyId: company.id
        }),
        sellerFinanceRepository.summarizeLogisticsCompanyPayoutBalances({
          companyId: company.id
        })
      ]);

      return {
        company: sanitizeLogisticsCompany(company),
        summary: mapCompanyEarningsSummary(summary),
        payouts: mapCompanyPayoutSummary(payouts)
      };
    },

    async createCompanyPayoutRequest(payload) {
      const company = await ensureCompanyExists(payload.companyId);

      ensureCompanyNotSuspended(company);

      if (!sellerFinanceRepository) {
        throw new AppError('Logistics company payouts are unavailable.', {
          statusCode: 500,
          code: ERROR_CODES.INTERNAL_SERVER_ERROR
        });
      }

      const payout = await sellerFinanceRepository.createLogisticsCompanyPayoutRequest({
        companyId: company.id,
        bankAccountRef: payload.bankAccountRef.trim()
      });

      if (!payout) {
        throw new AppError('No completed deliveries are currently available for payout.', {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT
        });
      }

      return {
        payout: mapCompanyPayout(payout)
      };
    },

    async loginRider(payload) {
      const rider = await findRiderByIdentifier(payload.identifier);

      if (!rider) {
        throw new AppError('Invalid email/phone or password.', {
          statusCode: 401,
          code: ERROR_CODES.INVALID_CREDENTIALS
        });
      }

      const isPasswordValid = await passwordUtils.comparePassword(payload.password, rider.passwordHash);

      if (!isPasswordValid) {
        throw new AppError('Invalid email/phone or password.', {
          statusCode: 401,
          code: ERROR_CODES.INVALID_CREDENTIALS
        });
      }

      ensureRiderIsActive(rider);
      ensureCompanyNotSuspended(rider.company);

      const token = jwtUtils.signAccessToken({
        sub: rider.id,
        role: USER_ROLES.RIDER,
        actorType: TOKEN_SUBJECT_TYPES.RIDER
      });

      return {
        token,
        rider: {
          ...sanitizeRider(rider),
          company: sanitizeLogisticsCompany(rider.company)
        }
      };
    },

    async getRiderProfile(riderId) {
      const rider = await ensureRiderExists(riderId);

      ensureRiderIsActive(rider);
      ensureCompanyNotSuspended(rider.company);

      return {
        rider: {
          ...sanitizeRider(rider),
          company: sanitizeLogisticsCompany(rider.company)
        }
      };
    },

    async updateRiderAvailability(payload) {
      const rider = await ensureRiderExists(payload.riderId);

      ensureRiderIsActive(rider);
      ensureCompanyNotSuspended(rider.company);

      const updatedRider = await logisticsRepository.updateRider(rider.id, {
        status: payload.status
      });

      return {
        rider: {
          ...sanitizeRider(updatedRider),
          company: sanitizeLogisticsCompany(updatedRider.company)
        }
      };
    },

    async listRiderJobs(payload) {
      const rider = await ensureRiderExists(payload.riderId);

      ensureRiderIsActive(rider);
      ensureCompanyNotSuspended(rider.company);

      const pagination = normalizePagination(payload.query, {
        defaultLimit: 10,
        maxLimit: 50
      });
      const status = payload.query.status || 'all';
      const search = normalizeSearchTerm(payload.query.search);
      const result = await deliveryJobsRepository.listJobs({
        riderId: rider.id,
        status,
        search,
        limit: pagination.limit,
        offset: pagination.offset
      });

      return {
        jobs: result.jobs.map((job) => mapDeliveryJob(job)),
        pagination: buildPagination({
          page: pagination.page,
          limit: pagination.limit,
          total: result.total
        }),
        filters: {
          status,
          search
        }
      };
    },

    async getRiderJobById(payload) {
      const rider = await ensureRiderExists(payload.riderId);

      ensureRiderIsActive(rider);
      ensureCompanyNotSuspended(rider.company);

      const job = await deliveryJobsRepository.findJobById(payload.jobId);

      if (!job) {
        throw new AppError('Delivery job was not found.', {
          statusCode: 404,
          code: ERROR_CODES.NOT_FOUND
        });
      }

      if (
        !job.assignedRider
        || job.assignedRider.id !== rider.id
      ) {
        throw new AppError('You do not have permission to access this delivery job.', {
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN
        });
      }

      const statusHistory = await deliveryJobsRepository.findStatusHistoryByJobId(job.id);

      return mapDeliveryJob(job, {
        statusHistory
      });
    },

    async updateRiderJobStatus(payload) {
      const rider = await ensureRiderExists(payload.riderId);

      ensureRiderIsActive(rider);
      ensureCompanyNotSuspended(rider.company);

      const existingJob = await deliveryJobsRepository.findJobById(payload.jobId);

      if (!existingJob) {
        throw new AppError('Delivery job was not found.', {
          statusCode: 404,
          code: ERROR_CODES.NOT_FOUND
        });
      }

      if (
        !existingJob.assignedRider
        || existingJob.assignedRider.id !== rider.id
      ) {
        throw new AppError('This delivery job is not assigned to you.', {
          statusCode: 403,
          code: ERROR_CODES.FORBIDDEN
        });
      }

      if (existingJob.order.paymentStatus !== PAYMENT_STATUSES.PAID) {
        throw new AppError('Only paid orders can enter the logistics flow.', {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT
        });
      }

      if (
        existingJob.order.status === ORDER_STATUSES.CANCELLED
        || existingJob.order.status === ORDER_STATUSES.DISPUTED
        || existingJob.order.status === ORDER_STATUSES.DELIVERED
      ) {
        throw new AppError('This delivery job can no longer be updated.', {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT
        });
      }

      if (!canTransitionDeliveryJob(existingJob.status, payload.status)) {
        throw new AppError('This delivery job status change is not allowed.', {
          statusCode: 409,
          code: ERROR_CODES.CONFLICT
        });
      }

      const failureReason = typeof payload.failureReason === 'string'
        ? payload.failureReason.trim()
        : '';

      if (
        payload.status === DELIVERY_JOB_STATUSES.FAILED
        && !failureReason
      ) {
        throw new AppError('A failure reason is required when marking a delivery job as failed.', {
          statusCode: 422,
          code: ERROR_CODES.VALIDATION_ERROR
        });
      }

      const settlement = payload.status === DELIVERY_JOB_STATUSES.DELIVERED
        ? calculateLogisticsSettlement({
          deliveryFeeKobo: existingJob.deliveryFeeKobo,
          logisticsPlatformMarginPercent: deliveryFeeConfig.logisticsPlatformMarginPercent
        })
        : {
          platformMarginKobo: existingJob.platformMarginKobo || 0,
          companyShareKobo: existingJob.companyShareKobo || 0
        };

      const updatedJob = await deliveryJobsRepository.updateJobStatus({
        jobId: payload.jobId,
        riderId: rider.id,
        companyId: rider.companyId,
        platformMarginKobo: settlement.platformMarginKobo,
        companyShareKobo: settlement.companyShareKobo,
        status: payload.status,
        note: payload.note,
        failureReason: failureReason || null
      });
      const statusHistory = await deliveryJobsRepository.findStatusHistoryByJobId(payload.jobId);

      return mapDeliveryJob(updatedJob, {
        statusHistory
      });
    },

    getAuthenticatedLogisticsCompany,
    getAuthenticatedRider
  };
}

module.exports = {
  createLogisticsService
};
