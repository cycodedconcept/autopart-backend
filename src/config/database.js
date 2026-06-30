const mysql = require('mysql2/promise');
const env = require('./env');

let pool;

function createPool() {
  return mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
}

function getPool() {
  if (!pool) {
    pool = createPool();
  }

  return pool;
}

async function verifyDatabaseConnection() {
  const activePool = getPool();
  const connection = await activePool.getConnection();

  try {
    await connection.ping();

    return {
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME
    };
  } finally {
    connection.release();
  }
}

function setPool(nextPool) {
  pool = nextPool;
}

async function closePool() {
  if (pool && typeof pool.end === 'function') {
    await pool.end();
  }

  pool = null;
}

module.exports = {
  closePool,
  createPool,
  getPool,
  verifyDatabaseConnection,
  setPool
};
