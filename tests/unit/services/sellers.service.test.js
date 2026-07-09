require('../../setup/jest');

const { createSellersService } = require('../../../src/services/sellers.service');

describe('sellers service', () => {
  let cacVerificationService;
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
      replaceDocuments: jest.fn(),
      updateCacVerificationResult: jest.fn()
    };

    jwtUtils = {
      signAccessToken: jest.fn(() => 'seller-token')
    };

    cacVerificationService = {
      verifyBusiness: jest.fn(() => ({
        checkedAt: '2026-07-09T09:30:00.000Z',
        response: {
          body: {
            entityName: 'Prime Auto Hub'
          },
          httpStatusCode: 200
        },
        status: 'completed'
      }))
    };

    passwordUtils = {
      hashPassword: jest.fn(() => 'seller-password-hash')
    };

    sellersService = createSellersService({
      cacVerificationService,
      usersRepository,
      sellersRepository,
      jwtUtils,
      passwordUtils
    });
  });

  describe('registerSeller', () => {
    it('creates a seller account with stored CAC verification metadata and normalized contacts', async () => {
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
          cacVerification: {
            checkedAt: '2026-07-09T09:30:00.000Z',
            response: {
              body: {
                entityName: 'Prime Auto Hub'
              },
              httpStatusCode: 200
            },
            status: 'completed'
          },
          verificationStatus: 'pending',
          rejectionReason: null,
          verifiedAt: null,
          verifiedBy: null,
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
      expect(cacVerificationService.verifyBusiness).toHaveBeenCalledWith({
        businessName: 'Prime Auto Hub',
        cacNumber: 'RC-123456',
        customerReference: 'seller-registration-RC-123456'
      });
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
          cacVerificationCheckedAt: '2026-07-09T09:30:00.000Z',
          cacVerificationResponse: {
            provider: 'dojah',
            response: {
              body: {
                entityName: 'Prime Auto Hub'
              },
              httpStatusCode: 200
            },
            error: undefined
          },
          cacVerificationStatus: 'completed',
          verificationStatus: 'pending',
          rejectionReason: null,
          verifiedAt: null,
          verifiedBy: null
        }
      });
      expect(result.token).toBe('seller-token');
      expect(result.user.role).toBe('seller');
      expect(result.sellerProfile.verificationStatus).toBe('pending');
      expect(result.sellerProfile.cacVerification.status).toBe('completed');
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
    it('uploads documents and keeps the seller pending admin review', async () => {
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
          cacVerification: {
            checkedAt: '2026-07-09T09:30:00.000Z',
            response: {
              body: {
                entityName: 'Bello Motors'
              },
              httpStatusCode: 200
            },
            status: 'completed'
          },
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
          verificationStatus: 'pending',
          rejectionReason: null,
          cacVerification: {
            checkedAt: '2026-07-09T09:30:00.000Z',
            response: {
              body: {
                entityName: 'Bello Motors'
              },
              httpStatusCode: 200
            },
            status: 'completed'
          },
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
        verificationStatus: 'pending',
        rejectionReason: null
      });
      expect(result.sellerProfile.verificationStatus).toBe('pending');
      expect(result.sellerProfile.documents).toHaveLength(2);
    });
  });

  describe('retryCacVerification', () => {
    it('refreshes the stored CAC verification metadata for an existing seller', async () => {
      sellersRepository.findByUserId.mockResolvedValue({
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
          contactEmail: 'sales@primeautohub.ng',
          address: '12 Sapara Williams Close, Victoria Island, Lagos',
          cacNumber: 'RC-123456',
          verificationStatus: 'pending',
          rejectionReason: null,
          cacVerification: {
            checkedAt: '2026-07-09T11:06:55.000Z',
            error: {
              message: 'Your Secret Key could not be Authorized'
            },
            provider: 'dojah',
            response: {
              body: {
                error: 'Your Secret Key could not be Authorized'
              },
              httpStatusCode: 401
            },
            status: 'failed'
          },
          documents: [],
          createdAt: '2026-07-02T10:00:00.000Z',
          updatedAt: '2026-07-02T10:00:00.000Z'
        }
      });
      cacVerificationService.verifyBusiness.mockResolvedValue({
        checkedAt: '2026-07-09T12:20:00.000Z',
        response: {
          body: {
            entity_name: 'Prime Auto Hub',
            registration_number: 'RC-123456'
          },
          httpStatusCode: 200
        },
        status: 'completed'
      });
      sellersRepository.updateCacVerificationResult.mockResolvedValue({
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
          contactEmail: 'sales@primeautohub.ng',
          address: '12 Sapara Williams Close, Victoria Island, Lagos',
          cacNumber: 'RC-123456',
          verificationStatus: 'pending',
          rejectionReason: null,
          cacVerification: {
            checkedAt: '2026-07-09T12:20:00.000Z',
            error: null,
            provider: 'dojah',
            response: {
              body: {
                entity_name: 'Prime Auto Hub',
                registration_number: 'RC-123456'
              },
              httpStatusCode: 200
            },
            status: 'completed'
          },
          documents: [],
          createdAt: '2026-07-02T10:00:00.000Z',
          updatedAt: '2026-07-09T12:20:00.000Z'
        }
      });

      const result = await sellersService.retryCacVerification(11);

      expect(cacVerificationService.verifyBusiness).toHaveBeenCalledWith({
        businessName: 'Prime Auto Hub',
        cacNumber: 'RC-123456',
        customerReference: 'seller-registration-RC-123456'
      });
      expect(sellersRepository.updateCacVerificationResult).toHaveBeenCalledWith({
        sellerId: 101,
        cacVerificationCheckedAt: '2026-07-09T12:20:00.000Z',
        cacVerificationResponse: {
          provider: 'dojah',
          response: {
            body: {
              entity_name: 'Prime Auto Hub',
              registration_number: 'RC-123456'
            },
            httpStatusCode: 200
          },
          error: undefined
        },
        cacVerificationStatus: 'completed'
      });
      expect(result.sellerProfile.cacVerification.status).toBe('completed');
      expect(result.sellerProfile.verificationStatus).toBe('pending');
    });

    it('returns not found when the seller profile does not exist', async () => {
      sellersRepository.findByUserId.mockResolvedValue(null);

      await expect(sellersService.retryCacVerification(9999)).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND'
      });
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
