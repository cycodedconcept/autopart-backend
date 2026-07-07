require('../../setup/jest');

const { createAdminService } = require('../../../src/services/admin.service');

describe('admin service', () => {
  let adminRepository;
  let adminService;

  beforeEach(() => {
    adminRepository = {
      findSellerAccountBySellerId: jest.fn(),
      listSellerVerificationQueue: jest.fn(),
      updateSellerVerificationStatus: jest.fn()
    };

    adminService = createAdminService({
      adminRepository
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
        sellerId: 101,
        verificationStatus: 'verified'
      });

      expect(adminRepository.updateSellerVerificationStatus).toHaveBeenCalledWith({
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
