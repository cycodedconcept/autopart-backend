require('../../setup/jest');

const {
  createOrderSchema,
  getOrderByIdSchema,
  getOrderReceiptSchema,
  listOrdersSchema
} = require('../../../src/validators/orders.validator');

describe('orders validator', () => {
  it('accepts an existing delivery address id', () => {
    const { error, value } = createOrderSchema.validate({
      body: {
        paymentMethod: 'paystack',
        deliveryAddressId: '3'
      },
      params: {},
      query: {}
    });

    expect(error).toBeUndefined();
    expect(value.body.deliveryAddressId).toBe(3);
  });

  it('accepts an inline delivery address payload', () => {
    const { error } = createOrderSchema.validate({
      body: {
        paymentMethod: 'bank_transfer',
        deliveryAddress: {
          label: 'Workshop',
          street: '12 Adeola Odeku Street',
          city: 'Ikeja',
          state: 'Lagos',
          phone: '08012345678'
        }
      },
      params: {},
      query: {}
    });

    expect(error).toBeUndefined();
  });

  it('rejects missing delivery address selection', () => {
    const { error } = createOrderSchema.validate({
      body: {
        paymentMethod: 'paystack'
      },
      params: {},
      query: {}
    });

    expect(error).toBeDefined();
    expect(error.message).toContain('must contain at least one');
  });

  it('accepts a valid order history query', () => {
    const { error, value } = listOrdersSchema.validate({
      body: {},
      params: {},
      query: {
        status: 'confirmed',
        page: '2',
        limit: '5'
      }
    });

    expect(error).toBeUndefined();
    expect(value.query).toEqual({
      status: 'confirmed',
      page: 2,
      limit: 5
    });
  });

  it('accepts an html receipt request', () => {
    const { error, value } = getOrderReceiptSchema.validate({
      body: {},
      params: {
        id: '10'
      },
      query: {
        format: 'html'
      }
    });

    expect(error).toBeUndefined();
    expect(value.params.id).toBe(10);
    expect(value.query.format).toBe('html');
  });

  it('rejects an invalid order id parameter', () => {
    const { error } = getOrderByIdSchema.validate({
      body: {},
      params: {
        id: '0'
      },
      query: {}
    });

    expect(error).toBeDefined();
    expect(error.message).toContain('"params.id"');
  });
});
