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

function buildBlogCategory(overrides = {}) {
  return {
    id: 7101,
    name: 'Maintenance Guides',
    slug: 'maintenance-guides',
    description: 'Hands-on service tips for common workshop jobs.',
    status: 'active',
    createdAt: '2026-07-15T09:00:00.000Z',
    updatedAt: '2026-07-15T09:00:00.000Z',
    ...overrides
  };
}

function buildBlogTag(overrides = {}) {
  return {
    id: 7201,
    name: 'Brake Care',
    slug: 'brake-care',
    status: 'active',
    createdAt: '2026-07-15T09:00:00.000Z',
    updatedAt: '2026-07-15T09:00:00.000Z',
    ...overrides
  };
}

function buildBlogPost(overrides = {}) {
  const category = buildBlogCategory();

  return {
    id: 7301,
    categoryId: category.id,
    category,
    title: 'How to Know When Brake Pads Need Immediate Replacement',
    slug: 'how-to-know-when-brake-pads-need-immediate-replacement',
    excerpt: 'A quick workshop checklist for spotting worn brake pads early.',
    body: '<p>Brake pads usually warn drivers long before complete failure.</p>',
    featuredImageUrl: 'https://images.example.com/blog/brake-pads-inspection.jpg',
    featuredImageAlt: 'Mechanic inspecting worn brake pads on a sedan',
    authorDisplayName: 'Aisha Bello',
    authorAvatarUrl: 'https://images.example.com/authors/aisha-bello.jpg',
    readTimeMinutes: 3,
    status: 'draft',
    publishedAt: null,
    viewCount: 12,
    createdAt: '2026-07-15T10:00:00.000Z',
    updatedAt: '2026-07-15T10:00:00.000Z',
    ...overrides
  };
}

function buildBlogPostTag(overrides = {}) {
  const tag = buildBlogTag();

  return {
    id: 1,
    postId: 7301,
    tagId: tag.id,
    createdAt: '2026-07-15T10:05:00.000Z',
    updatedAt: '2026-07-15T10:05:00.000Z',
    tag,
    ...overrides
  };
}

function buildBlogComment(overrides = {}) {
  return {
    id: 7401,
    postId: 7301,
    parentId: null,
    authorName: 'Chinedu',
    authorEmail: 'chinedu@example.com',
    body: 'This was helpful for my Camry service.',
    status: 'pending',
    ipAddress: '127.0.0.1',
    approvedAt: null,
    createdAt: '2026-07-15T11:00:00.000Z',
    updatedAt: '2026-07-15T11:00:00.000Z',
    ...overrides
  };
}

function buildNewsletterSubscriber(overrides = {}) {
  return {
    id: 7501,
    email: 'reader@example.com',
    unsubscribeToken: 'token-123',
    status: 'subscribed',
    ipAddress: '127.0.0.1',
    subscribedAt: '2026-07-16T08:00:00.000Z',
    unsubscribedAt: null,
    createdAt: '2026-07-16T08:00:00.000Z',
    updatedAt: '2026-07-16T08:00:00.000Z',
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

function buildLogisticsCompany(overrides = {}) {
  return {
    id: 41,
    name: 'Swift Dispatch',
    email: 'ops@swiftdispatch.ng',
    phone: '+2348012345678',
    address: '12 Sapara Williams Close, Victoria Island, Lagos',
    status: 'pending',
    approvedBy: null,
    createdAt: '2026-07-12T09:00:00.000Z',
    updatedAt: '2026-07-12T09:00:00.000Z',
    ...overrides
  };
}

function buildRider(overrides = {}) {
  const company = buildLogisticsCompany({
    id: 41,
    status: 'approved',
    approvedBy: 1
  });

  return {
    id: 12,
    companyId: company.id,
    zoneId: 7,
    fullName: 'Alex Rider',
    phone: '+2348012345679',
    email: 'alex@swiftdispatch.ng',
    vehicleType: 'bike',
    status: 'available',
    createdAt: '2026-07-12T09:30:00.000Z',
    updatedAt: '2026-07-12T09:30:00.000Z',
    zone: {
      id: 7,
      name: 'Ikeja Central',
      state: 'Lagos',
      city: 'Ikeja',
      createdAt: '2026-07-12T08:00:00.000Z',
      updatedAt: '2026-07-12T08:00:00.000Z'
    },
    company,
    ...overrides
  };
}

function buildDeliveryJob(overrides = {}) {
  return {
    id: 81,
    orderId: 5001,
    orderItemId: 501,
    sellerId: 101,
    zoneId: 7,
    companyId: null,
    riderId: null,
    status: 'pending',
    pickupAddress: '12 Sapara Williams Close, Victoria Island, Lagos',
    assignedAt: null,
    pickedUpAt: null,
    inTransitAt: null,
    deliveredAt: null,
    createdAt: '2026-07-12T10:00:00.000Z',
    updatedAt: '2026-07-12T10:00:00.000Z',
    zone: {
      id: 7,
      name: 'Ikeja Central',
      state: 'Lagos',
      city: 'Ikeja',
      createdAt: '2026-07-12T08:00:00.000Z',
      updatedAt: '2026-07-12T08:00:00.000Z'
    },
    order: {
      id: 5001,
      status: 'confirmed',
      paymentMethod: 'paystack',
      paymentReference: 'APT-5001-REF',
      paymentStatus: 'paid',
      totalKobo: 3700000,
      deliveryAddress: {
        id: 31,
        label: 'Workshop',
        street: '12 Adeola Odeku Street',
        city: 'Ikeja',
        state: 'Lagos',
        phone: '+2348012345678'
      }
    },
    item: {
      id: 501,
      productId: 7001,
      title: 'Front Brake Pad Set',
      partNumber: 'FBP-CAM-07011',
      quantity: 1,
      lineTotalKobo: 3700000,
      itemStatus: 'ready_for_pickup'
    },
    buyer: {
      id: 11,
      fullName: 'Bola Adeniran',
      email: 'bola@example.com',
      phone: '+2348012345678'
    },
    seller: {
      id: 101,
      userId: 21,
      businessName: 'Prime Auto Hub',
      contactEmail: 'sales@primeautohub.ng',
      contactPhone: '+2348012345678',
      address: '12 Sapara Williams Close, Victoria Island, Lagos',
      fullName: 'Uche Okafor',
      email: 'uche@example.com',
      phone: '+2348012345678'
    },
    assignedCompany: null,
    assignedRider: null,
    ...overrides
  };
}

describe('admin service', () => {
  let adminRepository;
  let assignmentService;
  let auditLogRepository;
  let blogCategoriesRepository;
  let blogCommentsRepository;
  let blogPostTagsRepository;
  let blogPostsRepository;
  let blogTagsRepository;
  let deliveryJobsRepository;
  let disputesRepository;
  let logisticsRepository;
  let newsletterSubscribersRepository;
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
    blogCategoriesRepository = {
      createCategory: jest.fn(),
      findById: jest.fn(),
      findBySlug: jest.fn(),
      listCategories: jest.fn(),
      updateCategory: jest.fn()
    };
    blogCommentsRepository = {
      countComments: jest.fn(),
      findById: jest.fn(),
      listComments: jest.fn(),
      updateComment: jest.fn()
    };
    blogPostTagsRepository = {
      listTagsForPost: jest.fn(),
      replaceTagsForPost: jest.fn()
    };
    blogPostsRepository = {
      countPosts: jest.fn(),
      createPost: jest.fn(),
      findById: jest.fn(),
      findBySlug: jest.fn(),
      listPosts: jest.fn(),
      updatePost: jest.fn()
    };
    blogTagsRepository = {
      createTag: jest.fn(),
      findById: jest.fn(),
      findBySlug: jest.fn(),
      listTags: jest.fn(),
      updateTag: jest.fn()
    };
    assignmentService = {
      assignJobToRider: jest.fn()
    };
    deliveryJobsRepository = {
      findJobById: jest.fn(),
      findStatusHistoryByJobId: jest.fn(),
      listJobs: jest.fn(),
      summarizeJobs: jest.fn()
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
    logisticsRepository = {
      findCompanyById: jest.fn(),
      findRiderById: jest.fn(),
      listCompanies: jest.fn(),
      listRiders: jest.fn(),
      summarizeCompanies: jest.fn(),
      summarizeRiders: jest.fn(),
      updateCompanyStatus: jest.fn()
    };
    newsletterSubscribersRepository = {
      countSubscribers: jest.fn(),
      listSubscribers: jest.fn()
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
      assignmentService,
      auditLogRepository,
      blogCategoriesRepository,
      blogCommentsRepository,
      blogPostTagsRepository,
      blogPostsRepository,
      blogTagsRepository,
      deliveryJobsRepository,
      disputesRepository,
      env: {
        PLATFORM_COMMISSION_RATE_PERCENT: 10
      },
      logisticsRepository,
      newsletterSubscribersRepository,
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

  describe('createBlogCategory', () => {
    it('creates a blog category with a generated slug and audit log entry', async () => {
      blogCategoriesRepository.findBySlug.mockResolvedValue(null);
      blogCategoriesRepository.createCategory.mockResolvedValue(buildBlogCategory({
        id: 7102,
        name: 'Diagnostics',
        slug: 'diagnostics'
      }));

      const result = await adminService.createBlogCategory({
        adminId: 5,
        name: 'Diagnostics'
      });

      expect(blogCategoriesRepository.createCategory).toHaveBeenCalledWith({
        name: 'Diagnostics',
        slug: 'diagnostics',
        description: null,
        status: 'active'
      });
      expect(auditLogRepository.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        adminId: 5,
        action: 'blog_category.created',
        targetType: 'blog_category',
        targetId: 7102
      }));
      expect(result.slug).toBe('diagnostics');
    });
  });

  describe('createBlogPost', () => {
    it('sanitizes HTML, derives the excerpt, computes read time, and assigns tags', async () => {
      const createdPost = buildBlogPost({
        id: 7305,
        categoryId: 7101,
        category: buildBlogCategory(),
        slug: 'fuel-filter-warning-signs',
        excerpt: 'A clogged fuel filter can cause hesitation, weak acceleration, and hard starts.',
        body: '<p>A clogged fuel filter can cause hesitation.</p><p>Replace it early to protect injectors.</p>',
        readTimeMinutes: 1
      });

      blogCategoriesRepository.findById.mockResolvedValue(buildBlogCategory());
      blogPostsRepository.findBySlug.mockResolvedValue(null);
      blogTagsRepository.findById.mockResolvedValue(buildBlogTag());
      blogPostsRepository.createPost.mockResolvedValue(createdPost);
      blogPostTagsRepository.replaceTagsForPost.mockResolvedValue([
        buildBlogPostTag({
          postId: 7305,
          tag: buildBlogTag()
        })
      ]);
      blogPostsRepository.findById.mockResolvedValue(createdPost);
      blogPostTagsRepository.listTagsForPost.mockResolvedValue([
        buildBlogPostTag({
          postId: 7305,
          tag: buildBlogTag()
        })
      ]);
      blogCommentsRepository.countComments.mockResolvedValue(0);

      const result = await adminService.createBlogPost({
        adminId: 5,
        categoryId: 7101,
        title: 'Fuel Filter Warning Signs',
        body: '<p>A clogged fuel filter can cause hesitation.</p><script>alert(1)</script><p>Replace it early to protect injectors.</p>',
        authorDisplayName: 'Aisha Bello',
        tagIds: [7201]
      });

      expect(blogPostsRepository.createPost).toHaveBeenCalledWith(expect.objectContaining({
        categoryId: 7101,
        slug: 'fuel-filter-warning-signs',
        body: '<p>A clogged fuel filter can cause hesitation.</p><p>Replace it early to protect injectors.</p>',
        excerpt: expect.stringContaining('A clogged fuel filter can cause hesitation'),
        readTimeMinutes: 1,
        status: 'draft'
      }));
      expect(blogPostTagsRepository.replaceTagsForPost).toHaveBeenCalledWith(7305, [7201]);
      expect(result.tags).toHaveLength(1);
      expect(result.body).not.toContain('<script>');
    });
  });

  describe('updateBlogPost', () => {
    it('rejects slug changes for published posts unless explicitly overridden', async () => {
      blogPostsRepository.findById.mockResolvedValue(buildBlogPost({
        status: 'published',
        publishedAt: '2026-07-20T09:00:00.000Z'
      }));

      await expect(adminService.updateBlogPost({
        adminId: 5,
        postId: 7301,
        slug: 'new-live-url'
      })).rejects.toMatchObject({
        statusCode: 409,
        code: 'CONFLICT'
      });
    });
  });

  describe('updateBlogComment', () => {
    it('approves a pending blog comment and stamps approvedAt', async () => {
      blogCommentsRepository.findById.mockResolvedValue(buildBlogComment());
      blogCommentsRepository.updateComment.mockResolvedValue(buildBlogComment({
        status: 'approved',
        approvedAt: '2026-08-20T10:00:00.000Z'
      }));

      const result = await adminService.updateBlogComment({
        adminId: 5,
        commentId: 7401,
        status: 'approved'
      });

      expect(blogCommentsRepository.updateComment).toHaveBeenCalledWith(7401, expect.objectContaining({
        status: 'approved',
        approvedAt: expect.any(String)
      }));
      expect(result.status).toBe('approved');
      expect(auditLogRepository.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'blog_comment.updated',
        targetType: 'blog_comment',
        targetId: 7401
      }));
    });
  });

  describe('exportNewsletterSubscribersCsv', () => {
    it('exports filtered newsletter subscribers as CSV and records the export', async () => {
      newsletterSubscribersRepository.listSubscribers.mockResolvedValue([
        buildNewsletterSubscriber(),
        buildNewsletterSubscriber({
          id: 7502,
          email: 'former-reader@example.com',
          status: 'unsubscribed',
          unsubscribedAt: '2026-08-01T08:00:00.000Z'
        })
      ]);

      const result = await adminService.exportNewsletterSubscribersCsv({
        adminId: 5,
        query: {
          status: 'all',
          search: 'reader'
        }
      });

      expect(result.filename).toMatch(/^newsletter-subscribers-\d{4}-\d{2}-\d{2}\.csv$/);
      expect(result.csv).toContain('Email,Status,Subscribed At,Unsubscribed At,Created At');
      expect(result.csv).toContain('reader@example.com');
      expect(result.csv).toContain('former-reader@example.com');
      expect(auditLogRepository.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        adminId: 5,
        action: 'newsletter_subscribers.exported'
      }));
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
        payeeType: 'all',
        status: 'requested',
        search: 'uche@example.com',
        companyId: null,
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

  describe('listDeliveryJobs', () => {
    it('returns paginated admin delivery jobs', async () => {
      deliveryJobsRepository.summarizeJobs.mockResolvedValue({
        totalJobsCount: 3,
        unassignedJobsCount: 1,
        pendingCount: 1,
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
      deliveryJobsRepository.listJobs.mockResolvedValue({
        jobs: [
          buildDeliveryJob({
            status: 'pending'
          })
        ],
        total: 1
      });

      const result = await adminService.listDeliveryJobs({
        query: {
          status: 'pending',
          companyId: 41,
          riderId: 12,
          page: 1,
          limit: 10
        }
      });

      expect(deliveryJobsRepository.listJobs).toHaveBeenCalledWith({
        companyId: 41,
        riderId: 12,
        status: 'pending',
        search: null,
        limit: 10,
        offset: 0
      });
      expect(deliveryJobsRepository.summarizeJobs).toHaveBeenCalledWith({
        companyId: 41,
        riderId: 12,
        search: null
      });
      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].status).toBe('pending');
      expect(result.pagination.total).toBe(1);
      expect(result.filters.companyId).toBe(41);
      expect(result.filters.riderId).toBe(12);
      expect(result.summary.jobsByStatus).toEqual({
        total: 3,
        pending: 1,
        assigned: 1,
        picked_up: 0,
        in_transit: 0,
        delivered: 1,
        failed: 0,
        cancelled: 0
      });
      expect(result.summary.deliveryMetrics).toEqual({
        totalJobsCount: 3,
        unassignedJobsCount: 1,
        activeJobsCount: 1,
        deliveredJobsCount: 1,
        failedJobsCount: 0,
        completionRatePercent: 100,
        deliveryFeesKobo: 200000,
        platformMarginKobo: 20000,
        companyShareKobo: 180000,
        averageDeliveryFeeKobo: 200000
      });
    });
  });

  describe('listLogisticsCompanies', () => {
    it('returns paginated logistics companies with oversight summary counts', async () => {
      logisticsRepository.listCompanies.mockResolvedValue({
        companies: [
          buildLogisticsCompany(),
          buildLogisticsCompany({
            id: 42,
            name: 'Northern Haulage',
            status: 'approved',
            approvedBy: 5
          })
        ],
        total: 2
      });
      logisticsRepository.summarizeCompanies.mockResolvedValue({
        totalCompaniesCount: 2,
        pendingCount: 1,
        approvedCount: 1,
        suspendedCount: 0
      });

      const result = await adminService.listLogisticsCompanies({
        query: {
          status: 'pending',
          search: 'dispatch',
          page: 1,
          limit: 10
        }
      });

      expect(logisticsRepository.listCompanies).toHaveBeenCalledWith({
        status: 'pending',
        search: 'dispatch',
        limit: 10,
        offset: 0
      });
      expect(logisticsRepository.summarizeCompanies).toHaveBeenCalledWith({
        search: 'dispatch'
      });
      expect(result.companies).toHaveLength(2);
      expect(result.summary).toEqual({
        totalCompaniesCount: 2,
        pendingCount: 1,
        approvedCount: 1,
        suspendedCount: 0
      });
    });
  });

  describe('listLogisticsRiders', () => {
    it('returns paginated logistics riders with status summary counts', async () => {
      logisticsRepository.listRiders.mockResolvedValue({
        riders: [
          buildRider(),
          buildRider({
            id: 13,
            status: 'on_delivery',
            fullName: 'Musa Rider'
          })
        ],
        total: 2
      });
      logisticsRepository.summarizeRiders.mockResolvedValue({
        totalRidersCount: 2,
        availableCount: 1,
        onDeliveryCount: 1,
        unavailableCount: 0,
        inactiveCount: 0
      });

      const result = await adminService.listLogisticsRiders({
        query: {
          companyId: 41,
          status: 'available',
          search: 'swift',
          page: 1,
          limit: 10
        }
      });

      expect(logisticsRepository.listRiders).toHaveBeenCalledWith({
        companyId: 41,
        status: 'available',
        search: 'swift',
        limit: 10,
        offset: 0
      });
      expect(logisticsRepository.summarizeRiders).toHaveBeenCalledWith({
        companyId: 41,
        search: 'swift'
      });
      expect(result.riders).toHaveLength(2);
      expect(result.summary).toEqual({
        totalRidersCount: 2,
        availableCount: 1,
        onDeliveryCount: 1,
        unavailableCount: 0,
        inactiveCount: 0
      });
    });
  });

  describe('assignDeliveryJob', () => {
    it('assigns a pending delivery job and records the admin audit log', async () => {
      const rider = buildRider();
      const pendingJob = buildDeliveryJob();
      const assignedJob = buildDeliveryJob({
        status: 'assigned',
        companyId: rider.companyId,
        riderId: rider.id,
        assignedAt: '2026-07-13T10:00:00.000Z',
        assignedCompany: rider.company,
        assignedRider: {
          ...rider,
          status: 'on_delivery'
        }
      });

      deliveryJobsRepository.findJobById.mockResolvedValue(pendingJob);
      logisticsRepository.findRiderById.mockResolvedValue(rider);
      assignmentService.assignJobToRider.mockResolvedValue(assignedJob);
      deliveryJobsRepository.findStatusHistoryByJobId.mockResolvedValue([
        {
          id: 1,
          deliveryJobId: 81,
          status: 'pending',
          note: 'Seller marked the order item ready for pickup and the delivery job is awaiting assignment.',
          createdAt: '2026-07-12T10:00:00.000Z',
          updatedAt: '2026-07-12T10:00:00.000Z'
        },
        {
          id: 2,
          deliveryJobId: 81,
          status: 'assigned',
          note: 'Assigned by admin.',
          createdAt: '2026-07-13T10:00:00.000Z',
          updatedAt: '2026-07-13T10:00:00.000Z'
        }
      ]);

      const result = await adminService.assignDeliveryJob({
        adminId: 5,
        jobId: 81,
        riderId: 12,
        note: 'Assigned by admin.'
      });

      expect(assignmentService.assignJobToRider).toHaveBeenCalledWith({
        jobId: 81,
        riderId: 12,
        note: 'Assigned by admin.'
      });
      expect(auditLogRepository.createAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        adminId: 5,
        action: 'delivery_job.assigned',
        targetType: 'delivery_job',
        targetId: 81
      }));
      expect(result.status).toBe('assigned');
      expect(result.assignedRider.id).toBe(12);
      expect(result.statusHistory).toHaveLength(2);
    });
  });
});
