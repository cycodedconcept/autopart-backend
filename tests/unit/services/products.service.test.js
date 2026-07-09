require('../../setup/jest');

const { createProductsService } = require('../../../src/services/products.service');

describe('products service', () => {
  let productsRepository;
  let sellersRepository;
  let productsService;

  beforeEach(() => {
    productsRepository = {
      createSellerProductsBulk: jest.fn(),
      createSellerProduct: jest.fn(),
      deactivateOwnedProduct: jest.fn(),
      findCategoriesByIds: jest.fn(),
      findCategoryById: jest.fn(),
      findOwnedProductById: jest.fn(),
      findProductById: jest.fn(),
      findProductCompatibilityByProductId: jest.fn(),
      findProductImagesByProductId: jest.fn(),
      findVehicleTaxonomyEntry: jest.fn(),
      listProducts: jest.fn(),
      listSellerProducts: jest.fn(),
      summarizeSellerInventory: jest.fn(),
      updateOwnedProduct: jest.fn()
    };

    sellersRepository = {
      findByUserId: jest.fn()
    };

    productsRepository.findVehicleTaxonomyEntry.mockResolvedValue({
      id: 3001,
      make: 'Toyota',
      model: 'Camry',
      yearFrom: 2007,
      yearTo: 2011
    });

    productsService = createProductsService({
      productsRepository,
      sellersRepository
    });
  });

  describe('listProducts', () => {
    it('returns mapped products with pagination metadata', async () => {
      productsRepository.listProducts.mockResolvedValue({
        products: [
          {
            id: 4001,
            sellerId: 9001,
            title: 'Front Brake Pad Set for Toyota Camry',
            categoryId: 1002,
            categoryName: 'Brake System',
            categorySlug: 'brake-system',
            partNumber: 'FBP-CAM-07011',
            condition: 'new',
            priceKobo: 1850000,
            stockQty: 18,
            location: 'Lagos',
            sellerBusinessName: 'Prime Auto Hub',
            sellerRating: 4.6,
            primaryImageUrl: 'https://example.com/products/front-brake-pad-camry-1.jpg'
          }
        ],
        total: 1
      });

      const result = await productsService.listProducts({
        partName: 'Brake Pad',
        vehicleMake: 'Toyota',
        vehicleModel: 'Camry',
        vehicleYear: 2010,
        condition: 'new',
        page: 2,
        limit: 5
      });

      expect(productsRepository.listProducts).toHaveBeenCalledWith({
        partName: 'Brake Pad',
        vehicleMake: 'Toyota',
        vehicleModel: 'Camry',
        vehicleYear: 2010,
        category: null,
        partNumber: null,
        condition: 'new',
        minPriceKobo: null,
        maxPriceKobo: null,
        location: null,
        sellerRating: null,
        sellerBusinessName: null,
        page: 2,
        limit: 5,
        offset: 5
      });
      expect(result).toEqual({
        products: [
          {
            id: 4001,
            title: 'Front Brake Pad Set for Toyota Camry',
            category: {
              id: 1002,
              name: 'Brake System',
              slug: 'brake-system'
            },
            partNumber: 'FBP-CAM-07011',
            condition: 'new',
            priceKobo: 1850000,
            stockQty: 18,
            location: 'Lagos',
            seller: {
              id: 9001,
              businessName: 'Prime Auto Hub',
              rating: 4.6
            },
            primaryImageUrl: 'https://example.com/products/front-brake-pad-camry-1.jpg'
          }
        ],
        pagination: {
          page: 2,
          limit: 5,
          total: 1,
          totalPages: 1
        }
      });
    });
  });

  describe('getProductById', () => {
    it('returns a full product detail payload', async () => {
      productsRepository.findProductById.mockResolvedValue({
        id: 4004,
        sellerId: 9004,
        title: 'Starter Motor for Lexus RX 330',
        description: 'Refurbished starter motor tested for dependable ignition performance.',
        categoryId: 1004,
        categoryName: 'Electrical & Lighting',
        categorySlug: 'electrical-lighting',
        partNumber: 'SM-RX330-0406',
        condition: 'refurbished',
        priceKobo: 3800000,
        stockQty: 4,
        location: 'Lagos',
        sellerBusinessName: 'Elite Mobility Parts',
        sellerRating: 4.9,
        primaryImageUrl: 'https://example.com/products/starter-motor-rx330-1.jpg'
      });
      productsRepository.findProductImagesByProductId.mockResolvedValue([
        {
          id: 5006,
          url: 'https://example.com/products/starter-motor-rx330-1.jpg',
          position: 1
        }
      ]);
      productsRepository.findProductCompatibilityByProductId.mockResolvedValue([
        {
          id: 6004,
          make: 'Lexus',
          model: 'RX 330',
          yearFrom: 2004,
          yearTo: 2006
        }
      ]);

      const result = await productsService.getProductById(4004);

      expect(productsRepository.findProductById).toHaveBeenCalledWith(4004);
      expect(result).toEqual({
        id: 4004,
        title: 'Starter Motor for Lexus RX 330',
        description: 'Refurbished starter motor tested for dependable ignition performance.',
        category: {
          id: 1004,
          name: 'Electrical & Lighting',
          slug: 'electrical-lighting'
        },
        partNumber: 'SM-RX330-0406',
        condition: 'refurbished',
        priceKobo: 3800000,
        stockQty: 4,
        location: 'Lagos',
        seller: {
          id: 9004,
          businessName: 'Elite Mobility Parts',
          rating: 4.9
        },
        primaryImageUrl: 'https://example.com/products/starter-motor-rx330-1.jpg',
        photos: [
          {
            id: 5006,
            url: 'https://example.com/products/starter-motor-rx330-1.jpg',
            position: 1
          }
        ],
        compatibility: [
          {
            id: 6004,
            make: 'Lexus',
            model: 'RX 330',
            yearFrom: 2004,
            yearTo: 2006
          }
        ]
      });
    });

    it('throws a not-found error when a product does not exist', async () => {
      productsRepository.findProductById.mockResolvedValue(null);

      await expect(productsService.getProductById(9999)).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND'
      });
    });
  });

  describe('createSellerProduct', () => {
    it('creates a seller-owned product with photos and compatibility', async () => {
      sellersRepository.findByUserId.mockResolvedValue({
        sellerProfile: {
          id: 77,
          businessName: 'Prime Auto Hub',
          rating: 4.6
        }
      });
      productsRepository.findCategoryById.mockResolvedValue({
        id: 1002,
        name: 'Brake System',
        slug: 'brake-system'
      });
      productsRepository.createSellerProduct.mockResolvedValue({
        id: 5001,
        sellerId: 77,
        title: 'Front Brake Disc',
        description: 'Premium brake disc for Toyota Camry.',
        categoryId: 1002,
        categoryName: 'Brake System',
        categorySlug: 'brake-system',
        partNumber: 'DISC-001',
        condition: 'new',
        priceKobo: 4500000,
        stockQty: 12,
        location: 'Lagos',
        sellerBusinessName: 'Prime Auto Hub',
        sellerRating: 4.6,
        status: 'active',
        primaryImageUrl: 'uploads/product-images/disc-1.png',
        createdAt: '2026-07-02T10:00:00.000Z',
        updatedAt: '2026-07-02T10:00:00.000Z'
      });
      productsRepository.findProductImagesByProductId.mockResolvedValue([
        {
          id: 1,
          url: 'uploads/product-images/disc-1.png',
          position: 1
        }
      ]);
      productsRepository.findProductCompatibilityByProductId.mockResolvedValue([
        {
          id: 11,
          make: 'Toyota',
          model: 'Camry',
          yearFrom: 2007,
          yearTo: 2011
        }
      ]);

      const result = await productsService.createSellerProduct({
        userId: 9,
        title: 'Front Brake Disc',
        description: 'Premium brake disc for Toyota Camry.',
        categoryId: 1002,
        partNumber: 'DISC-001',
        condition: 'new',
        priceKobo: 4500000,
        stockQty: 12,
        location: 'Lagos',
        compatibility: [
          {
            make: 'Toyota',
            model: 'Camry',
            yearFrom: 2007,
            yearTo: 2011
          }
        ],
        photos: [
          {
            filePath: 'uploads/product-images/disc-1.png',
            position: 1
          }
        ]
      });

      expect(productsRepository.createSellerProduct).toHaveBeenCalledWith({
        sellerId: 77,
        sellerBusinessName: 'Prime Auto Hub',
        sellerRating: 4.6,
        title: 'Front Brake Disc',
        description: 'Premium brake disc for Toyota Camry.',
        categoryId: 1002,
        categoryName: 'Brake System',
        categorySlug: 'brake-system',
        partNumber: 'DISC-001',
        condition: 'new',
        priceKobo: 4500000,
        stockQty: 12,
        location: 'Lagos',
        status: 'active',
        photos: [
          {
            filePath: 'uploads/product-images/disc-1.png',
            position: 1
          }
        ],
        compatibility: [
          {
            make: 'Toyota',
            model: 'Camry',
            yearFrom: 2007,
            yearTo: 2011
          }
        ]
      });
      expect(result.status).toBe('active');
      expect(result.photos).toHaveLength(1);
      expect(result.compatibility).toHaveLength(1);
    });

    it('rejects compatibility entries that are missing from the vehicle taxonomy', async () => {
      sellersRepository.findByUserId.mockResolvedValue({
        sellerProfile: {
          id: 77,
          businessName: 'Prime Auto Hub',
          rating: 4.6
        }
      });
      productsRepository.findCategoryById.mockResolvedValue({
        id: 1002,
        name: 'Brake System',
        slug: 'brake-system'
      });
      productsRepository.findVehicleTaxonomyEntry.mockResolvedValue(null);

      await expect(productsService.createSellerProduct({
        userId: 9,
        title: 'Front Brake Disc',
        description: 'Premium brake disc for Toyota Camry.',
        categoryId: 1002,
        partNumber: 'DISC-001',
        condition: 'new',
        priceKobo: 4500000,
        stockQty: 12,
        location: 'Lagos',
        compatibility: [
          {
            make: 'Toyota',
            model: 'Yaris',
            yearFrom: 2017,
            yearTo: 2020
          }
        ],
        photos: [
          {
            filePath: 'uploads/product-images/disc-1.png',
            position: 1
          }
        ]
      })).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND'
      });
    });
  });

  describe('listSellerProducts', () => {
    it('returns the authenticated seller inventory with pagination', async () => {
      sellersRepository.findByUserId.mockResolvedValue({
        sellerProfile: {
          id: 77
        }
      });
      productsRepository.listSellerProducts.mockResolvedValue({
        products: [
          {
            id: 5001,
            sellerId: 77,
            title: 'Front Brake Disc',
            categoryId: 1002,
            categoryName: 'Brake System',
            categorySlug: 'brake-system',
            partNumber: 'DISC-001',
            condition: 'new',
            priceKobo: 4500000,
            stockQty: 12,
            location: 'Lagos',
            sellerBusinessName: 'Prime Auto Hub',
            sellerRating: 4.6,
            status: 'active',
            primaryImageUrl: 'uploads/product-images/disc-1.png',
            createdAt: '2026-07-02T10:00:00.000Z',
            updatedAt: '2026-07-02T10:00:00.000Z'
          }
        ],
        total: 1
      });

      const result = await productsService.listSellerProducts({
        userId: 9,
        query: {
          status: 'active',
          page: 1,
          limit: 10
        }
      });

      expect(productsRepository.listSellerProducts).toHaveBeenCalledWith({
        sellerId: 77,
        status: 'active',
        page: 1,
        limit: 10,
        offset: 0
      });
      expect(result.products[0].status).toBe('active');
      expect(result.pagination.total).toBe(1);
    });
  });

  describe('getSellerInventory', () => {
    it('returns seller inventory with low-stock flags and summary data', async () => {
      sellersRepository.findByUserId.mockResolvedValue({
        sellerProfile: {
          id: 77
        }
      });
      productsRepository.listSellerProducts.mockResolvedValue({
        products: [
          {
            id: 5001,
            sellerId: 77,
            title: 'Front Brake Disc',
            categoryId: 1002,
            categoryName: 'Brake System',
            categorySlug: 'brake-system',
            partNumber: 'DISC-001',
            condition: 'new',
            priceKobo: 4500000,
            stockQty: 3,
            location: 'Lagos',
            sellerBusinessName: 'Prime Auto Hub',
            sellerRating: 4.6,
            status: 'active',
            primaryImageUrl: 'uploads/product-images/disc-1.png',
            createdAt: '2026-07-02T10:00:00.000Z',
            updatedAt: '2026-07-02T10:00:00.000Z'
          }
        ],
        total: 1
      });
      productsRepository.summarizeSellerInventory.mockResolvedValue({
        totalListings: 2,
        activeListings: 1,
        inactiveListings: 1,
        outOfStockListings: 0,
        lowStockListings: 1,
        totalUnitsInStock: 3
      });

      const result = await productsService.getSellerInventory({
        userId: 9,
        query: {
          status: 'all',
          lowStockOnly: true,
          page: 1,
          limit: 10
        }
      });

      expect(productsRepository.listSellerProducts).toHaveBeenCalledWith({
        sellerId: 77,
        status: 'all',
        lowStockOnly: true,
        lowStockThreshold: 5,
        page: 1,
        limit: 10,
        offset: 0
      });
      expect(productsRepository.summarizeSellerInventory).toHaveBeenCalledWith({
        sellerId: 77,
        lowStockThreshold: 5
      });
      expect(result.summary.lowStockThreshold).toBe(5);
      expect(result.inventory[0].isLowStock).toBe(true);
      expect(result.inventory[0].isOutOfStock).toBe(false);
    });
  });

  describe('bulkUploadSellerInventory', () => {
    it('creates multiple seller listings from a csv upload', async () => {
      sellersRepository.findByUserId.mockResolvedValue({
        sellerProfile: {
          id: 77,
          businessName: 'Prime Auto Hub',
          rating: 4.6
        }
      });
      productsRepository.findCategoriesByIds.mockResolvedValue([
        {
          id: 1002,
          name: 'Brake System',
          slug: 'brake-system'
        },
        {
          id: 1003,
          name: 'Suspension & Steering',
          slug: 'suspension-steering'
        }
      ]);
      productsRepository.createSellerProductsBulk.mockResolvedValue([
        {
          id: 5001,
          sellerId: 77,
          title: 'Front Brake Disc',
          categoryId: 1002,
          categoryName: 'Brake System',
          categorySlug: 'brake-system',
          partNumber: 'DISC-001',
          condition: 'new',
          priceKobo: 4500000,
          stockQty: 12,
          location: 'Lagos',
          sellerBusinessName: 'Prime Auto Hub',
          sellerRating: 4.6,
          status: 'active',
          primaryImageUrl: 'https://example.com/disc-1.png',
          createdAt: '2026-07-02T10:00:00.000Z',
          updatedAt: '2026-07-02T10:00:00.000Z'
        },
        {
          id: 5002,
          sellerId: 77,
          title: 'Rear Shock Absorber',
          categoryId: 1003,
          categoryName: 'Suspension & Steering',
          categorySlug: 'suspension-steering',
          partNumber: 'SHOCK-001',
          condition: 'new',
          priceKobo: 5200000,
          stockQty: 4,
          location: 'Abuja',
          sellerBusinessName: 'Prime Auto Hub',
          sellerRating: 4.6,
          status: 'inactive',
          primaryImageUrl: 'https://example.com/shock-1.png',
          createdAt: '2026-07-02T10:00:00.000Z',
          updatedAt: '2026-07-02T10:00:00.000Z'
        }
      ]);

      const result = await productsService.bulkUploadSellerInventory({
        userId: 9,
        csvUpload: {
          buffer: Buffer.from([
            'title,description,categoryId,partNumber,condition,priceKobo,stockQty,location,status,compatibleMake,compatibleModel,compatibleYearFrom,compatibleYearTo,imageUrls',
            'Front Brake Disc,"Premium brake disc for Toyota Camry sedans.",1002,DISC-001,new,4500000,12,Lagos,active,Toyota,Camry,2007,2011,https://example.com/disc-1.png',
            'Rear Shock Absorber,"Gas-filled rear shock absorber for Honda Accord.",1003,SHOCK-001,new,5200000,4,Abuja,inactive,Honda,Accord,2008,2012,https://example.com/shock-1.png|https://example.com/shock-2.png'
          ].join('\n'))
        }
      });

      expect(productsRepository.createSellerProductsBulk).toHaveBeenCalledWith({
        sellerId: 77,
        sellerBusinessName: 'Prime Auto Hub',
        sellerRating: 4.6,
        products: [
          {
            title: 'Front Brake Disc',
            description: 'Premium brake disc for Toyota Camry sedans.',
            categoryId: 1002,
            categoryName: 'Brake System',
            categorySlug: 'brake-system',
            partNumber: 'DISC-001',
            condition: 'new',
            priceKobo: 4500000,
            stockQty: 12,
            location: 'Lagos',
            status: 'active',
            photos: [
              {
                filePath: 'https://example.com/disc-1.png',
                position: 1
              }
            ],
            compatibility: [
              {
                make: 'Toyota',
                model: 'Camry',
                yearFrom: 2007,
                yearTo: 2011
              }
            ]
          },
          {
            title: 'Rear Shock Absorber',
            description: 'Gas-filled rear shock absorber for Honda Accord.',
            categoryId: 1003,
            categoryName: 'Suspension & Steering',
            categorySlug: 'suspension-steering',
            partNumber: 'SHOCK-001',
            condition: 'new',
            priceKobo: 5200000,
            stockQty: 4,
            location: 'Abuja',
            status: 'inactive',
            photos: [
              {
                filePath: 'https://example.com/shock-1.png',
                position: 1
              },
              {
                filePath: 'https://example.com/shock-2.png',
                position: 2
              }
            ],
            compatibility: [
              {
                make: 'Honda',
                model: 'Accord',
                yearFrom: 2008,
                yearTo: 2012
              }
            ]
          }
        ]
      });
      expect(result.createdCount).toBe(2);
      expect(result.products[1].isLowStock).toBe(true);
    });
  });

  describe('updateSellerProduct', () => {
    it('updates an owned seller product', async () => {
      sellersRepository.findByUserId.mockResolvedValue({
        sellerProfile: {
          id: 77
        }
      });
      productsRepository.findOwnedProductById.mockResolvedValue({
        id: 5001,
        sellerId: 77
      });
      productsRepository.findCategoryById.mockResolvedValue({
        id: 1003,
        name: 'Suspension & Steering',
        slug: 'suspension-steering'
      });
      productsRepository.updateOwnedProduct.mockResolvedValue({
        id: 5001,
        sellerId: 77,
        title: 'Rear Shock Absorber Pair',
        description: 'Updated description',
        categoryId: 1003,
        categoryName: 'Suspension & Steering',
        categorySlug: 'suspension-steering',
        partNumber: 'RSA-002',
        condition: 'new',
        priceKobo: 5200000,
        stockQty: 8,
        location: 'Abuja',
        sellerBusinessName: 'Prime Auto Hub',
        sellerRating: 4.6,
        status: 'active',
        primaryImageUrl: 'uploads/product-images/rear-shock.png',
        createdAt: '2026-07-02T10:00:00.000Z',
        updatedAt: '2026-07-02T11:00:00.000Z'
      });
      productsRepository.findProductImagesByProductId.mockResolvedValue([
        {
          id: 2,
          url: 'uploads/product-images/rear-shock.png',
          position: 1
        }
      ]);
      productsRepository.findProductCompatibilityByProductId.mockResolvedValue([
        {
          id: 12,
          make: 'Honda',
          model: 'Accord',
          yearFrom: 2008,
          yearTo: 2012
        }
      ]);

      const result = await productsService.updateSellerProduct({
        userId: 9,
        productId: 5001,
        categoryId: 1003,
        priceKobo: 5200000,
        stockQty: 8,
        compatibility: [
          {
            make: 'Honda',
            model: 'Accord',
            yearFrom: 2008,
            yearTo: 2012
          }
        ],
        photos: [
          {
            filePath: 'uploads/product-images/rear-shock.png',
            position: 1
          }
        ]
      });

      expect(productsRepository.updateOwnedProduct).toHaveBeenCalledWith(
        5001,
        77,
        {
          fields: [
            {
              column: 'category_id',
              value: 1003
            },
            {
              column: 'price_kobo',
              value: 5200000
            },
            {
              column: 'stock_qty',
              value: 8
            }
          ],
          photos: [
            {
              filePath: 'uploads/product-images/rear-shock.png',
              position: 1
            }
          ],
          compatibility: [
            {
              make: 'Honda',
              model: 'Accord',
              yearFrom: 2008,
              yearTo: 2012
            }
          ]
        }
      );
      expect(result.priceKobo).toBe(5200000);
    });
  });

  describe('deleteSellerProduct', () => {
    it('soft-deletes an owned seller product', async () => {
      sellersRepository.findByUserId.mockResolvedValue({
        sellerProfile: {
          id: 77
        }
      });
      productsRepository.findOwnedProductById.mockResolvedValue({
        id: 5001,
        sellerId: 77
      });
      productsRepository.deactivateOwnedProduct.mockResolvedValue({
        id: 5001,
        sellerId: 77,
        title: 'Front Brake Disc',
        description: 'Premium brake disc.',
        categoryId: 1002,
        categoryName: 'Brake System',
        categorySlug: 'brake-system',
        partNumber: 'DISC-001',
        condition: 'new',
        priceKobo: 4500000,
        stockQty: 12,
        location: 'Lagos',
        sellerBusinessName: 'Prime Auto Hub',
        sellerRating: 4.6,
        status: 'inactive',
        primaryImageUrl: 'uploads/product-images/disc-1.png',
        createdAt: '2026-07-02T10:00:00.000Z',
        updatedAt: '2026-07-02T11:00:00.000Z'
      });
      productsRepository.findProductImagesByProductId.mockResolvedValue([
        {
          id: 1,
          url: 'uploads/product-images/disc-1.png',
          position: 1
        }
      ]);
      productsRepository.findProductCompatibilityByProductId.mockResolvedValue([
        {
          id: 11,
          make: 'Toyota',
          model: 'Camry',
          yearFrom: 2007,
          yearTo: 2011
        }
      ]);

      const result = await productsService.deleteSellerProduct({
        userId: 9,
        productId: 5001
      });

      expect(productsRepository.deactivateOwnedProduct).toHaveBeenCalledWith(5001, 77);
      expect(result.status).toBe('inactive');
    });
  });
});
