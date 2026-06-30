require('../../setup/jest');

const { comparePassword, hashPassword } = require('../../../src/utils/password');

describe('password utils', () => {
  it('hashes and compares passwords', async () => {
    const password = 'Password123';
    const hash = await hashPassword(password);
    const isValid = await comparePassword(password, hash);

    expect(hash).not.toBe(password);
    expect(isValid).toBe(true);
  });
});
