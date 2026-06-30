const bcrypt = require('bcrypt');
const env = require('../config/env');

async function hashPassword(password) {
  return bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);
}

async function comparePassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

module.exports = {
  comparePassword,
  hashPassword
};
