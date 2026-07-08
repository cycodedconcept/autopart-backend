const bcrypt = require('bcrypt');
const fs = require('fs/promises');
const path = require('path');
const env = require('../src/config/env');
const { ADMIN_ROLE_NAMES } = require('../src/config/constants');
const { createPool } = require('../src/config/database');
const logger = require('../src/utils/logger');

async function applySeedFile(connection, seedsDirectory, filename) {
  const filePath = path.join(seedsDirectory, filename);
  const sql = await fs.readFile(filePath, 'utf8');

  await connection.query(sql);
}

function resolveSuperAdminSeedConfig() {
  const email = env.SUPER_ADMIN_EMAIL ? env.SUPER_ADMIN_EMAIL.trim().toLowerCase() : '';
  const password = env.SUPER_ADMIN_PASSWORD ? env.SUPER_ADMIN_PASSWORD.trim() : '';

  if (!email || !password) {
    throw new Error('SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are required to run npm run seed.');
  }

  return {
    email,
    password
  };
}

async function seedSuperAdmin(connection) {
  const { email, password } = resolveSuperAdminSeedConfig();
  const passwordHash = await bcrypt.hash(password, env.BCRYPT_SALT_ROUNDS);

  await connection.execute(
    `
      INSERT INTO admins (full_name, email, password_hash, is_active)
      VALUES (?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE
        full_name = VALUES(full_name),
        password_hash = VALUES(password_hash),
        is_active = VALUES(is_active),
        updated_at = CURRENT_TIMESTAMP
    `,
    ['Super Admin', email, passwordHash]
  );

  await connection.execute(
    `
      INSERT INTO admin_roles (admin_id, role_id)
      SELECT a.id, r.id
      FROM admins a
      INNER JOIN roles r ON r.name = ?
      WHERE a.email = ?
      ON DUPLICATE KEY UPDATE
        updated_at = CURRENT_TIMESTAMP
    `,
    [ADMIN_ROLE_NAMES.SUPER_ADMIN, email]
  );
}

async function run() {
  const seedsDirectory = path.resolve(__dirname, '../src/db/seeds');
  const seedFiles = (await fs.readdir(seedsDirectory))
    .filter((filename) => filename.endsWith('.sql'))
    .sort();
  const pool = createPool({
    multipleStatements: true
  });
  const connection = await pool.getConnection();

  try {
    if (!seedFiles.length) {
      logger.info('No seed files were found.');
      return;
    }

    await connection.beginTransaction();

    for (const filename of seedFiles) {
      logger.info(`Applying seed ${filename}`);
      await applySeedFile(connection, seedsDirectory, filename);
    }

    await seedSuperAdmin(connection);

    await connection.commit();
    logger.info('Seed data completed successfully.');
  } catch (error) {
    await connection.rollback();
    logger.error('Seeding failed.', error.message);
    process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
}

run();
