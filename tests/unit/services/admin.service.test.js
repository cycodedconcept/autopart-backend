require('../../setup/jest');

const { createAdminService } = require('../../../src/services/admin.service');

function buildCategory(overrides = {}) {
  return {
    id: 1001,
    name: 'Engine Components',
    slug: 'engine-components',
    parentId: null,
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

describe('admin service', () => {
  let adminRepository;
  let productsRepository;
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
    productsRepository = {
      countChildCategories: jest.fn(),
      countProductCompatibilityReferences: jest.fn(),
      countProductsByCategoryId: jest.fn(),
      createCategory: jest.fn(),
      createVehicleTaxonomy: jest.fn(),
      deleteCategory: jest.fn(),
      deleteVehicleTaxonomy: jest.fn(),
      findCategoryById: jest.fn(),
      findCategoryBySlug: jest.fn(),
      findVehicleTaxonomyById: jest.fn(),
      findVehicleTaxonomyEntry: jest.fn(),
      listAllCategories: jest.fn(),
      listVehicleTaxonomy: jest.fn(),
      updateCategory: jest.fn(),
      updateVehicleTaxonomy: jest.fn()
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
      productsRepository,
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

      const result = await adminService.listCategories();

      expect(productsRepository.listAllCategories).toHaveBeenCalled();
      expect(result.categories).toHaveLength(1);
      expect(result.categories[0].children[0]).toMatchObject({
        id: 1005,
        parentId: 1001
      });
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
        parentId: null
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
    it('rejects deletion when products are assigned to the category', async () => {
      productsRepository.findCategoryById.mockResolvedValue(buildCategory());
      productsRepository.countChildCategories.mockResolvedValue(0);
      productsRepository.countProductsByCategoryId.mockResolvedValue(2);
      productsRepository.listAllCategories.mockResolvedValue([buildCategory()]);

      await expect(adminService.deleteCategory({
        categoryId: 1001
      })).rejects.toMatchObject({
        statusCode: 409,
        code: 'CONFLICT'
      });
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
});
