require('../../setup/jest');

const { createSellersService } = require('../../../src/services/sellers.service');

describe('sellers service', () => {
  let usersRepository;
  let sellersRepository;
  let jwtUtils;
  let passwordUtils;
  let sellersService;

  beforeEach(() => {
    usersRepository = {
      findByEmail: jest.fn(),
      findByPhone: jest.fn()
    };

    sellersRepository = {
      createSellerAccount: jest.fn(),
      findByCacNumber: jest.fn(),
      findByUserId: jest.fn(),
      replaceDocuments: jest.fn()
    };

    jwtUtils = {
      signAccessToken: jest.fn(() => 'seller-token')
    };

    passwordUtils = {
      hashPassword: jest.fn(() => 'seller-password-hash')
    };

    sellersService = createSellersService({
      usersRepository,
      sellersRepository,
      jwtUtils,
      passwordUtils,
      env: {
        SELLER_AUTO_VERIFY: true
      }
    });
  });

  describe('registerSeller', () => {
    it('creates a seller account with pending verification and normalized contacts', async () => {
      usersRepository.findByEmail.mockResolvedValue(null);
      usersRepository.findByPhone.mockResolvedValue(null);
      sellersRepository.findByCacNumber.mockResolvedValue(null);
      sellersRepository.createSellerAccount.mockResolvedValue({
        user: {
          id: 11,
          role: 'seller',
          fullName: 'Uche Okafor',
          email: 'seller@example.com',
          phone: '+2348012345678',
          isVerified: false,
          createdAt: '2026-07-02T10:00:00.000Z',
          updatedAt: '2026-07-02T10:00:00.000Z'
        },
        sellerProfile: {
          id: 101,
          userId: 11,
          businessName: 'Prime Auto Hub',
          contactPhone: '+2348012345678',
          contactEmail: 'contact@primeautohub.com',
          address: '12 Sapara Williams Close, Victoria Island, Lagos',
          cacNumber: 'RC-123456',
          verificationStatus: 'pending',
          rejectionReason: null,
          documents: [],
          createdAt: '2026-07-02T10:00:00.000Z',
          updatedAt: '2026-07-02T10:00:00.000Z'
        }
      });

      const result = await sellersService.registerSeller({
        fullName: 'Uche Okafor',
        email: 'SELLER@EXAMPLE.COM',
        phone: '08012345678',
        password: 'Password123',
        businessName: 'Prime Auto Hub',
        contactEmail: 'CONTACT@PRIMEAUTOHUB.COM',
        contactPhone: '08012345678',
        address: '12 Sapara Williams Close, Victoria Island, Lagos',
        cacNumber: 'RC-123456'
      });

      expect(usersRepository.findByEmail).toHaveBeenCalledWith('seller@example.com');
      expect(usersRepository.findByPhone).toHaveBeenCalledWith('+2348012345678');
      expect(sellersRepository.findByCacNumber).toHaveBeenCalledWith('RC-123456');
      expect(passwordUtils.hashPassword).toHaveBeenCalledWith('Password123');
      expect(sellersRepository.createSellerAccount).toHaveBeenCalledWith({
        user: {
          role: 'seller',
          fullName: 'Uche Okafor',
          email: 'seller@example.com',
          phone: '+2348012345678',
          passwordHash: 'seller-password-hash',
          isVerified: false
        },
        profile: {
          businessName: 'Prime Auto Hub',
          contactPhone: '+2348012345678',
          contactEmail: 'contact@primeautohub.com',
          address: '12 Sapara Williams Close, Victoria Island, Lagos',
          cacNumber: 'RC-123456',
          verificationStatus: 'pending',
          rejectionReason: null
        }
      });
      expect(result.token).toBe('seller-token');
      expect(result.user.role).toBe('seller');
      expect(result.sellerProfile.verificationStatus).toBe('pending');
    });

    it('rejects duplicate CAC numbers', async () => {
      usersRepository.findByEmail.mockResolvedValue(null);
      usersRepository.findByPhone.mockResolvedValue(null);
      sellersRepository.findByCacNumber.mockResolvedValue({ sellerProfile: { id: 1 } });

      await expect(sellersService.registerSeller({
        fullName: 'Ada Nnaji',
        email: 'ada@example.com',
        password: 'Password123',
        businessName: 'Ada Parts',
        address: '15 Admiralty Way, Lekki Phase 1, Lagos',
        cacNumber: 'RC-222222'
      })).rejects.toMatchObject({
        statusCode: 409,
        code: 'CONFLICT'
      });
    });
  });

  describe('uploadDocuments', () => {
    it('uploads documents and auto-verifies the seller when enabled', async () => {
      sellersRepository.findByUserId.mockResolvedValue({
        user: {
          id: 8,
          role: 'seller',
          fullName: 'Tunde Bello',
          email: 'tunde@example.com',
          phone: '+2348098765432',
          isVerified: false,
          createdAt: '2026-07-02T10:00:00.000Z',
          updatedAt: '2026-07-02T10:00:00.000Z'
        },
        sellerProfile: {
          id: 88,
          userId: 8,
          businessName: 'Bello Motors',
          contactPhone: '+2348098765432',
          contactEmail: 'sales@bellomotors.ng',
          address: '22 Allen Avenue, Ikeja, Lagos',
          cacNumber: 'RC-300001',
          verificationStatus: 'pending',
          rejectionReason: null,
          documents: [],
          createdAt: '2026-07-02T10:00:00.000Z',
          updatedAt: '2026-07-02T10:00:00.000Z'
        }
      });
      sellersRepository.replaceDocuments.mockResolvedValue({
        user: {
          id: 8,
          role: 'seller',
          fullName: 'Tunde Bello',
          email: 'tunde@example.com',
          phone: '+2348098765432',
          isVerified: false,
          createdAt: '2026-07-02T10:00:00.000Z',
          updatedAt: '2026-07-02T10:00:00.000Z'
        },
        sellerProfile: {
          id: 88,
          userId: 8,
          businessName: 'Bello Motors',
          contactPhone: '+2348098765432',
          contactEmail: 'sales@bellomotors.ng',
          address: '22 Allen Avenue, Ikeja, Lagos',
          cacNumber: 'RC-300001',
          verificationStatus: 'verified',
          rejectionReason: null,
          documents: [
            {
              id: 1,
              type: 'cac',
              filePath: 'uploads/seller-documents/cac.pdf',
              uploadedAt: '2026-07-02T10:05:00.000Z',
              createdAt: '2026-07-02T10:05:00.000Z',
              updatedAt: '2026-07-02T10:05:00.000Z'
            },
            {
              id: 2,
              type: 'proof_of_address',
              filePath: 'uploads/seller-documents/proof.pdf',
              uploadedAt: '2026-07-02T10:05:00.000Z',
              createdAt: '2026-07-02T10:05:00.000Z',
              updatedAt: '2026-07-02T10:05:00.000Z'
            }
          ],
          createdAt: '2026-07-02T10:00:00.000Z',
          updatedAt: '2026-07-02T10:05:00.000Z'
        }
      });

      const result = await sellersService.uploadDocuments({
        userId: 8,
        documents: {
          cacDocument: {
            filePath: 'uploads/seller-documents/cac.pdf'
          },
          proofOfAddressDocument: {
            filePath: 'uploads/seller-documents/proof.pdf'
          }
        }
      });

      expect(sellersRepository.replaceDocuments).toHaveBeenCalledWith({
        sellerId: 88,
        documents: [
          {
            type: 'cac',
            filePath: 'uploads/seller-documents/cac.pdf'
          },
          {
            type: 'proof_of_address',
            filePath: 'uploads/seller-documents/proof.pdf'
          }
        ],
        verificationStatus: 'verified',
        rejectionReason: null
      });
      expect(result.sellerProfile.verificationStatus).toBe('verified');
      expect(result.sellerProfile.documents).toHaveLength(2);
    });
  });

  describe('getSellerProfile', () => {
    it('returns the authenticated seller profile', async () => {
      sellersRepository.findByUserId.mockResolvedValue({
        user: {
          id: 5,
          role: 'seller',
          fullName: 'Ngozi Eze',
          email: 'ngozi@example.com',
          phone: '+2347012345678',
          isVerified: false,
          createdAt: '2026-07-02T10:00:00.000Z',
          updatedAt: '2026-07-02T10:00:00.000Z'
        },
        sellerProfile: {
          id: 51,
          userId: 5,
          businessName: 'Eze Spares',
          contactPhone: '+2347012345678',
          contactEmail: 'hello@ezespares.ng',
          address: '17 Aba Road, Port Harcourt',
          cacNumber: 'RC-800001',
          verificationStatus: 'pending',
          rejectionReason: null,
          documents: [],
          createdAt: '2026-07-02T10:00:00.000Z',
          updatedAt: '2026-07-02T10:00:00.000Z'
        }
      });

      const result = await sellersService.getSellerProfile(5);

      expect(result.user.email).toBe('ngozi@example.com');
      expect(result.sellerProfile.businessName).toBe('Eze Spares');
    });
  });
});
