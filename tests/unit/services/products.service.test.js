require('../../setup/jest');

const { createProductsService } = require('../../../src/services/products.service');

describe('products service', () => {
  let productsRepository;
  let productsService;

  beforeEach(() => {
    productsRepository = {
      findProductById: jest.fn(),
      findProductCompatibilityByProductId: jest.fn(),
      findProductImagesByProductId: jest.fn(),
      listProducts: jest.fn()
    };

    productsService = createProductsService({
      productsRepository
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
});
