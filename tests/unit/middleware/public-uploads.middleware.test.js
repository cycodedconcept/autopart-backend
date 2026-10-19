require('../../setup/jest');
const { requirePublicImageExtension } = require('../../../src/middleware/public-uploads.middleware');
describe('Public upload path guard', () => {
  it.each([
    '/seller-documents/id.jpg', '/products/../seller-documents/id.jpg',
    '/products/%2e%2e/seller-documents/id.jpg',
    '/products/%2e%2e%2fseller-documents%2fid.jpg',
    '/products/..%5cseller-documents%5cid.jpg',
    '/products/%252e%252e%252fseller-documents/id.jpg',
    '/product-images/../seller-documents/id.jpg', '/blog/id.jpg',
    '/products/.secret/id.jpg', '/products/id.jpg%00', '/products/%',
    '/products-backup/id.jpg', '/products/id.pdf'
  ])('rejects the raw path %s before static middleware', (path) => {
    const next = jest.fn();
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    requirePublicImageExtension({ path }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });
  it.each(['/products/id.jpg', '/product-images/id.webp'])('allows %s', (path) => {
    const next = jest.fn();
    requirePublicImageExtension({ path }, {}, next);
    expect(next).toHaveBeenCalledWith();
  });
});
