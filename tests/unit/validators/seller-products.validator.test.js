require('../../setup/jest');

const {
  createSellerProductSchema,
  deleteSellerProductSchema,
  listSellerProductsSchema,
  updateSellerProductSchema
} = require('../../../src/validators/seller-products.validator');

describe('seller product validators', () => {
  it('accepts a create-product payload', () => {
    const { error } = createSellerProductSchema.validate({
      body: {
        title: 'Front Brake Disc',
        description: 'Premium brake disc for Toyota Camry.',
        categoryId: 1002,
        partNumber: 'DISC-001',
        condition: 'new',
        priceKobo: 4500000,
        stockQty: 12,
        location: 'Lagos',
        compatibility: [
          {
            make: 'Toyota',
            model: 'Camry',
            yearFrom: 2007,
            yearTo: 2011
          }
        ]
      },
      params: {},
      query: {}
    });

    expect(error).toBeUndefined();
  });

  it('rejects compatibility ranges where yearTo is before yearFrom', () => {
    const { error } = createSellerProductSchema.validate({
      body: {
        title: 'Front Brake Disc',
        description: 'Premium brake disc for Toyota Camry.',
        categoryId: 1002,
        partNumber: 'DISC-001',
        condition: 'new',
        priceKobo: 4500000,
        stockQty: 12,
        location: 'Lagos',
        compatibility: [
          {
            make: 'Toyota',
            model: 'Camry',
            yearFrom: 2011,
            yearTo: 2007
          }
        ]
      },
      params: {},
      query: {}
    });

    expect(error).toBeDefined();
  });

  it('accepts seller list-product query filters', () => {
    const { error } = listSellerProductsSchema.validate({
      body: {},
      params: {},
      query: {
        status: 'inactive',
        page: 1,
        limit: 20
      }
    });

    expect(error).toBeUndefined();
  });

  it('accepts partial seller product updates', () => {
    const { error } = updateSellerProductSchema.validate({
      body: {
        priceKobo: 5500000
      },
      params: {
        id: 55
      },
      query: {}
    });

    expect(error).toBeUndefined();
  });

  it('accepts seller product deletion params', () => {
    const { error } = deleteSellerProductSchema.validate({
      body: {},
      params: {
        id: 55
      },
      query: {}
    });

    expect(error).toBeUndefined();
  });
});
