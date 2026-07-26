require('../../setup/jest');

const {
  listSellerOrdersSchema,
  updateSellerOrderItemStatusSchema
} = require('../../../src/validators/seller-orders.validator');

describe('seller orders validator', () => {
  it('accepts a valid seller order list query', () => {
    const { error, value } = listSellerOrdersSchema.validate({
      body: {},
      params: {},
      query: {
        itemStatus: 'pending',
        page: '2',
        limit: '5'
      }
    });

    expect(error).toBeUndefined();
    expect(value.query).toEqual({
      itemStatus: 'pending',
      page: 2,
      limit: 5,
      offset: 5
    });
  });

  it('accepts a seller order item status update payload', () => {
    const { error, value } = updateSellerOrderItemStatusSchema.validate({
      body: {
        itemStatus: 'ready_for_pickup'
      },
      params: {
        id: '41'
      },
      query: {}
    });

    expect(error).toBeUndefined();
    expect(value.params.id).toBe(41);
    expect(value.body.itemStatus).toBe('ready_for_pickup');
  });

  it('rejects unsupported seller order item statuses', () => {
    const { error } = updateSellerOrderItemStatusSchema.validate({
      body: {
        itemStatus: 'picked_up'
      },
      params: {
        id: '41'
      },
      query: {}
    });

    expect(error).toBeDefined();
    expect(error.message).toContain('"body.itemStatus"');
  });
});
