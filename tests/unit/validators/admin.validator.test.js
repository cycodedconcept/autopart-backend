require('../../setup/jest');

const {
  adminLoginSchema,
  createCategorySchema,
  createVehicleTaxonomySchema,
  getAdminDashboardSchema,
  getCategorySchema,
  getPlatformConfigSchema,
  getSellerVerificationCandidateSchema,
  listAdminDisputesSchema,
  listAdminOrdersSchema,
  listAdminPayoutsSchema,
  listAuditLogsSchema,
  listCategoriesSchema,
  listSellerVerificationQueueSchema,
  listUsersSchema,
  listVehicleTaxonomySchema,
  updateAdminDisputeSchema,
  updateAdminOrderStatusSchema,
  updateAdminPayoutStatusSchema,
  updateCategorySchema,
  updatePlatformConfigSchema,
  updateSellerVerificationStatusSchema,
  updateUserStatusSchema,
  updateVehicleTaxonomySchema
} = require('../../../src/validators/admin.validator');

describe('admin validator', () => {
  it('accepts a valid admin login payload', () => {
    const { error, value } = adminLoginSchema.validate({
      body: {
        email: 'SUPERADMIN@EXAMPLE.COM',
        password: 'Password123'
      },
      params: {},
      query: {}
    });

    expect(error).toBeUndefined();
    expect(value.body.email).toBe('superadmin@example.com');
  });

  it('accepts an empty admin dashboard request envelope', () => {
    const { error } = getAdminDashboardSchema.validate({
      body: {},
      params: {},
      query: {}
    });

    expect(error).toBeUndefined();
  });

  it('accepts a valid seller verification queue query', () => {
    const { error, value } = listSellerVerificationQueueSchema.validate({
      body: {},
      params: {},
      query: {
        status: 'pending',
        page: '2',
        limit: '5'
      }
    });

    expect(error).toBeUndefined();
    expect(value.query).toEqual({
      status: 'pending',
      page: 2,
      limit: 5
    });
  });

  it('accepts a valid seller verification approval payload', () => {
    const { error } = updateSellerVerificationStatusSchema.validate({
      body: {
        verificationStatus: 'verified'
      },
      params: {
        id: 101
      },
      query: {}
    });

    expect(error).toBeUndefined();
  });

  it('requires a rejection reason when rejecting a seller', () => {
    const { error } = updateSellerVerificationStatusSchema.validate({
      body: {
        verificationStatus: 'rejected'
      },
      params: {
        id: 101
      },
      query: {}
    });

    expect(error).toBeDefined();
    expect(error.message).toContain('rejectionReason');
  });

  it('accepts a valid seller detail params payload', () => {
    const { error, value } = getSellerVerificationCandidateSchema.validate({
      body: {},
      params: {
        id: '101'
      },
      query: {}
    });

    expect(error).toBeUndefined();
    expect(value.params.id).toBe(101);
  });

  it('accepts a valid category creation payload', () => {
    const { error, value } = createCategorySchema.validate({
      body: {
        name: 'Cooling System',
        parentId: null
      },
      params: {},
      query: {}
    });

    expect(error).toBeUndefined();
    expect(value.body.name).toBe('Cooling System');
  });

  it('accepts a valid category list query with a status filter', () => {
    const { error, value } = listCategoriesSchema.validate({
      body: {},
      params: {},
      query: {
        status: 'archived'
      }
    });

    expect(error).toBeUndefined();
    expect(value.query.status).toBe('archived');
  });

  it('accepts a valid managed-user list query', () => {
    const { error, value } = listUsersSchema.validate({
      body: {},
      params: {},
      query: {
        role: 'seller',
        status: 'suspended',
        search: 'uche@example.com',
        page: '2',
        limit: '5'
      }
    });

    expect(error).toBeUndefined();
    expect(value.query).toEqual({
      role: 'seller',
      status: 'suspended',
      search: 'uche@example.com',
      page: 2,
      limit: 5
    });
  });

  it('accepts a valid managed-user status update payload', () => {
    const { error, value } = updateUserStatusSchema.validate({
      body: {
        status: 'banned'
      },
      params: {
        id: '21'
      },
      query: {}
    });

    expect(error).toBeUndefined();
    expect(value.params.id).toBe(21);
    expect(value.body.status).toBe('banned');
  });

  it('accepts valid category detail params', () => {
    const { error, value } = getCategorySchema.validate({
      body: {},
      params: {
        id: '1001'
      },
      query: {}
    });

    expect(error).toBeUndefined();
    expect(value.params.id).toBe(1001);
  });

  it('requires at least one field when updating a category', () => {
    const { error } = updateCategorySchema.validate({
      body: {},
      params: {
        id: 1001
      },
      query: {}
    });

    expect(error).toBeDefined();
  });

  it('accepts category status changes when updating a category', () => {
    const { error, value } = updateCategorySchema.validate({
      body: {
        status: 'active'
      },
      params: {
        id: 1001
      },
      query: {}
    });

    expect(error).toBeUndefined();
    expect(value.body.status).toBe('active');
  });

  it('accepts a valid vehicle taxonomy list query', () => {
    const { error, value } = listVehicleTaxonomySchema.validate({
      body: {},
      params: {},
      query: {
        make: 'Toyota',
        page: '2',
        limit: '5'
      }
    });

    expect(error).toBeUndefined();
    expect(value.query).toEqual({
      make: 'Toyota',
      page: 2,
      limit: 5
    });
  });

  it('accepts a valid admin order list query', () => {
    const { error, value } = listAdminOrdersSchema.validate({
      body: {},
      params: {},
      query: {
        status: 'confirmed',
        paymentStatus: 'paid',
        search: 'bola@example.com',
        page: '2',
        limit: '5'
      }
    });

    expect(error).toBeUndefined();
    expect(value.query).toEqual({
      status: 'confirmed',
      paymentStatus: 'paid',
      search: 'bola@example.com',
      page: 2,
      limit: 5
    });
  });

  it('accepts a valid admin order status update payload', () => {
    const { error, value } = updateAdminOrderStatusSchema.validate({
      body: {
        status: 'picked_up',
        note: 'Collected from seller by operations team.'
      },
      params: {
        id: '5001'
      },
      query: {}
    });

    expect(error).toBeUndefined();
    expect(value.params.id).toBe(5001);
    expect(value.body.status).toBe('picked_up');
  });

  it('accepts a valid admin payout list query', () => {
    const { error, value } = listAdminPayoutsSchema.validate({
      body: {},
      params: {},
      query: {
        status: 'requested',
        sellerId: '101',
        search: 'uche@example.com',
        page: '2',
        limit: '5'
      }
    });

    expect(error).toBeUndefined();
    expect(value.query).toEqual({
      payeeType: 'all',
      status: 'requested',
      sellerId: 101,
      search: 'uche@example.com',
      page: 2,
      limit: 5
    });
  });

  it('accepts a valid admin dispute list query', () => {
    const { error, value } = listAdminDisputesSchema.validate({
      body: {},
      params: {},
      query: {
        status: 'open',
        raisedBy: 'seller',
        search: 'damaged',
        page: '2',
        limit: '5'
      }
    });

    expect(error).toBeUndefined();
    expect(value.query).toEqual({
      status: 'open',
      raisedBy: 'seller',
      search: 'damaged',
      page: 2,
      limit: 5
    });
  });

  it('requires a rejection reason when rejecting a payout', () => {
    const { error } = updateAdminPayoutStatusSchema.validate({
      body: {
        status: 'rejected'
      },
      params: {
        id: 901
      },
      query: {}
    });

    expect(error).toBeDefined();
    expect(error.message).toContain('rejectionReason');
  });

  it('accepts a resolved dispute payload with paired refund metadata', () => {
    const { error, value } = updateAdminDisputeSchema.validate({
      body: {
        status: 'resolved',
        resolutionNote: 'Refund approved after confirming the damaged item.',
        refundReference: 'RFD-5001',
        refundAmountKobo: 1500000
      },
      params: {
        id: '301'
      },
      query: {}
    });

    expect(error).toBeUndefined();
    expect(value.params.id).toBe(301);
    expect(value.body.refundAmountKobo).toBe(1500000);
  });

  it('requires refund metadata to be provided together when resolving a dispute', () => {
    const { error } = updateAdminDisputeSchema.validate({
      body: {
        status: 'resolved',
        resolutionNote: 'Refund approved after confirming the damaged item.',
        refundReference: 'RFD-5001'
      },
      params: {
        id: 301
      },
      query: {}
    });

    expect(error).toBeDefined();
    expect(error.message).toContain('refundAmountKobo');
  });

  it('accepts a valid platform config update payload', () => {
    const { error, value } = updatePlatformConfigSchema.validate({
      body: {
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
      },
      params: {},
      query: {}
    });

    expect(error).toBeUndefined();
    expect(value.body.commissionRateDefault).toBe(12);
    expect(value.body.commissionRatesByCategory[0].categoryId).toBe(1001);
  });

  it('accepts an empty platform config get request envelope', () => {
    const { error } = getPlatformConfigSchema.validate({
      body: {},
      params: {},
      query: {}
    });

    expect(error).toBeUndefined();
  });

  it('accepts a valid audit log list query', () => {
    const { error, value } = listAuditLogsSchema.validate({
      body: {},
      params: {},
      query: {
        adminId: '5',
        action: 'payout.approved',
        targetType: 'payout',
        targetId: '901',
        page: '2',
        limit: '5'
      }
    });

    expect(error).toBeUndefined();
    expect(value.query).toEqual({
      adminId: 5,
      action: 'payout.approved',
      targetType: 'payout',
      targetId: 901,
      page: 2,
      limit: 5
    });
  });

  it('accepts a valid vehicle taxonomy creation payload', () => {
    const { error } = createVehicleTaxonomySchema.validate({
      body: {
        make: 'Toyota',
        model: 'Camry',
        yearFrom: 2007,
        yearTo: 2011
      },
      params: {},
      query: {}
    });

    expect(error).toBeUndefined();
  });

  it('requires at least one field when updating a vehicle taxonomy entry', () => {
    const { error } = updateVehicleTaxonomySchema.validate({
      body: {},
      params: {
        id: 3001
      },
      query: {}
    });

    expect(error).toBeDefined();
  });
});
