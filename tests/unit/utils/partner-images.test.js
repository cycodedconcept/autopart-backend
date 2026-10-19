require('../../setup/jest');
const { mapPartnerImages } = require('../../../src/utils/partner-images');
describe('Partner image URL whitelist', () => {
  it.each([
    '/var/www/uploads/products/private.jpg', 'C:\\uploads\\products\\private.jpg',
    'file:///uploads/products/private.jpg', '//remote.test/photo.jpg',
    '/uploads/products/%2e%2e/private.jpg', '/uploads/products/../private.jpg',
    '/uploads/products/.hidden.jpg', '/uploads/products/photo.svg',
    '/uploads/products/photo.jpg?secret=x', '/uploads/disputes/private.jpg',
    'https://remote.test/photo.jpg', null
  ])('omits unsupported stored path %s', (url) => {
    expect(mapPartnerImages([{ productId: 1, url, position: 1 }], 'https://public.test').size).toBe(0);
  });
  it('uses APP_URL origin and emits only the public image contract', () => {
    const images = mapPartnerImages([{ productId: 1, url: '/uploads/products/photo.thumb.webp', position: 3, id: 9, filename: 'private' }], 'https://public.test/base/').get('1');
    expect(images).toEqual([{ url: 'https://public.test/uploads/products/photo.thumb.webp', isPrimary: true, position: 3 }]);
  });
});
