require('../../setup/jest');

const { createCartService } = require('../../../src/services/cart.service');

describe('cart service', () => {
  let cartsRepository;
  let productsRepository;
  let cartService;

  beforeEach(() => {
    cartsRepository = {
      createCartItem: jest.fn(),
      deleteCartItem: jest.fn(),
      ensureCartForUserId: jest.fn(),
      findCartItemByIdForUser: jest.fn(),
      findCartItemByProductId: jest.fn(),
      getCartByUserId: jest.fn(),
      updateCartItemQuantity: jest.fn()
    };

    productsRepository = {
      findProductById: jest.fn()
    };

    cartService = createCartService({
      cartsRepository,
      productsRepository
    });
  });

  it('returns an empty cart summary', async () => {
    cartsRepository.getCartByUserId.mockResolvedValue({
      id: 1,
      items: []
    });

    const result = await cartService.getCart(5);

    expect(result).toEqual({
      id: 1,
      items: [],
      summary: {
        itemCount: 0,
        subtotalKobo: 0,
        deliveryFeeKobo: 0,
        totalKobo: 0
      }
    });
  });

  it('adds a new product to the cart', async () => {
    productsRepository.findProductById.mockResolvedValue({
      id: 4001,
      priceKobo: 1850000,
      stockQty: 18
    });
    cartsRepository.ensureCartForUserId.mockResolvedValue({
      id: 11
    });
    cartsRepository.findCartItemByProductId.mockResolvedValue(null);
    cartsRepository.getCartByUserId.mockResolvedValue({
      id: 11,
      items: [
        {
          id: 21,
          quantity: 2,
          unitPriceKobo: 1850000,
          lineTotalKobo: 3700000,
          product: {
            id: 4001,
            title: 'Front Brake Pad Set for Toyota Camry',
            partNumber: 'FBP-CAM-07011',
            condition: 'new',
            location: 'Lagos',
            stockQty: 18,
            status: 'active',
            primaryImageUrl: 'https://example.com/products/front-brake-pad-camry-1.jpg',
            seller: {
              id: 9001,
              businessName: 'Prime Auto Hub',
              rating: 4.6
            }
          }
        }
      ]
    });

    const result = await cartService.addItem({
      userId: 5,
      productId: 4001,
      quantity: 2
    });

    expect(cartsRepository.createCartItem).toHaveBeenCalledWith({
      cartId: 11,
      productId: 4001,
      quantity: 2,
      unitPriceKobo: 1850000
    });
    expect(result.summary.subtotalKobo).toBe(3700000);
  });

  it('updates an existing cart item quantity', async () => {
    cartsRepository.findCartItemByIdForUser.mockResolvedValue({
      id: 21,
      productId: 4001,
      quantity: 2
    });
    productsRepository.findProductById.mockResolvedValue({
      id: 4001,
      priceKobo: 1850000,
      stockQty: 18
    });
    cartsRepository.getCartByUserId.mockResolvedValue({
      id: 11,
      items: [
        {
          id: 21,
          quantity: 4,
          unitPriceKobo: 1850000,
          lineTotalKobo: 7400000,
          product: {
            id: 4001,
            title: 'Front Brake Pad Set for Toyota Camry',
            partNumber: 'FBP-CAM-07011',
            condition: 'new',
            location: 'Lagos',
            stockQty: 18,
            status: 'active',
            primaryImageUrl: 'https://example.com/products/front-brake-pad-camry-1.jpg',
            seller: {
              id: 9001,
              businessName: 'Prime Auto Hub',
              rating: 4.6
            }
          }
        }
      ]
    });

    const result = await cartService.updateItemQuantity({
      userId: 5,
      cartItemId: 21,
      quantity: 4
    });

    expect(cartsRepository.updateCartItemQuantity).toHaveBeenCalledWith(21, 4);
    expect(result.summary.itemCount).toBe(4);
  });

  it('removes a cart item', async () => {
    cartsRepository.findCartItemByIdForUser.mockResolvedValue({
      id: 21,
      productId: 4001
    });
    cartsRepository.getCartByUserId.mockResolvedValue({
      id: 11,
      items: []
    });

    const result = await cartService.removeItem({
      userId: 5,
      cartItemId: 21
    });

    expect(cartsRepository.deleteCartItem).toHaveBeenCalledWith(21);
    expect(result.items).toEqual([]);
  });

  it('rejects quantities above available stock', async () => {
    cartsRepository.findCartItemByIdForUser.mockResolvedValue({
      id: 21,
      productId: 4001,
      quantity: 2
    });
    productsRepository.findProductById.mockResolvedValue({
      id: 4001,
      stockQty: 1
    });

    await expect(cartService.updateItemQuantity({
      userId: 5,
      cartItemId: 21,
      quantity: 3
    })).rejects.toMatchObject({
      statusCode: 409,
      code: 'OUT_OF_STOCK'
    });
  });
});
