require('../../setup/jest');

describe('database config', () => {
  let database;

  beforeEach(() => {
    jest.resetModules();
    database = require('../../../src/config/database');
  });

  afterEach(async () => {
    await database.closePool();
  });

  it('verifies database connectivity and returns connection metadata', async () => {
    const ping = jest.fn().mockResolvedValue(undefined);
    const release = jest.fn();

    database.setPool({
      getConnection: jest.fn().mockResolvedValue({
        ping,
        release
      })
    });

    const result = await database.verifyDatabaseConnection();

    expect(ping).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      host: 'localhost',
      port: 3306,
      database: 'autoparts_test'
    });
  });

  it('releases the connection when ping fails', async () => {
    const release = jest.fn();

    database.setPool({
      getConnection: jest.fn().mockResolvedValue({
        ping: jest.fn().mockRejectedValue(new Error('connect ECONNREFUSED')),
        release
      })
    });

    await expect(database.verifyDatabaseConnection()).rejects.toThrow('connect ECONNREFUSED');
    expect(release).toHaveBeenCalledTimes(1);
  });
});
