require('../../setup/jest');

const { createAssignmentService } = require('../../../src/services/assignment.service');

describe('assignment service', () => {
  let deliveryJobsRepository;
  let logisticsRepository;
  let assignmentService;

  beforeEach(() => {
    deliveryJobsRepository = {
      assignJob: jest.fn(),
      findJobById: jest.fn()
    };
    logisticsRepository = {
      findAssignableRiders: jest.fn(),
      findRiderById: jest.fn()
    };

    assignmentService = createAssignmentService({
      deliveryJobsRepository,
      logisticsRepository
    });
  });

  it('auto-assigns a pending delivery job to the best matching available rider', async () => {
    deliveryJobsRepository.findJobById.mockResolvedValue({
      id: 91,
      status: 'pending',
      zoneId: 7,
      order: {
        deliveryAddress: {
          city: 'Ikeja',
          state: 'Lagos'
        }
      },
      assignedRider: null
    });
    logisticsRepository.findAssignableRiders.mockResolvedValue([
      {
        id: 3,
        companyId: 9,
        fullName: 'Far Rider',
        createdAt: '2026-07-13T08:10:00.000Z',
        zone: {
          id: 8,
          city: 'Victoria Island',
          state: 'Lagos'
        },
        company: {
          id: 9,
          status: 'approved'
        }
      },
      {
        id: 2,
        companyId: 8,
        fullName: 'Best Rider',
        createdAt: '2026-07-13T08:00:00.000Z',
        zone: {
          id: 7,
          city: 'Ikeja',
          state: 'Lagos'
        },
        company: {
          id: 8,
          status: 'approved'
        }
      }
    ]);
    deliveryJobsRepository.assignJob.mockResolvedValue({
      id: 91,
      status: 'assigned'
    });

    const result = await assignmentService.attemptAutoAssignJob({
      jobId: 91
    });

    expect(logisticsRepository.findAssignableRiders).toHaveBeenCalled();
    expect(deliveryJobsRepository.assignJob).toHaveBeenCalledWith({
      jobId: 91,
      riderId: 2,
      companyId: 8,
      note: 'Delivery job auto-assigned to Best Rider.'
    });
    expect(result.status).toBe('assigned');
  });

  it('leaves a delivery job pending when no rider matches the delivery location', async () => {
    const pendingJob = {
      id: 92,
      status: 'pending',
      zoneId: null,
      order: {
        deliveryAddress: {
          city: 'Kano',
          state: 'Kano'
        }
      },
      assignedRider: null
    };

    deliveryJobsRepository.findJobById.mockResolvedValue(pendingJob);
    logisticsRepository.findAssignableRiders.mockResolvedValue([
      {
        id: 2,
        companyId: 8,
        fullName: 'Lagos Rider',
        createdAt: '2026-07-13T08:00:00.000Z',
        zone: {
          id: 7,
          city: 'Ikeja',
          state: 'Lagos'
        },
        company: {
          id: 8,
          status: 'approved'
        }
      }
    ]);

    const result = await assignmentService.attemptAutoAssignJob({
      jobId: 92
    });

    expect(deliveryJobsRepository.assignJob).not.toHaveBeenCalled();
    expect(result).toBe(pendingJob);
  });

  it('manually assigns a pending delivery job to an available rider', async () => {
    deliveryJobsRepository.findJobById.mockResolvedValue({
      id: 93,
      status: 'pending',
      assignedRider: null
    });
    logisticsRepository.findRiderById.mockResolvedValue({
      id: 12,
      companyId: 4,
      fullName: 'Alex Rider',
      status: 'available',
      company: {
        id: 4,
        status: 'approved'
      }
    });
    deliveryJobsRepository.assignJob.mockResolvedValue({
      id: 93,
      status: 'assigned'
    });

    const result = await assignmentService.assignJobToRider({
      jobId: 93,
      riderId: 12,
      note: 'Assigned by admin after reviewing the pending queue.'
    });

    expect(deliveryJobsRepository.assignJob).toHaveBeenCalledWith({
      jobId: 93,
      riderId: 12,
      companyId: 4,
      note: 'Assigned by admin after reviewing the pending queue.'
    });
    expect(result.status).toBe('assigned');
  });

  it('lets admin reassign a failed delivery job to a new available rider', async () => {
    deliveryJobsRepository.findJobById.mockResolvedValue({
      id: 94,
      status: 'failed',
      assignedRider: {
        id: 5
      }
    });
    logisticsRepository.findRiderById.mockResolvedValue({
      id: 13,
      companyId: 4,
      fullName: 'Recovery Rider',
      status: 'available',
      company: {
        id: 4,
        status: 'approved'
      }
    });
    deliveryJobsRepository.assignJob.mockResolvedValue({
      id: 94,
      status: 'assigned'
    });

    const result = await assignmentService.assignJobToRider({
      jobId: 94,
      riderId: 13,
      note: 'Reassigning after the previous delivery attempt failed.'
    });

    expect(deliveryJobsRepository.assignJob).toHaveBeenCalledWith({
      jobId: 94,
      riderId: 13,
      companyId: 4,
      note: 'Reassigning after the previous delivery attempt failed.'
    });
    expect(result.status).toBe('assigned');
  });
});
