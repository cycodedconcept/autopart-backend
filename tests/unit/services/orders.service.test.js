require('../../setup/jest');

const { createOrdersService } = require('../../../src/services/orders.service');

describe('orders service', () => {
  function buildOrderRecord(overrides = {}) {
    return {
      id: 101,
      buyerId: 5,
      status: 'confirmed',
      paymentMethod: 'paystack',
      subtotalKobo: 3700000,
      deliveryFeeKobo: 205000,
      totalKobo: 3905000,
      deliveryAddressId: 31,
      deliveryLabel: 'Workshop',
      deliveryStreet: '12 Adeola Odeku Street',
      deliveryCity: 'Ikeja',
      deliveryState: 'Lagos',
      deliveryPhone: '+2348012345678',
      paymentReference: 'APT-101-REF',
      paymentStatus: 'paid',
      totalItems: 2,
      createdAt: '2026-06-30T10:00:00.000Z',
      updatedAt: '2026-06-30T10:30:00.000Z',
      ...overrides
    };
  }

  function buildOrderItems() {
    return [
      {
        id: 501,
        orderId: 101,
        productId: 4001,
        sellerId: 9001,
        quantity: 2,
        unitPriceKobo: 1850000,
        lineTotalKobo: 3700000,
        itemStatus: 'pending',
        title: 'Front Brake Pad Set for Toyota Camry',
        partNumber: 'FBP-CAM-07011',
        condition: 'new',
        location: 'Lagos',
        sellerBusinessName: 'Prime Auto Hub',
        sellerRating: 4.6,
        primaryImageUrl: 'https://example.com/products/front-brake-pad-camry-1.jpg',
        createdAt: '2026-06-30T10:00:00.000Z',
        updatedAt: '2026-06-30T10:30:00.000Z'
      }
    ];
  }

  function buildSellerAccount() {
    return {
      user: {
        id: 44,
        role: 'seller'
      },
      sellerProfile: {
        id: 9001,
        businessName: 'Prime Auto Hub'
      }
    };
  }

  function buildStatusHistory() {
    return [
      {
        id: 1,
        status: 'pending_payment',
        note: 'Order created and awaiting payment.',
        createdAt: '2026-06-30T10:00:00.000Z'
      },
      {
        id: 2,
        status: 'confirmed',
        note: 'Payment verified and order confirmed.',
        createdAt: '2026-06-30T10:30:00.000Z'
      }
    ];
  }

  let buyerAddressesRepository;
  let cartsRepository;
  let deliveryJobsRepository;
  let assignmentService;
  let ordersRepository;
  let sellersRepository;
  let ordersService;

  beforeEach(() => {
    buyerAddressesRepository = {
      createBuyerAddress: jest.fn(),
      findBuyerAddressByIdForUser: jest.fn()
    };

    cartsRepository = {
      getCartByUserId: jest.fn()
    };

    deliveryJobsRepository = {
      createJobForOrderItem: jest.fn()
    };

    assignmentService = {
      attemptAutoAssignJob: jest.fn()
    };

    ordersRepository = {
      createOrder: jest.fn(),
      findOrderByIdForBuyer: jest.fn(),
      findOrderItemsByOrderId: jest.fn(),
      findOrderItemsByOrderIdsForSeller: jest.fn(),
      findSellerOrderItemById: jest.fn(),
      findOrderStatusHistoryByOrderId: jest.fn(),
      listOrdersForBuyer: jest.fn(),
      listOrdersForSeller: jest.fn(),
      updateSellerOrderItemStatus: jest.fn()
    };

    sellersRepository = {
      findByUserId: jest.fn()
    };

    ordersService = createOrdersService({
      assignmentService,
      buyerAddressesRepository,
      cartsRepository,
      deliveryJobsRepository,
      ordersRepository,
      sellersRepository
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
            location: 'Lagos',
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
      deliveryFeeKobo: 205000,
      totalKobo: 3905000,
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
      deliveryFeeKobo: 205000,
      totalKobo: 3905000
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
            location: 'Lagos',
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

  it('lists buyer orders with pagination metadata', async () => {
    ordersRepository.listOrdersForBuyer.mockResolvedValue({
      orders: [
        buildOrderRecord(),
        buildOrderRecord({
          id: 102,
          paymentMethod: 'bank_transfer',
          paymentStatus: 'pending',
          status: 'pending_payment',
          totalItems: 1
        })
      ],
      total: 2
    });

    const result = await ordersService.listOrders({
      userId: 5,
      status: 'confirmed',
      page: 1,
      limit: 10
    });

    expect(ordersRepository.listOrdersForBuyer).toHaveBeenCalledWith({
      buyerId: 5,
      status: 'confirmed',
      limit: 10,
      offset: 0
    });
    expect(result).toEqual({
      orders: [
        {
          id: 101,
          status: 'confirmed',
          paymentMethod: 'paystack',
          paymentStatus: 'paid',
          subtotalKobo: 3700000,
          deliveryFeeKobo: 205000,
          totalKobo: 3905000,
          totalItems: 2,
          createdAt: '2026-06-30T10:00:00.000Z',
          updatedAt: '2026-06-30T10:30:00.000Z'
        },
        {
          id: 102,
          status: 'pending_payment',
          paymentMethod: 'bank_transfer',
          paymentStatus: 'pending',
          subtotalKobo: 3700000,
          deliveryFeeKobo: 205000,
          totalKobo: 3905000,
          totalItems: 1,
          createdAt: '2026-06-30T10:00:00.000Z',
          updatedAt: '2026-06-30T10:30:00.000Z'
        }
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1
      }
    });
  });

  it('returns a buyer order detail with items and status history', async () => {
    ordersRepository.findOrderByIdForBuyer.mockResolvedValue(buildOrderRecord());
    ordersRepository.findOrderItemsByOrderId.mockResolvedValue(buildOrderItems());
    ordersRepository.findOrderStatusHistoryByOrderId.mockResolvedValue(buildStatusHistory());

    const result = await ordersService.getOrderById({
      userId: 5,
      orderId: 101
    });

    expect(ordersRepository.findOrderByIdForBuyer).toHaveBeenCalledWith(101, 5);
    expect(ordersRepository.findOrderItemsByOrderId).toHaveBeenCalledWith(101, 5);
    expect(ordersRepository.findOrderStatusHistoryByOrderId).toHaveBeenCalledWith(101, 5);
    expect(result).toEqual({
      id: 101,
      status: 'confirmed',
      paymentMethod: 'paystack',
      paymentReference: 'APT-101-REF',
      paymentStatus: 'paid',
      subtotalKobo: 3700000,
      deliveryFeeKobo: 205000,
      totalKobo: 3905000,
      totalItems: 2,
      deliveryAddress: {
        id: 31,
        label: 'Workshop',
        street: '12 Adeola Odeku Street',
        city: 'Ikeja',
        state: 'Lagos',
        phone: '+2348012345678'
      },
      items: [
        {
          id: 501,
          productId: 4001,
          title: 'Front Brake Pad Set for Toyota Camry',
          partNumber: 'FBP-CAM-07011',
          condition: 'new',
          location: 'Lagos',
          quantity: 2,
          unitPriceKobo: 1850000,
          lineTotalKobo: 3700000,
          itemStatus: 'pending',
          primaryImageUrl: 'https://example.com/products/front-brake-pad-camry-1.jpg',
          seller: {
            id: 9001,
            businessName: 'Prime Auto Hub',
            rating: 4.6
          }
        }
      ],
      statusHistory: [
        {
          id: 1,
          status: 'pending_payment',
          note: 'Order created and awaiting payment.',
          createdAt: '2026-06-30T10:00:00.000Z'
        },
        {
          id: 2,
          status: 'confirmed',
          note: 'Payment verified and order confirmed.',
          createdAt: '2026-06-30T10:30:00.000Z'
        }
      ],
      createdAt: '2026-06-30T10:00:00.000Z',
      updatedAt: '2026-06-30T10:30:00.000Z'
    });
  });

  it('returns the current order status and history', async () => {
    ordersRepository.findOrderByIdForBuyer.mockResolvedValue(buildOrderRecord({
      status: 'in_transit',
      updatedAt: '2026-06-30T12:00:00.000Z'
    }));
    ordersRepository.findOrderItemsByOrderId.mockResolvedValue(buildOrderItems());
    ordersRepository.findOrderStatusHistoryByOrderId.mockResolvedValue([
      ...buildStatusHistory(),
      {
        id: 3,
        status: 'picked_up',
        note: 'Package collected from seller.',
        createdAt: '2026-06-30T11:00:00.000Z'
      },
      {
        id: 4,
        status: 'in_transit',
        note: 'Package is on the way.',
        createdAt: '2026-06-30T12:00:00.000Z'
      }
    ]);

    const result = await ordersService.getOrderStatus({
      userId: 5,
      orderId: 101
    });

    expect(result).toEqual({
      orderId: 101,
      paymentStatus: 'paid',
      currentStatus: {
        status: 'in_transit',
        updatedAt: '2026-06-30T12:00:00.000Z'
      },
      history: [
        {
          id: 1,
          status: 'pending_payment',
          note: 'Order created and awaiting payment.',
          createdAt: '2026-06-30T10:00:00.000Z'
        },
        {
          id: 2,
          status: 'confirmed',
          note: 'Payment verified and order confirmed.',
          createdAt: '2026-06-30T10:30:00.000Z'
        },
        {
          id: 3,
          status: 'picked_up',
          note: 'Package collected from seller.',
          createdAt: '2026-06-30T11:00:00.000Z'
        },
        {
          id: 4,
          status: 'in_transit',
          note: 'Package is on the way.',
          createdAt: '2026-06-30T12:00:00.000Z'
        }
      ]
    });
  });

  it('returns a JSON order receipt', async () => {
    ordersRepository.findOrderByIdForBuyer.mockResolvedValue(buildOrderRecord());
    ordersRepository.findOrderItemsByOrderId.mockResolvedValue(buildOrderItems());
    ordersRepository.findOrderStatusHistoryByOrderId.mockResolvedValue(buildStatusHistory());

    const result = await ordersService.getOrderReceipt({
      userId: 5,
      orderId: 101,
      format: 'json'
    });

    expect(result.format).toBe('json');
    expect(result.receipt).toMatchObject({
      receiptNumber: 'RCPT-101',
      orderId: 101,
      status: 'confirmed',
      paymentMethod: 'paystack',
      paymentReference: 'APT-101-REF',
      paymentStatus: 'paid',
      totalKobo: 3905000,
      totalItems: 2
    });
    expect(result.receipt.items).toHaveLength(1);
    expect(result.receipt.statusHistory).toHaveLength(2);
  });

  it('returns an HTML order receipt when requested', async () => {
    ordersRepository.findOrderByIdForBuyer.mockResolvedValue(buildOrderRecord());
    ordersRepository.findOrderItemsByOrderId.mockResolvedValue(buildOrderItems());
    ordersRepository.findOrderStatusHistoryByOrderId.mockResolvedValue(buildStatusHistory());

    const result = await ordersService.getOrderReceipt({
      userId: 5,
      orderId: 101,
      format: 'html'
    });

    expect(result).toEqual(expect.objectContaining({
      format: 'html'
    }));
    expect(result.html).toContain('AutoParts Marketplace Receipt');
    expect(result.html).toContain('Front Brake Pad Set for Toyota Camry');
    expect(result.html).toContain('RCPT-101');
  });

  it('lists seller-scoped orders with only the seller items attached', async () => {
    sellersRepository.findByUserId.mockResolvedValue(buildSellerAccount());
    ordersRepository.listOrdersForSeller.mockResolvedValue({
      orders: [
        {
          ...buildOrderRecord(),
          sellerLineItems: 1,
          sellerTotalItems: 2,
          sellerTotalKobo: 3700000
        }
      ],
      total: 1
    });
    ordersRepository.findOrderItemsByOrderIdsForSeller.mockResolvedValue(buildOrderItems());

    const result = await ordersService.listSellerOrders({
      userId: 44,
      query: {
        itemStatus: 'pending',
        page: 1,
        limit: 10
      }
    });

    expect(sellersRepository.findByUserId).toHaveBeenCalledWith(44);
    expect(ordersRepository.listOrdersForSeller).toHaveBeenCalledWith({
      sellerId: 9001,
      itemStatus: 'pending',
      limit: 10,
      offset: 0
    });
    expect(ordersRepository.findOrderItemsByOrderIdsForSeller).toHaveBeenCalledWith([101], 9001);
    expect(result).toEqual({
      orders: [
        {
          id: 101,
          status: 'confirmed',
          paymentMethod: 'paystack',
          paymentReference: 'APT-101-REF',
          paymentStatus: 'paid',
          subtotalKobo: 3700000,
          deliveryFeeKobo: 205000,
          totalKobo: 3905000,
          totalItems: 2,
          sellerLineItems: 1,
          sellerTotalItems: 2,
          sellerTotalKobo: 3700000,
          deliveryAddress: {
            id: 31,
            label: 'Workshop',
            street: '12 Adeola Odeku Street',
            city: 'Ikeja',
            state: 'Lagos',
            phone: '+2348012345678'
          },
          items: [
            {
              id: 501,
              productId: 4001,
              title: 'Front Brake Pad Set for Toyota Camry',
              partNumber: 'FBP-CAM-07011',
              condition: 'new',
              location: 'Lagos',
              quantity: 2,
              unitPriceKobo: 1850000,
              lineTotalKobo: 3700000,
              itemStatus: 'pending',
              primaryImageUrl: 'https://example.com/products/front-brake-pad-camry-1.jpg',
              seller: {
                id: 9001,
                businessName: 'Prime Auto Hub',
                rating: 4.6
              }
            }
          ],
          createdAt: '2026-06-30T10:00:00.000Z',
          updatedAt: '2026-06-30T10:30:00.000Z'
        }
      ],
      pagination: {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1
      }
    });
  });

  it('updates a seller-owned order item to ready_for_pickup', async () => {
    sellersRepository.findByUserId.mockResolvedValue(buildSellerAccount());
    ordersRepository.findSellerOrderItemById.mockResolvedValue({
      ...buildOrderItems()[0],
      orderStatus: 'confirmed',
      paymentMethod: 'paystack',
      paymentReference: 'APT-101-REF',
      paymentStatus: 'paid'
    });
    ordersRepository.updateSellerOrderItemStatus.mockResolvedValue({
      ...buildOrderItems()[0],
      itemStatus: 'ready_for_pickup',
      orderStatus: 'confirmed',
      paymentMethod: 'paystack',
      paymentReference: 'APT-101-REF',
      paymentStatus: 'paid'
    });
    deliveryJobsRepository.createJobForOrderItem.mockResolvedValue({
      id: 801
    });

    const result = await ordersService.updateSellerOrderItemStatus({
      userId: 44,
      orderItemId: 501,
      itemStatus: 'ready_for_pickup'
    });

    expect(ordersRepository.findSellerOrderItemById).toHaveBeenCalledWith(501, 9001);
    expect(ordersRepository.updateSellerOrderItemStatus).toHaveBeenCalledWith({
      orderItemId: 501,
      sellerId: 9001,
      itemStatus: 'ready_for_pickup'
    });
    expect(deliveryJobsRepository.createJobForOrderItem).toHaveBeenCalledWith({
      orderItemId: 501,
      sellerId: 9001
    });
    expect(assignmentService.attemptAutoAssignJob).toHaveBeenCalledWith({
      jobId: 801
    });
    expect(result).toEqual({
      id: 501,
      productId: 4001,
      title: 'Front Brake Pad Set for Toyota Camry',
      partNumber: 'FBP-CAM-07011',
      condition: 'new',
      location: 'Lagos',
      quantity: 2,
      unitPriceKobo: 1850000,
      lineTotalKobo: 3700000,
      itemStatus: 'ready_for_pickup',
      primaryImageUrl: 'https://example.com/products/front-brake-pad-camry-1.jpg',
      seller: {
        id: 9001,
        businessName: 'Prime Auto Hub',
        rating: 4.6
      },
      order: {
        id: 101,
        status: 'confirmed',
        paymentMethod: 'paystack',
        paymentReference: 'APT-101-REF',
        paymentStatus: 'paid'
      },
      createdAt: '2026-06-30T10:00:00.000Z',
      updatedAt: '2026-06-30T10:30:00.000Z'
    });
  });

  it('rejects seller updates on unpaid order items', async () => {
    sellersRepository.findByUserId.mockResolvedValue(buildSellerAccount());
    ordersRepository.findSellerOrderItemById.mockResolvedValue({
      ...buildOrderItems()[0],
      orderStatus: 'pending_payment',
      paymentMethod: 'paystack',
      paymentReference: null,
      paymentStatus: 'pending'
    });

    await expect(ordersService.updateSellerOrderItemStatus({
      userId: 44,
      orderItemId: 501,
      itemStatus: 'ready_for_pickup'
    })).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT'
    });
  });
});
