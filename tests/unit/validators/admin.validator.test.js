require('../../setup/jest');

const {
  adminLoginSchema,
  createCategorySchema,
  createVehicleTaxonomySchema,
  getCategorySchema,
  getSellerVerificationCandidateSchema,
  listSellerVerificationQueueSchema,
  listVehicleTaxonomySchema,
  updateCategorySchema,
  updateSellerVerificationStatusSchema,
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
