require('../../setup/jest');

const { createOrderSchema } = require('../../../src/validators/orders.validator');

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
});
