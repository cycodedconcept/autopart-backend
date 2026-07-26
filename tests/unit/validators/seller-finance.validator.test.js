require('../../setup/jest');

const {
  createSellerPayoutSchema,
  listSellerPayoutsSchema,
  sellerSalesSummarySchema
} = require('../../../src/validators/seller-finance.validator');

describe('seller finance validator', () => {
  it('accepts a valid seller sales query', () => {
    const { error, value } = sellerSalesSummarySchema.validate({
      body: {},
      params: {},
      query: {
        dateFrom: '2026-07-01',
        dateTo: '2026-07-07'
      }
    });

    expect(error).toBeUndefined();
    expect(value.query).toEqual({
      dateFrom: '2026-07-01',
      dateTo: '2026-07-07'
    });
  });

  it('rejects an invalid seller sales date range', () => {
    const { error } = sellerSalesSummarySchema.validate({
      body: {},
      params: {},
      query: {
        dateFrom: '2026-07-08',
        dateTo: '2026-07-07'
      }
    });

    expect(error).toBeDefined();
    expect(error.message).toContain('dateTo');
  });

  it('accepts a valid payout request payload', () => {
    const { error, value } = createSellerPayoutSchema.validate({
      body: {
        bankAccountRef: 'BANK-0012345678'
      },
      params: {},
      query: {}
    });

    expect(error).toBeUndefined();
    expect(value.body.bankAccountRef).toBe('BANK-0012345678');
  });

  it('accepts a valid payout history query', () => {
    const { error, value } = listSellerPayoutsSchema.validate({
      body: {},
      params: {},
      query: {
        status: 'requested',
        page: '2',
        limit: '5'
      }
    });

    expect(error).toBeUndefined();
    expect(value.query).toEqual({
      status: 'requested',
      page: 2,
      limit: 5,
      offset: 5
    });
  });
});
