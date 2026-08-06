require('../../setup/jest');

const { createLogisticsService } = require('../../../src/services/logistics.service');

describe('logistics service', () => {
  let assignmentService;
  let deliveryJobsRepository;
  let jwtUtils;
  let logisticsRepository;
  let passwordUtils;
  let sellerFinanceRepository;
  let logisticsService;

  beforeEach(() => {
    assignmentService = {
      attemptAutoAssignJob: jest.fn()
    };
    deliveryJobsRepository = {
      flagJobForManualHandling: jest.fn(),
      findJobById: jest.fn(),
      findStatusHistoryByJobId: jest.fn(),
      listActiveJobsForRider: jest.fn(),
      listCompanyRiderPerformance: jest.fn(),
      listJobs: jest.fn(),
      summarizeJobs: jest.fn(),
      unassignJob: jest.fn(),
      updateJobStatus: jest.fn()
    };
    jwtUtils = {
      signAccessToken: jest.fn(() => 'logistics-token'),
      verifyAccessToken: jest.fn()
    };
    logisticsRepository = {
      createLogisticsCompany: jest.fn(),
      createRider: jest.fn(),
      findCompanyByEmail: jest.fn(),
      findCompanyById: jest.fn(),
      findCompanyByPhone: jest.fn(),
      findRiderByEmail: jest.fn(),
      findRiderById: jest.fn(),
      findRiderByIdForCompany: jest.fn(),
      findRiderByPhone: jest.fn(),
      findZoneById: jest.fn(),
      listCompanies: jest.fn(),
      listRiders: jest.fn(),
      summarizeRiders: jest.fn(),
      listZones: jest.fn(),
      updateCompanyStatus: jest.fn(),
      updateRider: jest.fn(),
      updateRiderAccountStatus: jest.fn()
    };
    passwordUtils = {
      comparePassword: jest.fn(async () => true),
      hashPassword: jest.fn(async () => 'hashed-password')
    };
    sellerFinanceRepository = {
      createLogisticsCompanyPayoutRequest: jest.fn(),
      getLogisticsCompanyEarningsSummary: jest.fn(),
      summarizeLogisticsCompanyPayoutBalances: jest.fn()
    };

    logisticsService = createLogisticsService({
      assignmentService,
      deliveryJobsRepository,
      env: {
        DELIVERY_BASE_FEE_KOBO: 100000,
        DELIVERY_PER_KM_KOBO: 5000,
        LOGISTICS_PLATFORM_MARGIN_PCT: 10
      },
      jwtUtils,
      logisticsRepository,
      passwordUtils,
      sellerFinanceRepository
    });
  });

  it('registers a logistics company and returns a token', async () => {
    logisticsRepository.findCompanyByEmail.mockResolvedValue(null);
    logisticsRepository.findCompanyByPhone.mockResolvedValue(null);
    logisticsRepository.createLogisticsCompany.mockResolvedValue({
      id: 41,
      name: 'Swift Dispatch',
      email: 'ops@swift.ng',
      phone: '+2348012345678',
      address: '12 Sapara Williams Close',
      status: 'pending',
      approvedBy: null,
      createdAt: '2026-07-12T09:00:00.000Z',
      updatedAt: '2026-07-12T09:00:00.000Z'
    });

    const result = await logisticsService.registerCompany({
      name: 'Swift Dispatch',
      email: 'ops@swift.ng',
      phone: '08012345678',
      password: 'Password123',
      address: '12 Sapara Williams Close'
    });

    expect(passwordUtils.hashPassword).toHaveBeenCalledWith('Password123');
    expect(logisticsRepository.createLogisticsCompany).toHaveBeenCalledWith({
      name: 'Swift Dispatch',
      email: 'ops@swift.ng',
      phone: '+2348012345678',
      passwordHash: 'hashed-password',
      address: '12 Sapara Williams Close',
      status: 'pending',
      approvedBy: null
    });
    expect(result.token).toBe('logistics-token');
    expect(result.company.name).toBe('Swift Dispatch');
  });

  it('creates a rider for the authenticated company', async () => {
    logisticsRepository.findCompanyById.mockResolvedValue({
      id: 3,
      name: 'Swift Dispatch',
      email: 'ops@swift.ng',
      phone: '+2348012345678',
      address: '12 Sapara Williams Close',
      status: 'pending',
      approvedBy: null,
      createdAt: '2026-07-12T09:00:00.000Z',
      updatedAt: '2026-07-12T09:00:00.000Z'
    });
    logisticsRepository.findZoneById.mockResolvedValue({
      id: 7,
      name: 'Ikeja Central',
      state: 'Lagos',
      city: 'Ikeja'
    });
    logisticsRepository.findRiderByEmail.mockResolvedValue(null);
    logisticsRepository.findRiderByPhone.mockResolvedValue(null);
    logisticsRepository.createRider.mockResolvedValue({
      id: 12,
      companyId: 3,
      zoneId: 7,
      fullName: 'Alex Rider',
      phone: '+2348012345679',
      email: 'alex@swift.ng',
      vehicleType: 'van',
      status: 'available',
      createdAt: '2026-07-12T09:30:00.000Z',
      updatedAt: '2026-07-12T09:30:00.000Z',
      zone: {
        id: 7,
        name: 'Ikeja Central',
        state: 'Lagos',
        city: 'Ikeja'
      },
      company: {
        id: 3,
        name: 'Swift Dispatch',
        email: 'ops@swift.ng',
        phone: '+2348012345678',
        address: '12 Sapara Williams Close',
        status: 'pending',
        approvedBy: null,
        createdAt: '2026-07-12T09:00:00.000Z',
        updatedAt: '2026-07-12T09:00:00.000Z'
      }
    });

    const result = await logisticsService.createRider({
      companyId: 3,
      fullName: 'Alex Rider',
      email: 'alex@swift.ng',
      phone: '08012345679',
      password: 'Password123',
      vehicleType: 'van',
      zoneId: 7,
      status: 'available'
    });

    expect(logisticsRepository.createRider).toHaveBeenCalledWith({
      companyId: 3,
      zoneId: 7,
      fullName: 'Alex Rider',
      phone: '+2348012345679',
      email: 'alex@swift.ng',
      passwordHash: 'hashed-password',
      vehicleType: 'van',
      status: 'available'
    });
    expect(result.rider.company.name).toBe('Swift Dispatch');
  });

  it('rejects suspended riders during rider authentication', async () => {
    jwtUtils.verifyAccessToken.mockReturnValue({
      sub: 12,
      actorType: 'rider'
    });
    logisticsRepository.findRiderById.mockResolvedValue({
      id: 12,
      companyId: 3,
      zoneId: 7,
      fullName: 'Alex Rider',
      phone: '+2348012345679',
      email: 'alex@swift.ng',
      vehicleType: 'bike',
      status: 'available',
      accountStatus: 'suspended',
      company: {
        id: 3,
        status: 'approved'
      }
    });

    await expect(logisticsService.getAuthenticatedRider('rider-token')).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
      message: 'This rider account has been suspended.'
    });
  });

  it('suspends a rider, reassigns jobs awaiting pickup, and flags in-flight jobs for manual handling', async () => {
    logisticsRepository.findRiderByIdForCompany.mockResolvedValue({
      id: 14,
      companyId: 3,
      zoneId: 7,
      fullName: 'Alex Rider',
      phone: '+2348012345679',
      email: 'alex@swift.ng',
      vehicleType: 'bike',
      status: 'on_delivery',
      accountStatus: 'active',
      company: {
        id: 3,
        name: 'Swift Dispatch',
        status: 'approved'
      }
    });
    deliveryJobsRepository.listActiveJobsForRider.mockResolvedValue([
      {
        id: 91,
        status: 'assigned',
        assignedRider: {
          id: 14
        }
      },
      {
        id: 93,
        status: 'assigned',
        assignedRider: {
          id: 14
        }
      },
      {
        id: 92,
        status: 'picked_up',
        assignedRider: {
          id: 14
        }
      }
    ]);
    logisticsRepository.updateRiderAccountStatus.mockResolvedValue({
      id: 14,
      companyId: 3,
      zoneId: 7,
      fullName: 'Alex Rider',
      phone: '+2348012345679',
      email: 'alex@swift.ng',
      vehicleType: 'bike',
      status: 'on_delivery',
      accountStatus: 'suspended',
      company: {
        id: 3,
        name: 'Swift Dispatch',
        status: 'approved'
      }
    });
    deliveryJobsRepository.unassignJob
      .mockResolvedValueOnce({
        id: 91,
        status: 'pending',
        assignedRider: null
      })
      .mockResolvedValueOnce({
        id: 93,
        status: 'pending',
        assignedRider: null
      });
    assignmentService.attemptAutoAssignJob
      .mockResolvedValueOnce({
      id: 91,
      status: 'assigned',
      assignedRider: {
        id: 20,
        companyId: 3,
        zoneId: 7,
        fullName: 'Musa Bello',
        phone: '+2348012345680',
        email: 'musa@swift.ng',
        vehicleType: 'van',
        status: 'on_delivery',
        accountStatus: 'active',
        company: {
          id: 3,
          name: 'Swift Dispatch',
          status: 'approved'
        }
      },
      assignedCompany: {
        id: 3,
        name: 'Swift Dispatch',
        status: 'approved'
      }
    })
      .mockResolvedValueOnce({
        id: 93,
        status: 'pending',
        assignedRider: null
      });
    deliveryJobsRepository.flagJobForManualHandling.mockResolvedValue({
      id: 92,
      status: 'picked_up',
      assignedRider: {
        id: 14,
        companyId: 3,
        zoneId: 7,
        fullName: 'Alex Rider',
        phone: '+2348012345679',
        email: 'alex@swift.ng',
        vehicleType: 'bike',
        status: 'on_delivery',
        accountStatus: 'suspended',
        company: {
          id: 3,
          name: 'Swift Dispatch',
          status: 'approved'
        }
      },
      assignedCompany: {
        id: 3,
        name: 'Swift Dispatch',
        status: 'approved'
      }
    });

    const result = await logisticsService.suspendRider({
      companyId: 3,
      riderId: 14
    });

    expect(logisticsRepository.updateRider).not.toHaveBeenCalled();
    expect(logisticsRepository.updateRiderAccountStatus).toHaveBeenCalledWith(14, 'suspended');
    expect(deliveryJobsRepository.unassignJob).toHaveBeenCalledWith({
      jobId: 91,
      note: 'Rider was suspended before pickup, so this delivery job returned to the queue.'
    });
    expect(deliveryJobsRepository.unassignJob).toHaveBeenCalledWith({
      jobId: 93,
      note: 'Rider was suspended before pickup, so this delivery job returned to the queue.'
    });
    expect(assignmentService.attemptAutoAssignJob).toHaveBeenNthCalledWith(1, {
      jobId: 91
    });
    expect(assignmentService.attemptAutoAssignJob).toHaveBeenNthCalledWith(2, {
      jobId: 93
    });
    expect(deliveryJobsRepository.flagJobForManualHandling).toHaveBeenCalledWith({
      jobId: 92,
      note: 'Manual handling required because the assigned rider was suspended after pickup started.'
    });
    expect(result.rider.accountStatus).toBe('suspended');
    expect(result.reassignment.reassignedJobs).toHaveLength(1);
    expect(result.reassignment.returnedToQueueJobs).toHaveLength(1);
    expect(result.reassignment.manualHandlingJobs).toHaveLength(1);
    expect(result.reassignment.reassignedJobs[0].assignedRider.id).toBe(20);
    expect(result.reassignment.returnedToQueueJobs[0].id).toBe(93);
    expect(result.reassignment.manualHandlingJobs[0].id).toBe(92);
  });

  it('returns company earnings and payout balances', async () => {
    logisticsRepository.findCompanyById.mockResolvedValue({
      id: 3,
      name: 'Swift Dispatch',
      email: 'ops@swift.ng',
      phone: '+2348012345678',
      address: '12 Sapara Williams Close',
      status: 'approved',
      approvedBy: 1,
      createdAt: '2026-07-12T09:00:00.000Z',
      updatedAt: '2026-07-12T09:10:00.000Z'
    });
    sellerFinanceRepository.getLogisticsCompanyEarningsSummary.mockResolvedValue({
      completedJobsCount: 4,
      deliveryFeesKobo: 820000,
      platformMarginKobo: 82000,
      companyShareKobo: 738000
    });
    sellerFinanceRepository.summarizeLogisticsCompanyPayoutBalances.mockResolvedValue({
      pendingKobo: 123000,
      requestedKobo: 246000,
      approvedKobo: 369000,
      paidKobo: 492000
    });

    const result = await logisticsService.getCompanyEarnings({
      companyId: 3
    });

    expect(sellerFinanceRepository.getLogisticsCompanyEarningsSummary).toHaveBeenCalledWith({
      companyId: 3
    });
    expect(sellerFinanceRepository.summarizeLogisticsCompanyPayoutBalances).toHaveBeenCalledWith({
      companyId: 3
    });
    expect(result.summary.completedJobsCount).toBe(4);
    expect(result.payouts.pendingKobo).toBe(123000);
  });

  it('creates a logistics company payout request', async () => {
    logisticsRepository.findCompanyById.mockResolvedValue({
      id: 3,
      name: 'Swift Dispatch',
      email: 'ops@swift.ng',
      phone: '+2348012345678',
      address: '12 Sapara Williams Close',
      status: 'approved',
      approvedBy: 1,
      createdAt: '2026-07-12T09:00:00.000Z',
      updatedAt: '2026-07-12T09:10:00.000Z'
    });
    sellerFinanceRepository.createLogisticsCompanyPayoutRequest.mockResolvedValue({
      id: 9,
      payeeType: 'logistics_company',
      grossAmountKobo: 450000,
      commissionAmountKobo: 45000,
      amountKobo: 405000,
      status: 'requested',
      bankAccountRef: 'BANK-00991',
      itemCount: 2,
      requestedAt: '2026-07-12T12:00:00.000Z',
      settledAt: null,
      createdAt: '2026-07-12T12:00:00.000Z',
      updatedAt: '2026-07-12T12:00:00.000Z'
    });

    const result = await logisticsService.createCompanyPayoutRequest({
      companyId: 3,
      bankAccountRef: '  BANK-00991  '
    });

    expect(sellerFinanceRepository.createLogisticsCompanyPayoutRequest).toHaveBeenCalledWith({
      companyId: 3,
      bankAccountRef: 'BANK-00991'
    });
    expect(result.payout.companyShareKobo).toBe(405000);
  });

  it('returns company job dashboard summaries for status mix and rider performance', async () => {
    logisticsRepository.findCompanyById.mockResolvedValue({
      id: 3,
      name: 'Swift Dispatch',
      email: 'ops@swift.ng',
      phone: '+2348012345678',
      address: '12 Sapara Williams Close',
      status: 'approved',
      approvedBy: 1,
      createdAt: '2026-07-12T09:00:00.000Z',
      updatedAt: '2026-07-12T09:10:00.000Z'
    });
    deliveryJobsRepository.listJobs.mockResolvedValue({
      jobs: [
        {
          id: 1,
          orderId: 55,
          orderItemId: 88,
          sellerId: 12,
          companyId: 3,
          riderId: 12,
          status: 'delivered',
          failureReason: null,
          deliveryFeeKobo: 200000,
          platformMarginKobo: 20000,
          companyShareKobo: 180000,
          pickupAddress: '12 Sapara Williams Close',
          assignedAt: '2026-07-12T09:05:00.000Z',
          pickedUpAt: '2026-07-12T09:20:00.000Z',
          inTransitAt: '2026-07-12T09:30:00.000Z',
          deliveredAt: '2026-07-12T09:40:00.000Z',
          settlementRecordedAt: '2026-07-12T09:40:00.000Z',
          createdAt: '2026-07-12T09:00:00.000Z',
          updatedAt: '2026-07-12T09:40:00.000Z',
          zone: {
            id: 7,
            name: 'Ikeja Central',
            state: 'Lagos',
            city: 'Ikeja'
          },
          order: {
            id: 55,
            status: 'delivered',
            paymentMethod: 'paystack',
            paymentReference: 'APT-55-REF',
            paymentStatus: 'paid',
            totalKobo: 4500000,
            deliveryAddress: {
              id: 4,
              label: 'Workshop',
              street: '12 Adeola Odeku Street',
              city: 'Ikeja',
              state: 'Lagos',
              phone: '+2348012345678'
            }
          },
          item: {
            id: 88,
            productId: 4001,
            title: 'Brake Disc',
            partNumber: 'BRK-4001',
            quantity: 1,
            lineTotalKobo: 4500000,
            itemStatus: 'delivered'
          },
          buyer: {
            id: 21,
            fullName: 'Bola Adeniran',
            email: 'bola@example.com',
            phone: '+2348012345678'
          },
          seller: {
            id: 12,
            userId: 8,
            businessName: 'Prime Auto Hub',
            contactEmail: 'sales@primeautohub.ng',
            contactPhone: '+2348012345678',
            address: '12 Sapara Williams Close',
            fullName: 'Uche Okafor',
            email: 'uche@example.com',
            phone: '+2348012345678'
          },
          assignedCompany: {
            id: 3,
            name: 'Swift Dispatch',
            email: 'ops@swift.ng',
            phone: '+2348012345678',
            address: '12 Sapara Williams Close',
            status: 'approved',
            approvedBy: 1,
            createdAt: '2026-07-12T09:00:00.000Z',
            updatedAt: '2026-07-12T09:10:00.000Z'
          },
          assignedRider: {
            id: 12,
            companyId: 3,
            zoneId: 7,
            fullName: 'Alex Rider',
            phone: '+2348012345679',
            email: 'alex@swift.ng',
            vehicleType: 'bike',
            status: 'available',
            createdAt: '2026-07-12T09:00:00.000Z',
            updatedAt: '2026-07-12T10:00:00.000Z',
            zone: {
              id: 7,
              name: 'Ikeja Central',
              state: 'Lagos',
              city: 'Ikeja'
            },
            company: {
              id: 3,
              name: 'Swift Dispatch',
              email: 'ops@swift.ng',
              phone: '+2348012345678',
              address: '12 Sapara Williams Close',
              status: 'approved',
              approvedBy: 1,
              createdAt: '2026-07-12T09:00:00.000Z',
              updatedAt: '2026-07-12T09:10:00.000Z'
            }
          }
        }
      ],
      total: 1
    });
    deliveryJobsRepository.summarizeJobs.mockResolvedValue({
      totalJobsCount: 2,
      unassignedJobsCount: 0,
      pendingCount: 0,
      assignedCount: 1,
      pickedUpCount: 0,
      inTransitCount: 0,
      deliveredCount: 1,
      failedCount: 0,
      cancelledCount: 0,
      activeJobsCount: 1,
      deliveryFeesKobo: 200000,
      platformMarginKobo: 20000,
      companyShareKobo: 180000,
      averageDeliveryFeeKobo: 200000
    });
    logisticsRepository.summarizeRiders.mockResolvedValue({
      totalRidersCount: 2,
      availableCount: 1,
      onDeliveryCount: 1,
      unavailableCount: 0,
      inactiveCount: 0
    });
    deliveryJobsRepository.listCompanyRiderPerformance.mockResolvedValue([
      {
        rider: {
          id: 12,
          companyId: 3,
          zoneId: 7,
          fullName: 'Alex Rider',
          phone: '+2348012345679',
          email: 'alex@swift.ng',
          vehicleType: 'bike',
          status: 'available',
          createdAt: '2026-07-12T09:30:00.000Z',
          updatedAt: '2026-07-12T09:40:00.000Z',
          zone: {
            id: 7,
            name: 'Ikeja Central',
            state: 'Lagos',
            city: 'Ikeja'
          },
          company: {
            id: 3,
            name: 'Swift Dispatch',
            email: 'ops@swift.ng',
            phone: '+2348012345678',
            address: '12 Sapara Williams Close',
            status: 'approved',
            approvedBy: 1,
            createdAt: '2026-07-12T09:00:00.000Z',
            updatedAt: '2026-07-12T09:10:00.000Z'
          }
        },
        totalJobsCount: 2,
        assignedJobsCount: 1,
        pickedUpJobsCount: 0,
        inTransitJobsCount: 0,
        activeJobsCount: 1,
        deliveredJobsCount: 1,
        failedJobsCount: 0,
        cancelledJobsCount: 0,
        deliveryFeesKobo: 200000,
        companyShareKobo: 180000
      }
    ]);

    const result = await logisticsService.listCompanyJobs({
      companyId: 3,
      query: {
        status: 'all',
        page: 1,
        limit: 10
      }
    });

    expect(deliveryJobsRepository.summarizeJobs).toHaveBeenCalledWith({
      companyId: 3,
      search: null
    });
    expect(logisticsRepository.summarizeRiders).toHaveBeenCalledWith({
      companyId: 3
    });
    expect(result.summary.jobsByStatus).toEqual({
      total: 2,
      pending: 0,
      assigned: 1,
      picked_up: 0,
      in_transit: 0,
      delivered: 1,
      failed: 0,
      cancelled: 0
    });
    expect(result.summary.riderPerformance.summary).toEqual({
      totalRidersCount: 2,
      availableCount: 1,
      onDeliveryCount: 1,
      unavailableCount: 0,
      inactiveCount: 0,
      activeJobsCount: 1,
      deliveredJobsCount: 1,
      failedJobsCount: 0,
      completionRatePercent: 100
    });
    expect(result.summary.riderPerformance.riders[0].completionRatePercent).toBe(100);
  });

  it('returns paginated rider jobs', async () => {
    logisticsRepository.findRiderById.mockResolvedValue({
      id: 12,
      companyId: 3,
      zoneId: 7,
      fullName: 'Alex Rider',
      phone: '+2348012345679',
      email: 'alex@swift.ng',
      vehicleType: 'van',
      status: 'available',
      createdAt: '2026-07-12T09:30:00.000Z',
      updatedAt: '2026-07-12T09:30:00.000Z',
      zone: {
        id: 7,
        name: 'Ikeja Central',
        state: 'Lagos',
        city: 'Ikeja'
      },
      company: {
        id: 3,
        name: 'Swift Dispatch',
        email: 'ops@swift.ng',
        phone: '+2348012345678',
        address: '12 Sapara Williams Close',
        status: 'approved',
        approvedBy: 1,
        createdAt: '2026-07-12T09:00:00.000Z',
        updatedAt: '2026-07-12T09:10:00.000Z'
      }
    });
    deliveryJobsRepository.listJobs.mockResolvedValue({
      jobs: [
        {
          id: 1,
          status: 'assigned',
          pickupAddress: '12 Sapara Williams Close',
          assignedAt: '2026-07-12T09:05:00.000Z',
          pickedUpAt: null,
          inTransitAt: null,
          deliveredAt: null,
          createdAt: '2026-07-12T09:00:00.000Z',
          updatedAt: '2026-07-12T09:00:00.000Z',
          orderId: 55,
          orderItemId: 88,
          sellerId: 12,
          companyId: 3,
          riderId: 12,
          order: {
            id: 55,
            status: 'confirmed',
            paymentMethod: 'paystack',
            paymentReference: 'APT-55-REF',
            paymentStatus: 'paid',
            totalKobo: 4500000,
            deliveryAddress: {
              id: 4,
              label: 'Workshop',
              street: '12 Adeola Odeku Street',
              city: 'Ikeja',
              state: 'Lagos',
              phone: '+2348012345678'
            }
          },
          item: {
            id: 88,
            productId: 4001,
            title: 'Brake Disc',
            partNumber: 'DISC-001',
            quantity: 1,
            lineTotalKobo: 4500000,
            itemStatus: 'ready_for_pickup'
          },
          buyer: {
            id: 5,
            fullName: 'Buyer User',
            email: 'buyer@example.com',
            phone: null
          },
          seller: {
            id: 12,
            userId: 18,
            businessName: 'Prime Auto Hub',
            contactEmail: 'sales@primeautohub.ng',
            contactPhone: '+2348012345678',
            address: '12 Sapara Williams Close',
            fullName: 'Uche Okafor',
            email: 'uche@example.com',
            phone: '+2348012345678'
          },
          assignedCompany: null,
          assignedRider: {
            id: 12,
            companyId: 3,
            zoneId: 7,
            fullName: 'Alex Rider',
            phone: '+2348012345679',
            email: 'alex@swift.ng',
            vehicleType: 'van',
            status: 'on_delivery',
            createdAt: '2026-07-12T09:30:00.000Z',
            updatedAt: '2026-07-12T09:30:00.000Z',
            company: {
              id: 3,
              name: 'Swift Dispatch',
              email: 'ops@swift.ng',
              phone: '+2348012345678',
              address: '12 Sapara Williams Close',
              status: 'approved',
              approvedBy: 1,
              createdAt: '2026-07-12T09:00:00.000Z',
              updatedAt: '2026-07-12T09:10:00.000Z'
            }
          }
        }
      ],
      total: 1
    });

    const result = await logisticsService.listRiderJobs({
      riderId: 12,
      query: {
        status: 'assigned',
        page: 1,
        limit: 10
      }
    });

    expect(result.jobs[0].jobCode).toBe('DLV-0001');
    expect(result.pagination.total).toBe(1);
    expect(result.filters.status).toBe('assigned');
    expect(deliveryJobsRepository.listJobs).toHaveBeenCalledWith(expect.objectContaining({
      riderId: 12
    }));
  });

  it('rejects rider delivery job updates that skip the status flow', async () => {
    logisticsRepository.findRiderById.mockResolvedValue({
      id: 12,
      companyId: 3,
      zoneId: 7,
      fullName: 'Alex Rider',
      phone: '+2348012345679',
      email: 'alex@swift.ng',
      vehicleType: 'van',
      status: 'available',
      createdAt: '2026-07-12T09:30:00.000Z',
      updatedAt: '2026-07-12T09:30:00.000Z',
      zone: { id: 7, name: 'Ikeja Central', state: 'Lagos', city: 'Ikeja' },
      company: {
        id: 3,
        name: 'Swift Dispatch',
        email: 'ops@swift.ng',
        phone: '+2348012345678',
        address: '12 Sapara Williams Close',
        status: 'approved',
        approvedBy: 1,
        createdAt: '2026-07-12T09:00:00.000Z',
        updatedAt: '2026-07-12T09:10:00.000Z'
      }
    });
    deliveryJobsRepository.findJobById.mockResolvedValue({
      id: 1,
      status: 'assigned',
      order: {
        status: 'confirmed',
        paymentStatus: 'paid'
      },
      assignedRider: {
        id: 12
      }
    });

    await expect(logisticsService.updateRiderJobStatus({
      riderId: 12,
      jobId: 1,
      status: 'delivered'
    })).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT'
    });
  });

  it('updates a delivery job for the assigned rider', async () => {
    logisticsRepository.findRiderById.mockResolvedValue({
      id: 12,
      companyId: 3,
      zoneId: 7,
      fullName: 'Alex Rider',
      phone: '+2348012345679',
      email: 'alex@swift.ng',
      vehicleType: 'van',
      status: 'available',
      createdAt: '2026-07-12T09:30:00.000Z',
      updatedAt: '2026-07-12T09:30:00.000Z',
      zone: { id: 7, name: 'Ikeja Central', state: 'Lagos', city: 'Ikeja' },
      company: {
        id: 3,
        name: 'Swift Dispatch',
        email: 'ops@swift.ng',
        phone: '+2348012345678',
        address: '12 Sapara Williams Close',
        status: 'approved',
        approvedBy: 1,
        createdAt: '2026-07-12T09:00:00.000Z',
        updatedAt: '2026-07-12T09:10:00.000Z'
      }
    });
    deliveryJobsRepository.findJobById.mockResolvedValue({
      id: 1,
      status: 'assigned',
      order: {
        status: 'confirmed',
        paymentStatus: 'paid'
      },
      assignedRider: {
        id: 12
      }
    });
    deliveryJobsRepository.updateJobStatus.mockResolvedValue({
      id: 1,
      status: 'picked_up',
      pickupAddress: '12 Sapara Williams Close',
      assignedAt: '2026-07-12T10:00:00.000Z',
      pickedUpAt: '2026-07-12T10:00:00.000Z',
      inTransitAt: null,
      deliveredAt: null,
      createdAt: '2026-07-12T09:00:00.000Z',
      updatedAt: '2026-07-12T10:00:00.000Z',
      order: {
        id: 55,
        status: 'picked_up',
        paymentMethod: 'paystack',
        paymentReference: 'APT-55-REF',
        paymentStatus: 'paid',
        totalKobo: 4500000,
        deliveryAddress: {
          id: 4,
          label: 'Workshop',
          street: '12 Adeola Odeku Street',
          city: 'Ikeja',
          state: 'Lagos',
          phone: '+2348012345678'
        }
      },
      item: {
        id: 88,
        productId: 4001,
        title: 'Brake Disc',
        partNumber: 'DISC-001',
        quantity: 1,
        lineTotalKobo: 4500000,
        itemStatus: 'picked_up'
      },
      buyer: {
        id: 5,
        fullName: 'Buyer User',
        email: 'buyer@example.com',
        phone: null
      },
      seller: {
        id: 12,
        userId: 18,
        businessName: 'Prime Auto Hub',
        contactEmail: 'sales@primeautohub.ng',
        contactPhone: '+2348012345678',
        address: '12 Sapara Williams Close',
        fullName: 'Uche Okafor',
        email: 'uche@example.com',
        phone: '+2348012345678'
      },
      assignedCompany: {
        id: 3,
        name: 'Swift Dispatch',
        email: 'ops@swift.ng',
        phone: '+2348012345678',
        address: '12 Sapara Williams Close',
        status: 'approved',
        approvedBy: 1,
        createdAt: '2026-07-12T09:00:00.000Z',
        updatedAt: '2026-07-12T09:10:00.000Z'
      },
      assignedRider: {
        id: 12,
        companyId: 3,
        zoneId: 7,
        fullName: 'Alex Rider',
        phone: '+2348012345679',
        email: 'alex@swift.ng',
        vehicleType: 'van',
        status: 'on_delivery',
        createdAt: '2026-07-12T09:30:00.000Z',
        updatedAt: '2026-07-12T10:00:00.000Z',
        company: {
          id: 3,
          name: 'Swift Dispatch',
          email: 'ops@swift.ng',
          phone: '+2348012345678',
          address: '12 Sapara Williams Close',
          status: 'approved',
          approvedBy: 1,
          createdAt: '2026-07-12T09:00:00.000Z',
          updatedAt: '2026-07-12T09:10:00.000Z'
        }
      }
    });
    deliveryJobsRepository.findStatusHistoryByJobId.mockResolvedValue([
      {
        id: 1,
        deliveryJobId: 1,
        status: 'assigned',
        note: 'Delivery job auto-assigned to Alex Rider.',
        createdAt: '2026-07-12T09:00:00.000Z',
        updatedAt: '2026-07-12T09:00:00.000Z'
      },
      {
        id: 2,
        deliveryJobId: 1,
        status: 'picked_up',
        note: 'Delivery job moved from assigned to picked_up.',
        createdAt: '2026-07-12T10:00:00.000Z',
        updatedAt: '2026-07-12T10:00:00.000Z'
      }
    ]);

    const result = await logisticsService.updateRiderJobStatus({
      riderId: 12,
      jobId: 1,
      status: 'picked_up'
    });

    expect(deliveryJobsRepository.updateJobStatus).toHaveBeenCalledWith({
      jobId: 1,
      riderId: 12,
      companyId: 3,
      platformMarginKobo: 0,
      companyShareKobo: 0,
      status: 'picked_up',
      note: undefined,
      failureReason: null
    });
    expect(result.statusHistory).toHaveLength(2);
    expect(result.status).toBe('picked_up');
  });

  it('requires a failure reason when a rider marks a job as failed', async () => {
    logisticsRepository.findRiderById.mockResolvedValue({
      id: 12,
      companyId: 3,
      zoneId: 7,
      fullName: 'Alex Rider',
      phone: '+2348012345679',
      email: 'alex@swift.ng',
      vehicleType: 'van',
      status: 'available',
      createdAt: '2026-07-12T09:30:00.000Z',
      updatedAt: '2026-07-12T09:30:00.000Z',
      zone: { id: 7, name: 'Ikeja Central', state: 'Lagos', city: 'Ikeja' },
      company: {
        id: 3,
        name: 'Swift Dispatch',
        email: 'ops@swift.ng',
        phone: '+2348012345678',
        address: '12 Sapara Williams Close',
        status: 'approved',
        approvedBy: 1,
        createdAt: '2026-07-12T09:00:00.000Z',
        updatedAt: '2026-07-12T09:10:00.000Z'
      }
    });
    deliveryJobsRepository.findJobById.mockResolvedValue({
      id: 1,
      status: 'assigned',
      order: {
        status: 'confirmed',
        paymentStatus: 'paid'
      },
      assignedRider: {
        id: 12
      }
    });

    await expect(logisticsService.updateRiderJobStatus({
      riderId: 12,
      jobId: 1,
      status: 'failed'
    })).rejects.toMatchObject({
      statusCode: 422,
      code: 'VALIDATION_ERROR'
    });
  });

  it('marks a delivery job as failed for the assigned rider', async () => {
    logisticsRepository.findRiderById.mockResolvedValue({
      id: 12,
      companyId: 3,
      zoneId: 7,
      fullName: 'Alex Rider',
      phone: '+2348012345679',
      email: 'alex@swift.ng',
      vehicleType: 'van',
      status: 'on_delivery',
      createdAt: '2026-07-12T09:30:00.000Z',
      updatedAt: '2026-07-12T09:45:00.000Z',
      zone: { id: 7, name: 'Ikeja Central', state: 'Lagos', city: 'Ikeja' },
      company: {
        id: 3,
        name: 'Swift Dispatch',
        email: 'ops@swift.ng',
        phone: '+2348012345678',
        address: '12 Sapara Williams Close',
        status: 'approved',
        approvedBy: 1,
        createdAt: '2026-07-12T09:00:00.000Z',
        updatedAt: '2026-07-12T09:10:00.000Z'
      }
    });
    deliveryJobsRepository.findJobById.mockResolvedValue({
      id: 1,
      status: 'picked_up',
      order: {
        status: 'picked_up',
        paymentStatus: 'paid'
      },
      assignedRider: {
        id: 12
      }
    });
    deliveryJobsRepository.updateJobStatus.mockResolvedValue({
      id: 1,
      status: 'failed',
      failureReason: 'Buyer was unreachable at delivery point.',
      pickupAddress: '12 Sapara Williams Close',
      assignedAt: '2026-07-12T10:00:00.000Z',
      pickedUpAt: '2026-07-12T10:00:00.000Z',
      inTransitAt: null,
      deliveredAt: null,
      createdAt: '2026-07-12T09:00:00.000Z',
      updatedAt: '2026-07-12T10:20:00.000Z',
      order: {
        id: 55,
        status: 'confirmed',
        paymentMethod: 'paystack',
        paymentReference: 'APT-55-REF',
        paymentStatus: 'paid',
        totalKobo: 4500000,
        deliveryAddress: {
          id: 4,
          label: 'Workshop',
          street: '12 Adeola Odeku Street',
          city: 'Ikeja',
          state: 'Lagos',
          phone: '+2348012345678'
        }
      },
      item: {
        id: 88,
        productId: 4001,
        title: 'Brake Disc',
        partNumber: 'DISC-001',
        quantity: 1,
        lineTotalKobo: 4500000,
        itemStatus: 'ready_for_pickup'
      },
      buyer: {
        id: 5,
        fullName: 'Buyer User',
        email: 'buyer@example.com',
        phone: null
      },
      seller: {
        id: 12,
        userId: 18,
        businessName: 'Prime Auto Hub',
        contactEmail: 'sales@primeautohub.ng',
        contactPhone: '+2348012345678',
        address: '12 Sapara Williams Close',
        fullName: 'Uche Okafor',
        email: 'uche@example.com',
        phone: '+2348012345678'
      },
      assignedCompany: {
        id: 3,
        name: 'Swift Dispatch',
        email: 'ops@swift.ng',
        phone: '+2348012345678',
        address: '12 Sapara Williams Close',
        status: 'approved',
        approvedBy: 1,
        createdAt: '2026-07-12T09:00:00.000Z',
        updatedAt: '2026-07-12T09:10:00.000Z'
      },
      assignedRider: {
        id: 12,
        companyId: 3,
        zoneId: 7,
        fullName: 'Alex Rider',
        phone: '+2348012345679',
        email: 'alex@swift.ng',
        vehicleType: 'van',
        status: 'available',
        createdAt: '2026-07-12T09:30:00.000Z',
        updatedAt: '2026-07-12T10:20:00.000Z',
        company: {
          id: 3,
          name: 'Swift Dispatch',
          email: 'ops@swift.ng',
          phone: '+2348012345678',
          address: '12 Sapara Williams Close',
          status: 'approved',
          approvedBy: 1,
          createdAt: '2026-07-12T09:00:00.000Z',
          updatedAt: '2026-07-12T09:10:00.000Z'
        }
      }
    });
    deliveryJobsRepository.findStatusHistoryByJobId.mockResolvedValue([
      {
        id: 1,
        deliveryJobId: 1,
        status: 'assigned',
        note: 'Delivery job auto-assigned to Alex Rider.',
        createdAt: '2026-07-12T09:00:00.000Z',
        updatedAt: '2026-07-12T09:00:00.000Z'
      },
      {
        id: 2,
        deliveryJobId: 1,
        status: 'picked_up',
        note: 'Delivery job moved from assigned to picked_up.',
        createdAt: '2026-07-12T10:00:00.000Z',
        updatedAt: '2026-07-12T10:00:00.000Z'
      },
      {
        id: 3,
        deliveryJobId: 1,
        status: 'failed',
        note: 'Delivery job failed: Buyer was unreachable at delivery point.',
        createdAt: '2026-07-12T10:20:00.000Z',
        updatedAt: '2026-07-12T10:20:00.000Z'
      }
    ]);

    const result = await logisticsService.updateRiderJobStatus({
      riderId: 12,
      jobId: 1,
      status: 'failed',
      failureReason: 'Buyer was unreachable at delivery point.'
    });

    expect(deliveryJobsRepository.updateJobStatus).toHaveBeenCalledWith({
      jobId: 1,
      riderId: 12,
      companyId: 3,
      platformMarginKobo: 0,
      companyShareKobo: 0,
      status: 'failed',
      note: undefined,
      failureReason: 'Buyer was unreachable at delivery point.'
    });
    expect(result.failureReason).toBe('Buyer was unreachable at delivery point.');
    expect(result.statusHistory).toHaveLength(3);
    expect(result.status).toBe('failed');
  });
});
