require('../../setup/jest');

const {
  getProductByIdSchema,
  listProductsSchema
} = require('../../../src/validators/products.validator');

describe('products validator', () => {
  it('accepts a valid product list query', () => {
    const { error, value } = listProductsSchema.validate({
      body: {},
      params: {},
      query: {
        partName: 'Brake Pad',
        vehicleMake: 'Toyota',
        vehicleModel: 'Camry',
        vehicleYear: '2010',
        category: 'brake-system',
        partNumber: 'FBP',
        condition: 'new',
        minPriceKobo: '1000000',
        maxPriceKobo: '3000000',
        location: 'Lagos',
        sellerRating: '4.5',
        sellerBusinessName: 'Prime',
        page: '2',
        limit: '5'
      }
    });

    expect(error).toBeUndefined();
    expect(value.query).toEqual({
      partName: 'Brake Pad',
      vehicleMake: 'Toyota',
      vehicleModel: 'Camry',
      vehicleYear: 2010,
      category: 'brake-system',
      partNumber: 'FBP',
      condition: 'new',
      minPriceKobo: 1000000,
      maxPriceKobo: 3000000,
      location: 'Lagos',
      sellerRating: 4.5,
      sellerBusinessName: 'Prime',
      page: 2,
      limit: 5
    });
  });

  it('rejects an invalid price range', () => {
    const { error } = listProductsSchema.validate({
      body: {},
      params: {},
      query: {
        minPriceKobo: 4000000,
        maxPriceKobo: 1000000
      }
    });

    expect(error).toBeDefined();
    expect(error.message).toContain('maxPriceKobo');
  });

  it('rejects an invalid product condition filter', () => {
    const { error } = listProductsSchema.validate({
      body: {},
      params: {},
      query: {
        condition: 'brand-new'
      }
    });

    expect(error).toBeDefined();
    expect(error.message).toContain('"query.condition"');
  });

  it('rejects an invalid product id parameter', () => {
    const { error } = getProductByIdSchema.validate({
      body: {},
      params: {
        id: '0'
      },
      query: {}
    });

    expect(error).toBeDefined();
    expect(error.message).toContain('"params.id"');
  });
});
