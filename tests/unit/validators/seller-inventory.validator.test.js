require('../../setup/jest');

const {
  bulkUploadSellerInventorySchema,
  listSellerInventorySchema,
  sellerInventoryCsvRowSchema
} = require('../../../src/validators/seller-inventory.validator');

describe('seller inventory validator', () => {
  it('accepts a valid seller inventory query', () => {
    const { error, value } = listSellerInventorySchema.validate({
      body: {},
      params: {},
      query: {
        status: 'active',
        lowStockOnly: 'true',
        page: '2',
        limit: '5'
      }
    });

    expect(error).toBeUndefined();
    expect(value.query).toEqual({
      status: 'active',
      lowStockOnly: true,
      page: 2,
      limit: 5,
      offset: 5
    });
  });

  it('accepts an empty bulk upload request envelope', () => {
    const { error } = bulkUploadSellerInventorySchema.validate({
      body: {},
      params: {},
      query: {}
    });

    expect(error).toBeUndefined();
  });

  it('accepts a valid inventory csv row payload', () => {
    const { error, value } = sellerInventoryCsvRowSchema.validate({
      title: 'Front Brake Disc',
      description: 'Premium brake disc for Toyota Camry sedans.',
      categoryId: 1002,
      partNumber: 'DISC-001',
      condition: 'new',
      priceKobo: 4500000,
      stockQty: 12,
      location: 'Lagos',
      status: 'active',
      compatibleMake: 'Toyota',
      compatibleModel: 'Camry',
      compatibleYearFrom: 2007,
      compatibleYearTo: 2011,
      imageUrls: 'https://example.com/disc-1.png'
    });

    expect(error).toBeUndefined();
    expect(value.status).toBe('active');
  });

  it('rejects csv rows with an invalid compatibility year range', () => {
    const { error } = sellerInventoryCsvRowSchema.validate({
      title: 'Front Brake Disc',
      description: 'Premium brake disc for Toyota Camry sedans.',
      categoryId: 1002,
      partNumber: 'DISC-001',
      condition: 'new',
      priceKobo: 4500000,
      stockQty: 12,
      location: 'Lagos',
      status: 'active',
      compatibleMake: 'Toyota',
      compatibleModel: 'Camry',
      compatibleYearFrom: 2012,
      compatibleYearTo: 2011,
      imageUrls: 'https://example.com/disc-1.png'
    });

    expect(error).toBeDefined();
    expect(error.message).toContain('compatibleYearTo');
  });
});
