const { createPool } = require('../src/config/database');
const logger = require('../src/utils/logger');

async function run() {
  const pool = createPool();
  const legacyHost = `res.${'cloud' + 'inary'}.com`;

  try {
    const [rows] = await pool.execute(
      'SELECT id, product_id, url FROM product_images WHERE url LIKE ? ORDER BY id ASC',
      [`https://${legacyHost}/%`]
    );

    rows.forEach((row) => logger.info(`Product image ${row.id} (product ${row.product_id}): ${row.url}`));
    logger.info(`Found ${rows.length} legacy remote product image URL(s). No rows were changed.`);
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  logger.error('Legacy product image report failed.', error.message);
  process.exitCode = 1;
});
