const fs = require('fs/promises');
const path = require('path');
const { createPool } = require('../src/config/database');
const logger = require('../src/utils/logger');

async function applySeedFile(connection, seedsDirectory, filename) {
  const filePath = path.join(seedsDirectory, filename);
  const sql = await fs.readFile(filePath, 'utf8');

  await connection.query(sql);
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
