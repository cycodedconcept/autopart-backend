require('../../setup/jest');

const { createDeliveryJobsRepository } = require('../../../src/repositories/delivery-jobs.repository');

describe('delivery jobs repository', () => {
  let db;
  let deliveryJobsRepository;

  beforeEach(() => {
    db = {
      execute: jest.fn()
    };

    deliveryJobsRepository = createDeliveryJobsRepository({ db });
  });

  it('uses the seller_profiles alias when applying a search filter', async () => {
    db.execute
      .mockResolvedValueOnce([[{ total: 0 }]])
      .mockResolvedValueOnce([[]]);

    await deliveryJobsRepository.listJobs({
      status: 'pending',
      search: 'kano',
      limit: 10,
      offset: 0
    });

    const countQuery = db.execute.mock.calls[0][0];
    const listQuery = db.execute.mock.calls[1][0];

    expect(countQuery).toContain("LOWER(COALESCE(seller.business_name, '')) LIKE ?");
    expect(listQuery).toContain("LOWER(COALESCE(seller.business_name, '')) LIKE ?");
    expect(countQuery).not.toContain("LOWER(COALESCE(sp.business_name, '')) LIKE ?");
    expect(listQuery).not.toContain("LOWER(COALESCE(sp.business_name, '')) LIKE ?");
  });
});
