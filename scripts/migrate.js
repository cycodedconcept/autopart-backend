const fs = require('fs/promises');
const path = require('path');
const { createPool } = require('../src/config/database');
const logger = require('../src/utils/logger');

async function ensureMigrationsTable(connection) {
  await connection.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      filename VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_schema_migrations_filename (filename)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function getPendingMigrations(connection, migrationsDirectory) {
  const filenames = (await fs.readdir(migrationsDirectory))
    .filter((filename) => filename.endsWith('.sql'))
    .sort();

  const [rows] = await connection.execute(
    'SELECT filename FROM schema_migrations ORDER BY filename ASC'
  );

  const appliedFilenames = new Set(rows.map((row) => row.filename));

  return filenames.filter((filename) => !appliedFilenames.has(filename));
}

async function applyMigration(connection, migrationsDirectory, filename) {
  const filePath = path.join(migrationsDirectory, filename);
  const sql = await fs.readFile(filePath, 'utf8');

  await connection.query(sql);
  await connection.execute(
    'INSERT INTO schema_migrations (filename) VALUES (?)',
    [filename]
  );
}

async function run() {
  const migrationsDirectory = path.resolve(__dirname, '../src/db/migrations');
  const pool = createPool({
    multipleStatements: true
  });
  const connection = await pool.getConnection();

  try {
  await ensureMigrationsTable(connection);
  const pendingMigrations = await getPendingMigrations(connection, migrationsDirectory);

  for (const filename of pendingMigrations) {
    logger.info(`Applying migration ${filename}`);
    await applyMigration(connection, migrationsDirectory, filename);
  }

  logger.info('Migrations completed successfully.');
} catch (error) {
  logger.error('Migration failed.', error.message);
  process.exit(1);
} finally {
  connection.release();
  await pool.end();
}
}

run();
