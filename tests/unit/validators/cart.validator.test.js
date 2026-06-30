require('../../setup/jest');

const {
  addCartItemSchema,
  deleteCartItemSchema,
  getCartSchema,
  updateCartItemSchema
} = require('../../../src/validators/cart.validator');

describe('cart validator', () => {
  it('accepts an empty get-cart request', () => {
    const { error } = getCartSchema.validate({
      body: {},
      params: {},
      query: {}
    });

    expect(error).toBeUndefined();
  });

  it('accepts a valid add-item payload', () => {
    const { error, value } = addCartItemSchema.validate({
      body: {
        productId: '4001',
        quantity: '2'
      },
      params: {},
      query: {}
    });

    expect(error).toBeUndefined();
    expect(value.body).toEqual({
      productId: 4001,
      quantity: 2
    });
  });

  it('rejects an invalid cart item id param', () => {
    const { error } = deleteCartItemSchema.validate({
      body: {},
      params: {
        id: '0'
      },
      query: {}
    });

    expect(error).toBeDefined();
    expect(error.message).toContain('"params.id"');
  });

  it('rejects a zero quantity update', () => {
    const { error } = updateCartItemSchema.validate({
      body: {
        quantity: 0
      },
      params: {
        id: 5
      },
      query: {}
    });

    expect(error).toBeDefined();
    expect(error.message).toContain('"body.quantity"');
  });
});
