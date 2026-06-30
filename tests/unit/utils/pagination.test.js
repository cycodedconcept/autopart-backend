require('../../setup/jest');

const {
  buildPagination,
  normalizePagination
} = require('../../../src/utils/pagination');

describe('pagination utils', () => {
  it('normalizes page, limit, and offset within bounds', () => {
    expect(normalizePagination({
      page: 3,
      limit: 100
    }, {
      defaultLimit: 10,
      maxLimit: 50
    })).toEqual({
      page: 3,
      limit: 50,
      offset: 100
    });
  });

  it('builds pagination metadata from total results', () => {
    expect(buildPagination({
      page: 2,
      limit: 10,
      total: 24
    })).toEqual({
      page: 2,
      limit: 10,
      total: 24,
      totalPages: 3
    });
  });
});
