require('../../setup/jest');
const { createPartnerService } = require('../../../src/services/partner.service');
describe('Partner image enrichment', () => {
  it('skips image queries for empty product pages and seller listings', async () => {
    const partnerRepository = {
      listProducts: jest.fn(async () => ({ products: [], total: 0 })),
      listSellers: jest.fn(async () => ({ sellers: [], total: 0 })),
      findImagesByProductIds: jest.fn()
    };
    const service = createPartnerService({ partnerRepository, env: { APP_URL: '' } });
    expect((await service.listProducts({})).products).toEqual([]);
    await service.listSellers({});
    expect(partnerRepository.findImagesByProductIds).not.toHaveBeenCalled();
  });
  it('fails clearly if APP_URL is absent instead of emitting relative URLs', async () => {
    const partnerRepository = {
      listProducts: async () => ({ products: [{ id: 1 }], total: 1 }),
      findImagesByProductIds: async () => [{ productId: 1, url: '/uploads/products/photo.jpg', position: 1 }]
    };
    const service = createPartnerService({ partnerRepository, env: { APP_URL: '' } });
    await expect(service.listProducts({})).rejects.toMatchObject({ statusCode: 500, code: 'INTERNAL_SERVER_ERROR' });
  });
});
