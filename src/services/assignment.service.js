const {
  DELIVERY_JOB_STATUSES,
  ERROR_CODES,
  LOGISTICS_COMPANY_STATUSES,
  RIDER_STATUSES
} = require('../config/constants');
const AppError = require('../utils/app-error');
const { calculateZoneMatchDistance } = require('../utils/distance');

function normalizeLocationValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function createAssignmentService({
  deliveryJobsRepository,
  logisticsRepository
}) {
  async function ensureJobExists(jobId) {
    const job = await deliveryJobsRepository.findJobById(jobId);

    if (!job) {
      throw new AppError('Delivery job was not found.', {
        statusCode: 404,
        code: ERROR_CODES.NOT_FOUND
      });
    }

    return job;
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

  function ensureJobAwaitingAssignment(job) {
    const isPendingJob = !job.assignedRider && job.status === DELIVERY_JOB_STATUSES.PENDING;
    const isFailedJob = job.status === DELIVERY_JOB_STATUSES.FAILED;

    if (!isPendingJob && !isFailedJob) {
      throw new AppError('This delivery job is no longer awaiting assignment.', {
        statusCode: 409,
        code: ERROR_CODES.CONFLICT
      });
    }

    return job;
  }

  function ensureRiderCanReceiveAssignment(rider) {
    if (rider.status !== RIDER_STATUSES.AVAILABLE) {
      throw new AppError('Only available riders can be assigned to a delivery job.', {
        statusCode: 409,
        code: ERROR_CODES.CONFLICT
      });
    }

    if (rider.company && rider.company.status === LOGISTICS_COMPANY_STATUSES.SUSPENDED) {
      throw new AppError('This rider belongs to a suspended logistics company.', {
        statusCode: 409,
        code: ERROR_CODES.CONFLICT
      });
    }

    return rider;
  }

  function buildCandidateScore(job, rider) {
    const deliveryAddress = job.order && job.order.deliveryAddress
      ? job.order.deliveryAddress
      : {};
    const zoneDistance = calculateZoneMatchDistance({
      targetZoneId: job.zoneId,
      targetCity: deliveryAddress.city,
      targetState: deliveryAddress.state,
      riderZone: rider.zone
    });

    if (!Number.isFinite(zoneDistance)) {
      return null;
    }

    return {
      rider,
      zoneDistance,
      companyPriority: rider.company && rider.company.status === LOGISTICS_COMPANY_STATUSES.APPROVED
        ? 0
        : 1,
      cityPriority: normalizeLocationValue(rider.zone && rider.zone.city) === normalizeLocationValue(deliveryAddress.city)
        ? 0
        : 1,
      createdAt: rider.createdAt || null,
      riderId: rider.id
    };
  }

  function selectBestCandidate(job, riders) {
    return riders
      .map((rider) => buildCandidateScore(job, rider))
      .filter(Boolean)
      .sort((left, right) => (
        left.zoneDistance - right.zoneDistance
        || left.companyPriority - right.companyPriority
        || left.cityPriority - right.cityPriority
        || new Date(left.createdAt || 0) - new Date(right.createdAt || 0)
        || left.riderId - right.riderId
      ))[0] || null;
  }

  return {
    async attemptAutoAssignJob({ jobId }) {
      const job = await ensureJobExists(jobId);

      if (job.assignedRider || job.status !== DELIVERY_JOB_STATUSES.PENDING) {
        return job;
      }

      const riders = typeof logisticsRepository.findAssignableRiders === 'function'
        ? await logisticsRepository.findAssignableRiders()
        : [];
      const candidate = selectBestCandidate(job, riders);

      if (!candidate) {
        return job;
      }

      return deliveryJobsRepository.assignJob({
        jobId: job.id,
        riderId: candidate.rider.id,
        companyId: candidate.rider.companyId,
        note: `Delivery job auto-assigned to ${candidate.rider.fullName}.`
      });
    },

    async assignJobToRider({ jobId, note, riderId }) {
      const [job, rider] = await Promise.all([
        ensureJobExists(jobId),
        ensureRiderExists(riderId)
      ]);

      ensureJobAwaitingAssignment(job);
      ensureRiderCanReceiveAssignment(rider);

      return deliveryJobsRepository.assignJob({
        jobId: job.id,
        riderId: rider.id,
        companyId: rider.companyId,
        note: note && note.trim()
          ? note.trim()
          : `Delivery job manually assigned to ${rider.fullName}.`
      });
    }
  };
}

module.exports = {
  createAssignmentService
};
