require('../../setup/jest');

const { createAdminService } = require('../../../src/services/admin.service');

function buildCategory(overrides = {}) {
  return {
    id: 1001,
    name: 'Engine Components',
    slug: 'engine-components',
    parentId: null,
    status: 'active',
    createdAt: '2026-07-07T09:00:00.000Z',
    updatedAt: '2026-07-07T09:00:00.000Z',
    ...overrides
  };
}

function buildVehicleTaxonomyEntry(overrides = {}) {
  return {
    id: 3001,
    make: 'Toyota',
    model: 'Camry',
    yearFrom: 2007,
    yearTo: 2011,
    createdAt: '2026-07-07T09:00:00.000Z',
    updatedAt: '2026-07-07T09:00:00.000Z',
    ...overrides
  };
}

function buildManagedUser(overrides = {}) {
  return {
    id: 21,
    role: 'seller',
    fullName: 'Uche Okafor',
    email: 'uche@example.com',
    phone: '+2348012345678',
    isVerified: false,
    accountStatus: 'active',
    createdAt: '2026-07-07T09:00:00.000Z',
    updatedAt: '2026-07-07T09:00:00.000Z',
    ...overrides
  };
}

function buildSellerAccount(overrides = {}) {
  return {
    user: buildManagedUser(),
    sellerProfile: {
      id: 101,
      userId: 21,
      businessName: 'Prime Auto Hub',
      rating: 0,
      contactPhone: '+2348012345678',
      contactEmail: 'sales@primeautohub.ng',
      address: '12 Sapara Williams Close, Victoria Island, Lagos',
      cacNumber: 'RC-123456',
      verificationStatus: 'pending',
      rejectionReason: null,
      documents: [
        { id: 1, type: 'cac' },
        { id: 2, type: 'proof_of_address' }
      ],
      createdAt: '2026-07-07T09:00:00.000Z',
      updatedAt: '2026-07-07T09:05:00.000Z'
    },
    ...overrides
  };
}

function buildAdminOrder(overrides = {}) {
  return {
    id: 5001,
    buyerId: 11,
    buyerFullName: 'Bola Adeniran',
    buyerEmail: 'bola@example.com',
    buyerPhone: '+2348012345678',
    status: 'confirmed',
    paymentMethod: 'paystack',
    subtotalKobo: 3200000,
    deliveryFeeKobo: 500000,
    totalKobo: 3700000,
    paymentReference: 'APT-5001-REF',
    paymentStatus: 'paid',
    totalItems: 2,
    sellerCount: 1,
    createdAt: '2026-07-07T09:00:00.000Z',
    updatedAt: '2026-07-07T09:00:00.000Z',
    ...overrides
  };
}

function buildOrderStatusHistoryEntry(overrides = {}) {
  return {
    id: 1,
    orderId: 5001,
    status: 'confirmed',
    note: 'Payment verified and order confirmed.',
    createdAt: '2026-07-07T09:00:00.000Z',
    updatedAt: '2026-07-07T09:00:00.000Z',
    ...overrides
  };
}

function buildAdminPayout(overrides = {}) {
  return {
    id: 901,
    sellerId: 101,
    grossAmountKobo: 9000000,
    commissionAmountKobo: 1080000,
    amountKobo: 7920000,
    status: 'requested',
    approvedBy: null,
    approvedAt: null,
    rejectionReason: null,
    bankAccountRef: 'BANK-001',
    itemCount: 1,
    requestedAt: '2026-07-07T10:00:00.000Z',
    settledAt: null,
    createdAt: '2026-07-07T10:00:00.000Z',
    updatedAt: '2026-07-07T10:00:00.000Z',
    seller: {
      id: 101,
      userId: 21,
      businessName: 'Prime Auto Hub',
      contactEmail: 'sales@primeautohub.ng',
      contactPhone: '+2348012345678',
      fullName: 'Uche Okafor',
      email: 'uche@example.com',
      phone: '+2348012345678'
    },
    items: [
      {
        id: 1,
        payoutId: 901,
        orderItemId: 501,
        orderId: 5001,
        productId: 7001,
        quantity: 2,
        grossAmountKobo: 9000000,
        commissionAmountKobo: 1080000,
        netAmountKobo: 7920000,
        orderStatus: 'confirmed',
        paidAt: '2026-07-07T09:30:00.000Z',
        createdAt: '2026-07-07T10:00:00.000Z',
        updatedAt: '2026-07-07T10:00:00.000Z'
      }
    ],
    ...overrides
  };
}

function buildAdminDispute(overrides = {}) {
  return {
    id: 301,
    orderId: 5001,
    raisedBy: 'buyer',
    reason: 'Buyer reported a damaged part on delivery.',
    status: 'open',
    resolutionNote: null,
    refundReference: null,
    refundAmountKobo: null,
    resolvedBy: null,
    resolvedAt: null,
    createdAt: '2026-07-09T12:00:00.000Z',
    updatedAt: '2026-07-09T12:00:00.000Z',
    order: {
      id: 5001,
      status: 'disputed',
      paymentMethod: 'paystack',
      paymentReference: 'APT-5001-REF',
      paymentStatus: 'paid',
      totalKobo: 3700000,
      createdAt: '2026-07-07T09:00:00.000Z',
      updatedAt: '2026-07-09T12:00:00.000Z'
    },
    buyer: {
      id: 11,
      fullName: 'Bola Adeniran',
      email: 'bola@example.com',
      phone: '+2348012345678'
    },
    raisedBySeller: null,
    resolvedByAdmin: null,
    sellers: [
      {
        id: 101,
        userId: 21,
        businessName: 'Prime Auto Hub',
        contactEmail: 'sales@primeautohub.ng',
        contactPhone: '+2348012345678',
        fullName: 'Uche Okafor',
        email: 'uche@example.com',
        phone: '+2348012345678'
      }
    ],
    ...overrides
  };
}

function buildAuditLogEntry(overrides = {}) {
  return {
    id: 1,
    action: 'payout.approved',
    targetType: 'payout',
    targetId: 901,
    detail: {
      previousStatus: 'requested',
      nextStatus: 'approved'
    },
    createdAt: '2026-07-09T12:30:00.000Z',
    admin: {
      id: 5,
      fullName: 'Super Admin',
      email: 'superadmin@example.com'
    },
    ...overrides
  };
}

describe('admin service', () => {
  let adminRepository;
  let auditLogRepository;
  let disputesRepository;
  let productsRepository;
  let platformConfigRepository;
  let sellerFinanceRepository;
  let usersRepository;
  let sellersRepository;
  let ordersRepository;
  let jwtUtils;
  let passwordUtils;
  let adminService;

  beforeEach(() => {
    adminRepository = {
      findAdminByEmail: jest.fn(),
      findAdminById: jest.fn(),
      findSellerAccountBySellerId: jest.fn(),
      listSellerVerificationQueue: jest.fn(),
      updateSellerVerificationStatus: jest.fn()
    };
    auditLogRepository = {
      createAuditLog: jest.fn(),
      listAuditLogs: jest.fn()
    };
    disputesRepository = {
      findDisputeByIdForAdmin: jest.fn(),
      listDisputesForAdmin: jest.fn(),
      updateDisputeDecision: jest.fn()
    };
    productsRepository = {
      countProductCompatibilityReferences: jest.fn(),
      createCategory: jest.fn(),
      createVehicleTaxonomy: jest.fn(),
      deleteVehicleTaxonomy: jest.fn(),
      findCategoryById: jest.fn(),
      findCategoryBySlug: jest.fn(),
      findVehicleTaxonomyById: jest.fn(),
      findVehicleTaxonomyEntry: jest.fn(),
      listAllCategories: jest.fn(),
      updateCategoriesStatus: jest.fn(),
      listVehicleTaxonomy: jest.fn(),
      updateCategory: jest.fn(),
      updateVehicleTaxonomy: jest.fn()
    };
    platformConfigRepository = {
      findPlatformConfigByKey: jest.fn(),
      listPlatformConfigByKeys: jest.fn(),
      upsertPlatformConfigEntries: jest.fn()
    };
    sellerFinanceRepository = {
      findPayoutByIdForAdmin: jest.fn(),
      listPayoutsForAdmin: jest.fn(),
      updatePayoutStatusForAdmin: jest.fn()
    };
    usersRepository = {
      findManagedUserById: jest.fn(),
      listManagedUsers: jest.fn(),
      updateAccountStatus: jest.fn()
    };
    sellersRepository = {
      findByUserId: jest.fn()
    };
    ordersRepository = {
      findOrderByIdForAdmin: jest.fn(),
      findOrderStatusHistoryByOrderIdForAdmin: jest.fn(),
      listOrdersForAdmin: jest.fn(),
      updateOrderStatusForAdmin: jest.fn()
    };

    jwtUtils = {
      signAccessToken: jest.fn(() => 'signed-admin-token'),
      verifyAccessToken: jest.fn()
    };

    passwordUtils = {
      comparePassword: jest.fn()
    };

    adminService = createAdminService({
      adminRepository,
      auditLogRepository,
      disputesRepository,
      env: {
        PLATFORM_COMMISSION_RATE_PERCENT: 10
      },
      productsRepository,
      platformConfigRepository,
      sellerFinanceRepository,
      usersRepository,
      sellersRepository,
      ordersRepository,
      jwtUtils,
      passwordUtils
    });
  });

  describe('login', () => {
    it('logs in an active admin and returns sanitized permissions', async () => {
      adminRepository.findAdminByEmail.mockResolvedValue({
        id: 7,
        fullName: 'Super Admin',
        email: 'superadmin@example.com',
        passwordHash: 'stored-hash',
        isActive: true,
        roles: [
          {
            id: 1,
            name: 'super_admin',
            description: 'Full access.'
          }
        ],
        permissions: [
          {
            id: 1,
            key: 'admins.read_self',
            description: 'Read own profile.'
          },
          {
            id: 2,
            key: 'sellers.verify',
            description: 'Verify sellers.'
          }
        ],
        createdAt: '2026-07-07T09:00:00.000Z',
        updatedAt: '2026-07-07T09:00:00.000Z'
      });
      passwordUtils.comparePassword.mockResolvedValue(true);

      const result = await adminService.login({
        email: 'SUPERADMIN@EXAMPLE.COM',
        password: 'Password123'
      });

      expect(adminRepository.findAdminByEmail).toHaveBeenCalledWith('superadmin@example.com');
      expect(passwordUtils.comparePassword).toHaveBeenCalledWith('Password123', 'stored-hash');
      expect(jwtUtils.signAccessToken).toHaveBeenCalledWith({
        sub: 7,
        actorType: 'admin'
      });
      expect(result).toEqual({
        token: 'signed-admin-token',
        admin: {
          id: 7,
          fullName: 'Super Admin',
          email: 'superadmin@example.com',
          isActive: true,
          roles: ['super_admin'],
          permissions: ['admins.read_self', 'sellers.verify'],
          createdAt: '2026-07-07T09:00:00.000Z',
          updatedAt: '2026-07-07T09:00:00.000Z'
        }
      });
    });

    it('rejects inactive admins after credentials are verified', async () => {
      adminRepository.findAdminByEmail.mockResolvedValue({
        id: 8,
        email: 'inactive@example.com',
        passwordHash: 'stored-hash',
        isActive: false,
        roles: [],
        permissions: []
      });
      passwordUtils.comparePassword.mockResolvedValue(true);

      await expect(adminService.login({
        email: 'inactive@example.com',
        password: 'Password123'
      })).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN'
      });
    });
  });

  describe('getAuthenticatedAdmin', () => {
    it('returns a sanitized authenticated admin', async () => {
      jwtUtils.verifyAccessToken.mockReturnValue({
        sub: 5,
        actorType: 'admin'
      });
      adminRepository.findAdminById.mockResolvedValue({
        id: 5,
        fullName: 'Verification Admin',
        email: 'verify@example.com',
        passwordHash: 'secret',
        isActive: true,
        roles: [
          {
            id: 2,
            name: 'verification_admin',
            description: 'Seller verification.'
          }
        ],
        permissions: [
          {
            id: 1,
            key: 'admins.read_self',
            description: 'Read own profile.'
          },
          {
            id: 2,
            key: 'sellers.verify',
            description: 'Verify sellers.'
          }
        ],
        createdAt: '2026-07-07T09:00:00.000Z',
        updatedAt: '2026-07-07T09:00:00.000Z'
      });

      const result = await adminService.getAuthenticatedAdmin('token');

      expect(result).toEqual({
        id: 5,
        fullName: 'Verification Admin',
        email: 'verify@example.com',
        isActive: true,
        roles: ['verification_admin'],
        permissions: ['admins.read_self', 'sellers.verify'],
        createdAt: '2026-07-07T09:00:00.000Z',
        updatedAt: '2026-07-07T09:00:00.000Z'
      });
    });

    it('rejects tokens that do not belong to admins', async () => {
      jwtUtils.verifyAccessToken.mockReturnValue({
        sub: 5,
        actorType: 'user'
      });

      await expect(adminService.getAuthenticatedAdmin('token')).rejects.toMatchObject({
        statusCode: 401,
        code: 'UNAUTHORIZED'
      });
    });
  });

  describe('listCategories', () => {
    it('returns the category tree for admin management', async () => {
      productsRepository.listAllCategories.mockResolvedValue([
        buildCategory(),
        buildCategory({
          id: 1005,
          name: 'Filters',
          slug: 'filters',
          parentId: 1001
        })
      ]);

      const result = await adminService.listCategories({
        query: {}
      });

      expect(productsRepository.listAllCategories).toHaveBeenCalledWith({
        status: 'all'
      });
      expect(result.categories).toHaveLength(1);
      expect(result.categories[0].children[0]).toMatchObject({
        id: 1005,
        parentId: 1001
      });
      expect(result.filters.status).toBe('all');
    });
  });

  describe('getCategory', () => {
    it('returns a category with parent and child details', async () => {
      productsRepository.findCategoryById.mockResolvedValue(buildCategory());
      productsRepository.listAllCategories.mockResolvedValue([
        buildCategory(),
        buildCategory({
          id: 1005,
          name: 'Filters',
          slug: 'filters',
          parentId: 1001
        })
      ]);

      const result = await adminService.getCategory({
        categoryId: 1001
      });

      expect(productsRepository.findCategoryById).toHaveBeenCalledWith(1001);
      expect(result.children).toHaveLength(1);
      expect(result.parent).toBe(null);
    });
  });

  describe('createCategory', () => {
    it('creates a category and generates a slug when omitted', async () => {
      productsRepository.findCategoryBySlug.mockResolvedValue(null);
      productsRepository.createCategory.mockResolvedValue(buildCategory({
        id: 1010,
        name: 'Cooling System',
        slug: 'cooling-system'
      }));
      productsRepository.listAllCategories.mockResolvedValue([
        buildCategory(),
        buildCategory({
          id: 1010,
          name: 'Cooling System',
          slug: 'cooling-system'
        })
      ]);

      const result = await adminService.createCategory({
        name: 'Cooling System'
      });

      expect(productsRepository.createCategory).toHaveBeenCalledWith({
        name: 'Cooling System',
        slug: 'cooling-system',
        parentId: null,
        status: 'active'
      });
      expect(result.slug).toBe('cooling-system');
    });
  });

  describe('updateCategory', () => {
    it('updates a category and keeps the current slug when only the name changes', async () => {
      productsRepository.findCategoryById.mockResolvedValue(buildCategory());
      productsRepository.listAllCategories.mockResolvedValue([buildCategory()]);
      productsRepository.findCategoryBySlug.mockResolvedValue(buildCategory());
      productsRepository.updateCategory.mockResolvedValue(buildCategory({
        name: 'Engine Parts'
      }));

      const result = await adminService.updateCategory({
        categoryId: 1001,
        name: 'Engine Parts'
      });

      expect(productsRepository.updateCategory).toHaveBeenCalledWith(1001, {
        name: 'Engine Parts',
        slug: undefined,
        parentId: undefined
      });
      expect(result.name).toBe('Engine Parts');
      expect(result.slug).toBe('engine-components');
    });
  });

  describe('deleteCategory', () => {
    it('archives a category subtree instead of permanently deleting it', async () => {
      productsRepository.findCategoryById.mockResolvedValue(buildCategory());
      productsRepository.listAllCategories
        .mockResolvedValueOnce([
          buildCategory(),
          buildCategory({
            id: 1005,
            name: 'Filters',
            slug: 'filters',
            parentId: 1001
          })
        ])
        .mockResolvedValueOnce([
          buildCategory({
            status: 'archived'
          }),
          buildCategory({
            id: 1005,
            name: 'Filters',
            slug: 'filters',
            parentId: 1001,
            status: 'archived'
          })
        ]);

      const result = await adminService.deleteCategory({
        categoryId: 1001
      });

      expect(productsRepository.updateCategoriesStatus).toHaveBeenCalledWith(
        [1001, 1005],
        'archived'
      );
      expect(result.status).toBe('archived');
      expect(result.children[0].status).toBe('archived');
    });
  });

  describe('listVehicleTaxonomy', () => {
    it('returns paginated vehicle taxonomy entries', async () => {
      productsRepository.listVehicleTaxonomy.mockResolvedValue({
        entries: [buildVehicleTaxonomyEntry()],
        total: 1
      });

      const result = await adminService.listVehicleTaxonomy({
        query: {
          make: 'Toyota',
          page: 1,
          limit: 10
        }
      });

      expect(productsRepository.listVehicleTaxonomy).toHaveBeenCalledWith({
        make: 'Toyota',
        model: null,
        limit: 10,
        offset: 0
      });
      expect(result.entries).toHaveLength(1);
      expect(result.filters.make).toBe('Toyota');
    });
  });

  describe('getVehicleTaxonomyEntry', () => {
    it('returns a vehicle taxonomy entry by id', async () => {
      productsRepository.findVehicleTaxonomyById.mockResolvedValue(buildVehicleTaxonomyEntry());

      const result = await adminService.getVehicleTaxonomyEntry({
        vehicleTaxonomyId: 3001
      });

      expect(productsRepository.findVehicleTaxonomyById).toHaveBeenCalledWith(3001);
      expect(result.model).toBe('Camry');
    });
  });

  describe('createVehicleTaxonomyEntry', () => {
    it('creates a new vehicle taxonomy entry when it does not already exist', async () => {
      productsRepository.findVehicleTaxonomyEntry.mockResolvedValue(null);
      productsRepository.createVehicleTaxonomy.mockResolvedValue(buildVehicleTaxonomyEntry({
        id: 3010,
        make: 'Mazda',
        model: 'CX-5',
        yearFrom: 2018,
        yearTo: 2021
      }));

      const result = await adminService.createVehicleTaxonomyEntry({
        make: 'Mazda',
        model: 'CX-5',
        yearFrom: 2018,
        yearTo: 2021
      });

      expect(productsRepository.createVehicleTaxonomy).toHaveBeenCalledWith({
        make: 'Mazda',
        model: 'CX-5',
        yearFrom: 2018,
        yearTo: 2021
      });
      expect(result.id).toBe(3010);
    });
  });

  describe('updateVehicleTaxonomyEntry', () => {
    it('blocks edits that would detach existing compatibility records from the taxonomy', async () => {
      productsRepository.findVehicleTaxonomyById.mockResolvedValue(buildVehicleTaxonomyEntry());
      productsRepository.countProductCompatibilityReferences.mockResolvedValue(1);

      await expect(adminService.updateVehicleTaxonomyEntry({
        vehicleTaxonomyId: 3001,
        model: 'Camry Hybrid'
      })).rejects.toMatchObject({
        statusCode: 409,
        code: 'CONFLICT'
      });
    });
  });

  describe('deleteVehicleTaxonomyEntry', () => {
    it('rejects deletion when product compatibility records still reference the entry', async () => {
      productsRepository.findVehicleTaxonomyById.mockResolvedValue(buildVehicleTaxonomyEntry());
      productsRepository.countProductCompatibilityReferences.mockResolvedValue(1);

      await expect(adminService.deleteVehicleTaxonomyEntry({
        vehicleTaxonomyId: 3001
      })).rejects.toMatchObject({
        statusCode: 409,
        code: 'CONFLICT'
      });
    });
  });

  describe('listSellerVerificationQueue', () => {
    it('returns paginated seller verification queue results', async () => {
      adminRepository.listSellerVerificationQueue.mockResolvedValue({
        sellers: [
          {
            user: {
              id: 11,
              role: 'seller',
              fullName: 'Uche Okafor',
              email: 'uche@example.com',
              phone: '+2348012345678',
              isVerified: false,
              createdAt: '2026-07-07T09:00:00.000Z',
              updatedAt: '2026-07-07T09:00:00.000Z'
            },
            sellerProfile: {
              id: 101,
              userId: 11,
              businessName: 'Prime Auto Hub',
              rating: 0,
              contactPhone: '+2348012345678',
              contactEmail: 'sales@primeautohub.ng',
              address: '12 Sapara Williams Close, Victoria Island, Lagos',
              cacNumber: 'RC-123456',
              verificationStatus: 'pending',
              rejectionReason: null,
              documents: [
                {
                  id: 1,
                  type: 'cac',
                  filePath: 'uploads/seller-documents/cac.pdf',
                  uploadedAt: '2026-07-07T09:05:00.000Z',
                  createdAt: '2026-07-07T09:05:00.000Z',
                  updatedAt: '2026-07-07T09:05:00.000Z'
                }
              ],
              createdAt: '2026-07-07T09:00:00.000Z',
              updatedAt: '2026-07-07T09:05:00.000Z'
            }
          }
        ],
        total: 1
      });

      const result = await adminService.listSellerVerificationQueue({
        query: {
          status: 'pending',
          page: 1,
          limit: 10
        }
      });

      expect(adminRepository.listSellerVerificationQueue).toHaveBeenCalledWith({
        status: 'pending',
        limit: 10,
        offset: 0
      });
      expect(result.pagination.total).toBe(1);
      expect(result.filters.status).toBe('pending');
      expect(result.sellers[0].sellerProfile.verificationStatus).toBe('pending');
    });
  });

  describe('getSellerVerificationCandidate', () => {
    it('returns a seller profile with stored CAC verification data', async () => {
      adminRepository.findSellerAccountBySellerId.mockResolvedValue({
        user: {
          id: 11,
          role: 'seller',
          fullName: 'Uche Okafor',
          email: 'uche@example.com',
          phone: '+2348012345678',
          isVerified: false,
          createdAt: '2026-07-07T09:00:00.000Z',
          updatedAt: '2026-07-07T09:00:00.000Z'
        },
        sellerProfile: {
          id: 101,
          userId: 11,
          businessName: 'Prime Auto Hub',
          rating: 0,
          contactPhone: '+2348012345678',
          contactEmail: 'sales@primeautohub.ng',
          address: '12 Sapara Williams Close, Victoria Island, Lagos',
          cacNumber: 'RC-123456',
          verificationStatus: 'pending',
          rejectionReason: null,
          cacVerification: {
            checkedAt: '2026-07-09T09:30:00.000Z',
            response: {
              provider: 'dojah'
            },
            status: 'completed'
          },
          documents: [
            { id: 1, type: 'cac' },
            { id: 2, type: 'proof_of_address' }
          ],
          createdAt: '2026-07-07T09:00:00.000Z',
          updatedAt: '2026-07-07T09:05:00.000Z'
        }
      });

      const result = await adminService.getSellerVerificationCandidate({
        sellerId: 101
      });

      expect(adminRepository.findSellerAccountBySellerId).toHaveBeenCalledWith(101);
      expect(result.sellerProfile.cacVerification.status).toBe('completed');
      expect(result.sellerProfile.documents).toHaveLength(2);
    });
  });

  describe('updateSellerVerificationStatus', () => {
    it('verifies a seller with the required review documents', async () => {
      adminRepository.findSellerAccountBySellerId.mockResolvedValue({
        user: {
          id: 11,
          role: 'seller',
          fullName: 'Uche Okafor',
          email: 'uche@example.com',
          phone: '+2348012345678',
          isVerified: false,
          createdAt: '2026-07-07T09:00:00.000Z',
          updatedAt: '2026-07-07T09:00:00.000Z'
        },
        sellerProfile: {
          id: 101,
          userId: 11,
          businessName: 'Prime Auto Hub',
          rating: 0,
          contactPhone: '+2348012345678',
          contactEmail: 'sales@primeautohub.ng',
          address: '12 Sapara Williams Close, Victoria Island, Lagos',
          cacNumber: 'RC-123456',
          verificationStatus: 'pending',
          rejectionReason: null,
          documents: [
            { id: 1, type: 'cac' },
            { id: 2, type: 'proof_of_address' }
          ],
          createdAt: '2026-07-07T09:00:00.000Z',
          updatedAt: '2026-07-07T09:05:00.000Z'
        }
      });
      adminRepository.updateSellerVerificationStatus.mockResolvedValue({
        user: {
          id: 11,
          role: 'seller',
          fullName: 'Uche Okafor',
          email: 'uche@example.com',
          phone: '+2348012345678',
          isVerified: false,
          createdAt: '2026-07-07T09:00:00.000Z',
          updatedAt: '2026-07-07T09:00:00.000Z'
        },
        sellerProfile: {
          id: 101,
          userId: 11,
          businessName: 'Prime Auto Hub',
          rating: 0,
          contactPhone: '+2348012345678',
          contactEmail: 'sales@primeautohub.ng',
          address: '12 Sapara Williams Close, Victoria Island, Lagos',
          cacNumber: 'RC-123456',
          verificationStatus: 'verified',
          rejectionReason: null,
          documents: [
            { id: 1, type: 'cac' },
            { id: 2, type: 'proof_of_address' }
          ],
          createdAt: '2026-07-07T09:00:00.000Z',
          updatedAt: '2026-07-07T09:10:00.000Z'
        }
      });

      const result = await adminService.updateSellerVerificationStatus({
        adminId: 5,
        sellerId: 101,
        verificationStatus: 'verified'
      });

      expect(adminRepository.updateSellerVerificationStatus).toHaveBeenCalledWith({
        adminId: 5,
        sellerId: 101,
        status: 'verified',
        rejectionReason: null
      });
      expect(auditLogRepository.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        adminId: 5,
        action: 'seller_verification.verified',
        targetType: 'seller',
        targetId: 101
      }));
      expect(result.sellerProfile.verificationStatus).toBe('verified');
    });

    it('rejects review attempts when required documents are missing', async () => {
      adminRepository.findSellerAccountBySellerId.mockResolvedValue({
        user: {
          id: 11,
          role: 'seller',
          fullName: 'Uche Okafor',
          email: 'uche@example.com',
          phone: '+2348012345678',
          isVerified: false,
          createdAt: '2026-07-07T09:00:00.000Z',
          updatedAt: '2026-07-07T09:00:00.000Z'
        },
        sellerProfile: {
          id: 101,
          userId: 11,
          businessName: 'Prime Auto Hub',
          rating: 0,
          contactPhone: '+2348012345678',
          contactEmail: 'sales@primeautohub.ng',
          address: '12 Sapara Williams Close, Victoria Island, Lagos',
          cacNumber: 'RC-123456',
          verificationStatus: 'pending',
          rejectionReason: null,
          documents: [
            { id: 1, type: 'cac' }
          ],
          createdAt: '2026-07-07T09:00:00.000Z',
          updatedAt: '2026-07-07T09:05:00.000Z'
        }
      });

      await expect(adminService.updateSellerVerificationStatus({
        sellerId: 101,
        verificationStatus: 'verified'
      })).rejects.toMatchObject({
        statusCode: 409,
        code: 'CONFLICT'
      });
    });
  });

  describe('listUsers', () => {
    it('returns paginated buyer and seller users with seller summaries when available', async () => {
      usersRepository.listManagedUsers.mockResolvedValue({
        users: [
          buildManagedUser(),
          buildManagedUser({
            id: 22,
            role: 'buyer',
            fullName: 'Bola Adeniran',
            email: 'bola@example.com',
            accountStatus: 'active'
          })
        ],
        total: 2
      });
      sellersRepository.findByUserId.mockResolvedValue(buildSellerAccount());

      const result = await adminService.listUsers({
        query: {
          role: 'all',
          status: 'all',
          search: 'example.com',
          page: 1,
          limit: 10
        }
      });

      expect(usersRepository.listManagedUsers).toHaveBeenCalledWith({
        role: 'all',
        status: 'all',
        search: 'example.com',
        limit: 10,
        offset: 0
      });
      expect(result.pagination.total).toBe(2);
      expect(result.users[0].sellerProfile.businessName).toBe('Prime Auto Hub');
      expect(result.users[1].sellerProfile).toBe(null);
    });
  });

  describe('updateUserStatus', () => {
    it('updates a managed user account status', async () => {
      usersRepository.findManagedUserById.mockResolvedValue(buildManagedUser());
      usersRepository.updateAccountStatus.mockResolvedValue(buildManagedUser({
        accountStatus: 'suspended'
      }));
      sellersRepository.findByUserId.mockResolvedValue(buildSellerAccount());

      const result = await adminService.updateUserStatus({
        adminId: 5,
        userId: 21,
        status: 'suspended'
      });

      expect(usersRepository.updateAccountStatus).toHaveBeenCalledWith(21, 'suspended');
      expect(auditLogRepository.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        adminId: 5,
        action: 'user_status.updated',
        targetType: 'user',
        targetId: 21
      }));
      expect(result.accountStatus).toBe('suspended');
      expect(result.sellerProfile.businessName).toBe('Prime Auto Hub');
    });
  });

  describe('listOrders', () => {
    it('returns paginated order oversight results', async () => {
      ordersRepository.listOrdersForAdmin.mockResolvedValue({
        orders: [buildAdminOrder()],
        total: 1
      });

      const result = await adminService.listOrders({
        query: {
          status: 'confirmed',
          paymentStatus: 'paid',
          search: 'bola@example.com',
          page: 1,
          limit: 10
        }
      });

      expect(ordersRepository.listOrdersForAdmin).toHaveBeenCalledWith({
        status: 'confirmed',
        paymentStatus: 'paid',
        search: 'bola@example.com',
        limit: 10,
        offset: 0
      });
      expect(result.pagination.total).toBe(1);
      expect(result.orders[0].buyer.email).toBe('bola@example.com');
      expect(result.orders[0].sellerCount).toBe(1);
    });
  });

  describe('getPlatformConfig', () => {
    it('returns the normalized platform configuration payload', async () => {
      platformConfigRepository.listPlatformConfigByKeys.mockResolvedValue([
        {
          key: 'commission_rate_default',
          value: 12
        },
        {
          key: 'commission_rates_by_category',
          value: [
            {
              categoryId: 1001,
              ratePercent: 15
            }
          ]
        },
        {
          key: 'commission_rates_by_seller_tier',
          value: [
            {
              tier: 'gold',
              ratePercent: 8
            }
          ]
        },
        {
          key: 'platform_settings',
          value: {
            payoutBatchCutoffHour: 17
          }
        }
      ]);

      const result = await adminService.getPlatformConfig();

      expect(platformConfigRepository.listPlatformConfigByKeys).toHaveBeenCalledWith();
      expect(result).toEqual({
        commissionRateDefault: 12,
        commissionRatesByCategory: [
          {
            categoryId: 1001,
            ratePercent: 15
          }
        ],
        commissionRatesBySellerTier: [
          {
            tier: 'gold',
            ratePercent: 8
          }
        ],
        platformSettings: {
          payoutBatchCutoffHour: 17
        }
      });
    });
  });

  describe('updatePlatformConfig', () => {
    it('persists platform config changes and writes an audit log entry', async () => {
      platformConfigRepository.listPlatformConfigByKeys.mockResolvedValue([
        {
          key: 'commission_rate_default',
          value: 10
        },
        {
          key: 'commission_rates_by_category',
          value: []
        },
        {
          key: 'commission_rates_by_seller_tier',
          value: []
        },
        {
          key: 'platform_settings',
          value: {}
        }
      ]);
      productsRepository.findCategoryById.mockResolvedValue(buildCategory({
        id: 1001
      }));
      platformConfigRepository.upsertPlatformConfigEntries.mockResolvedValue([
        {
          key: 'commission_rate_default',
          value: 12
        },
        {
          key: 'commission_rates_by_category',
          value: [
            {
              categoryId: 1001,
              ratePercent: 15
            }
          ]
        },
        {
          key: 'commission_rates_by_seller_tier',
          value: [
            {
              tier: 'gold',
              ratePercent: 8
            }
          ]
        },
        {
          key: 'platform_settings',
          value: {
            payoutBatchCutoffHour: 17
          }
        }
      ]);

      const result = await adminService.updatePlatformConfig({
        adminId: 5,
        commissionRateDefault: 12,
        commissionRatesByCategory: [
          {
            categoryId: 1001,
            ratePercent: 15
          }
        ],
        commissionRatesBySellerTier: [
          {
            tier: 'gold',
            ratePercent: 8
          }
        ],
        platformSettings: {
          payoutBatchCutoffHour: 17
        }
      });

      expect(productsRepository.findCategoryById).toHaveBeenCalledWith(1001);
      expect(platformConfigRepository.upsertPlatformConfigEntries).toHaveBeenCalled();
      expect(auditLogRepository.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        adminId: 5,
        action: 'platform_config.updated',
        targetType: 'platform_config'
      }));
      expect(result.commissionRateDefault).toBe(12);
      expect(result.commissionRatesByCategory[0]).toEqual({
        categoryId: 1001,
        ratePercent: 15
      });
    });
  });

  describe('listPayouts', () => {
    it('returns paginated payout review results', async () => {
      sellerFinanceRepository.listPayoutsForAdmin.mockResolvedValue({
        payouts: [buildAdminPayout()],
        total: 1
      });

      const result = await adminService.listPayouts({
        query: {
          status: 'requested',
          search: 'uche@example.com',
          sellerId: 101,
          page: 1,
          limit: 10
        }
      });

      expect(sellerFinanceRepository.listPayoutsForAdmin).toHaveBeenCalledWith({
        status: 'requested',
        search: 'uche@example.com',
        sellerId: 101,
        limit: 10,
        offset: 0
      });
      expect(result.pagination.total).toBe(1);
      expect(result.payouts[0].seller.businessName).toBe('Prime Auto Hub');
      expect(result.payouts[0].items).toHaveLength(1);
    });
  });

  describe('listDisputes', () => {
    it('returns paginated dispute review results', async () => {
      disputesRepository.listDisputesForAdmin.mockResolvedValue({
        disputes: [buildAdminDispute()],
        total: 1
      });

      const result = await adminService.listDisputes({
        query: {
          status: 'open',
          raisedBy: 'buyer',
          search: 'damaged',
          page: 1,
          limit: 10
        }
      });

      expect(disputesRepository.listDisputesForAdmin).toHaveBeenCalledWith({
        status: 'open',
        raisedBy: 'buyer',
        search: 'damaged',
        limit: 10,
        offset: 0
      });
      expect(result.pagination.total).toBe(1);
      expect(result.disputes[0].order.paymentReference).toBe('APT-5001-REF');
      expect(result.disputes[0].buyer.email).toBe('bola@example.com');
    });
  });

  describe('listAuditLogs', () => {
    it('returns paginated audit log results', async () => {
      auditLogRepository.listAuditLogs.mockResolvedValue({
        logs: [buildAuditLogEntry()],
        total: 1
      });

      const result = await adminService.listAuditLogs({
        query: {
          adminId: 5,
          action: 'payout.approved',
          targetType: 'payout',
          targetId: 901,
          page: 1,
          limit: 10
        }
      });

      expect(auditLogRepository.listAuditLogs).toHaveBeenCalledWith({
        adminId: 5,
        action: 'payout.approved',
        targetType: 'payout',
        targetId: 901,
        limit: 10,
        offset: 0
      });
      expect(result.pagination.total).toBe(1);
      expect(result.auditLogs[0].admin.email).toBe('superadmin@example.com');
      expect(result.auditLogs[0].detail.nextStatus).toBe('approved');
    });
  });

  describe('updatePayoutStatus', () => {
    it('approves a requested payout and writes an audit log entry', async () => {
      sellerFinanceRepository.findPayoutByIdForAdmin.mockResolvedValue(buildAdminPayout());
      sellerFinanceRepository.updatePayoutStatusForAdmin.mockResolvedValue(buildAdminPayout({
        status: 'approved',
        approvedBy: 5,
        approvedAt: '2026-07-07T11:00:00.000Z',
        updatedAt: '2026-07-07T11:00:00.000Z'
      }));

      const result = await adminService.updatePayoutStatus({
        adminId: 5,
        payoutId: 901,
        status: 'approved'
      });

      expect(sellerFinanceRepository.updatePayoutStatusForAdmin).toHaveBeenCalledWith({
        adminId: 5,
        payoutId: 901,
        status: 'approved',
        rejectionReason: null
      });
      expect(auditLogRepository.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        adminId: 5,
        action: 'payout.approved',
        targetType: 'payout',
        targetId: 901
      }));
      expect(result.status).toBe('approved');
      expect(result.approvedBy).toBe(5);
    });

    it('rejects invalid payout state transitions', async () => {
      sellerFinanceRepository.findPayoutByIdForAdmin.mockResolvedValue(buildAdminPayout({
        status: 'requested'
      }));

      await expect(adminService.updatePayoutStatus({
        adminId: 5,
        payoutId: 901,
        status: 'paid'
      })).rejects.toMatchObject({
        statusCode: 409,
        code: 'CONFLICT'
      });
    });
  });

  describe('updateOrderStatus', () => {
    it('updates a paid order status and returns the new status history', async () => {
      ordersRepository.findOrderByIdForAdmin.mockResolvedValue(buildAdminOrder());
      ordersRepository.updateOrderStatusForAdmin.mockResolvedValue(buildAdminOrder({
        status: 'picked_up',
        updatedAt: '2026-07-07T10:00:00.000Z'
      }));
      ordersRepository.findOrderStatusHistoryByOrderIdForAdmin.mockResolvedValue([
        buildOrderStatusHistoryEntry(),
        buildOrderStatusHistoryEntry({
          id: 2,
          status: 'picked_up',
          note: 'Admin updated order status from confirmed to picked_up.',
          createdAt: '2026-07-07T10:00:00.000Z',
          updatedAt: '2026-07-07T10:00:00.000Z'
        })
      ]);

      const result = await adminService.updateOrderStatus({
        adminId: 5,
        orderId: 5001,
        status: 'picked_up'
      });

      expect(ordersRepository.updateOrderStatusForAdmin).toHaveBeenCalledWith({
        orderId: 5001,
        status: 'picked_up',
        note: 'Admin updated order status from confirmed to picked_up.'
      });
      expect(auditLogRepository.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        adminId: 5,
        action: 'order_status.updated',
        targetType: 'order',
        targetId: 5001
      }));
      expect(result.status).toBe('picked_up');
      expect(result.statusHistory).toHaveLength(2);
    });

    it('rejects fulfilment updates for unpaid orders', async () => {
      ordersRepository.findOrderByIdForAdmin.mockResolvedValue(buildAdminOrder({
        paymentStatus: 'pending'
      }));

      await expect(adminService.updateOrderStatus({
        orderId: 5001,
        status: 'picked_up'
      })).rejects.toMatchObject({
        statusCode: 409,
        code: 'CONFLICT'
      });
    });
  });

  describe('updateDispute', () => {
    it('resolves an open dispute and records the refund metadata in the audit log', async () => {
      disputesRepository.findDisputeByIdForAdmin.mockResolvedValue(buildAdminDispute());
      disputesRepository.updateDisputeDecision.mockResolvedValue(buildAdminDispute({
        status: 'resolved',
        resolutionNote: 'Refund approved after confirming the damaged item.',
        refundReference: 'RFD-5001',
        refundAmountKobo: 1500000,
        resolvedBy: 5,
        resolvedAt: '2026-07-09T13:00:00.000Z',
        updatedAt: '2026-07-09T13:00:00.000Z',
        resolvedByAdmin: {
          id: 5,
          fullName: 'Super Admin',
          email: 'superadmin@example.com'
        }
      }));

      const result = await adminService.updateDispute({
        adminId: 5,
        disputeId: 301,
        status: 'resolved',
        resolutionNote: '  Refund approved after confirming the damaged item.  ',
        refundReference: 'RFD-5001',
        refundAmountKobo: 1500000
      });

      expect(disputesRepository.updateDisputeDecision).toHaveBeenCalledWith({
        adminId: 5,
        disputeId: 301,
        status: 'resolved',
        resolutionNote: 'Refund approved after confirming the damaged item.',
        refundReference: 'RFD-5001',
        refundAmountKobo: 1500000
      });
      expect(auditLogRepository.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        adminId: 5,
        action: 'dispute.resolved',
        targetType: 'dispute',
        targetId: 301
      }));
      expect(result.status).toBe('resolved');
      expect(result.refundReference).toBe('RFD-5001');
    });

    it('rejects refund amounts that exceed the order total', async () => {
      disputesRepository.findDisputeByIdForAdmin.mockResolvedValue(buildAdminDispute());

      await expect(adminService.updateDispute({
        adminId: 5,
        disputeId: 301,
        status: 'resolved',
        resolutionNote: 'Refund approved after confirming the damaged item.',
        refundReference: 'RFD-5001',
        refundAmountKobo: 4000000
      })).rejects.toMatchObject({
        statusCode: 422,
        code: 'VALIDATION_ERROR'
      });
    });
  });
});
