const env = require('./config/env');
const { createApp } = require('./app');
const { verifyDatabaseConnection } = require('./config/database');
const logger = require('./utils/logger');

const app = createApp();

async function startServer() {
  try {
    const databaseInfo = await verifyDatabaseConnection();
    logger.info(
      `Database connected (${databaseInfo.database} on ${databaseInfo.host}:${databaseInfo.port})`
    );

    app.listen(env.PORT, () => {
      logger.info(`Server listening on port ${env.PORT}`);
    });
  } catch (error) {
    logger.error('Database connection failed.', error.message);
    process.exit(1);
  }
}

startServer();
