require('../../setup/jest');

const { signAccessToken, verifyAccessToken } = require('../../../src/utils/jwt');

describe('jwt utils', () => {
  it('signs and verifies access tokens', () => {
    const token = signAccessToken({ sub: 42, role: 'buyer' });
    const decoded = verifyAccessToken(token);

    expect(decoded.sub).toBe(42);
    expect(decoded.role).toBe('buyer');
  });
});
