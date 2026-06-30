require('../../setup/jest');

const { createOrdersService } = require('../../../src/services/orders.service');

describe('orders service', () => {
  let buyerAddressesRepository;
  let cartsRepository;
  let ordersRepository;
  let ordersService;

  beforeEach(() => {
    buyerAddressesRepository = {
      createBuyerAddress: jest.fn(),
      findBuyerAddressByIdForUser: jest.fn()
    };

    cartsRepository = {
      getCartByUserId: jest.fn()
    };

    ordersRepository = {
      createOrder: jest.fn()
    };

    ordersService = createOrdersService({
      buyerAddressesRepository,
      cartsRepository,
      ordersRepository
    });
  });

  it('creates an order from the authenticated buyer cart', async () => {
    cartsRepository.getCartByUserId.mockResolvedValue({
      id: 77,
      items: [
        {
          id: 21,
          product: {
            id: 4001,
            title: 'Front Brake Pad Set for Toyota Camry',
            status: 'active',
            stockQty: 18,
            seller: {
              id: 9001,
              businessName: 'Prime Auto Hub',
              rating: 4.6
            }
          },
          quantity: 2,
          unitPriceKobo: 1850000,
          lineTotalKobo: 3700000
        }
      ]
    });
    buyerAddressesRepository.createBuyerAddress.mockResolvedValue({
      id: 31,
      label: 'Workshop',
      street: '12 Adeola Odeku Street',
      city: 'Ikeja',
      state: 'Lagos',
      phone: '+2348012345678'
    });
    ordersRepository.createOrder.mockResolvedValue({
      id: 101,
      status: 'pending_payment',
      paymentMethod: 'paystack',
      paymentStatus: 'pending',
      subtotalKobo: 3700000,
      deliveryFeeKobo: 0,
      totalKobo: 3700000,
      createdAt: '2026-06-30T10:00:00.000Z',
      updatedAt: '2026-06-30T10:00:00.000Z'
    });

    const result = await ordersService.createOrder({
      userId: 5,
      paymentMethod: 'paystack',
      deliveryAddress: {
        label: 'Workshop',
        street: '12 Adeola Odeku Street',
        city: 'Ikeja',
        state: 'Lagos',
        phone: '08012345678'
      }
    });

    expect(buyerAddressesRepository.createBuyerAddress).toHaveBeenCalledWith({
      userId: 5,
      label: 'Workshop',
      street: '12 Adeola Odeku Street',
      city: 'Ikeja',
      state: 'Lagos',
      phone: '+2348012345678',
      isDefault: false
    });
    expect(ordersRepository.createOrder).toHaveBeenCalledWith(expect.objectContaining({
      buyerId: 5,
      cartId: 77,
      paymentMethod: 'paystack',
      subtotalKobo: 3700000,
      totalKobo: 3700000
    }));
    expect(result.id).toBe(101);
    expect(result.deliveryAddress.id).toBe(31);
  });

  it('rejects order creation when the cart is empty', async () => {
    cartsRepository.getCartByUserId.mockResolvedValue({
      id: 77,
      items: []
    });

    await expect(ordersService.createOrder({
      userId: 5,
      paymentMethod: 'paystack',
      deliveryAddress: {
        label: 'Workshop',
        street: '12 Adeola Odeku Street',
        city: 'Ikeja',
        state: 'Lagos',
        phone: '08012345678'
      }
    })).rejects.toMatchObject({
      statusCode: 400,
      code: 'CART_EMPTY'
    });
  });

  it('rejects an unavailable saved delivery address', async () => {
    cartsRepository.getCartByUserId.mockResolvedValue({
      id: 77,
      items: [
        {
          id: 21,
          product: {
            id: 4001,
            title: 'Front Brake Pad Set for Toyota Camry',
            status: 'active',
            stockQty: 18,
            seller: {
              id: 9001,
              businessName: 'Prime Auto Hub',
              rating: 4.6
            }
          },
          quantity: 1,
          unitPriceKobo: 1850000,
          lineTotalKobo: 1850000
        }
      ]
    });
    buyerAddressesRepository.findBuyerAddressByIdForUser.mockResolvedValue(null);

    await expect(ordersService.createOrder({
      userId: 5,
      paymentMethod: 'paystack',
      deliveryAddressId: 999
    })).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND'
    });
  });
});
