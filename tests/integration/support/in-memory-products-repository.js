function createCatalogueFixture() {
  return [
    {
      id: 4001,
      sellerId: 9001,
      title: 'Front Brake Pad Set for Toyota Camry',
      description: 'Durable ceramic front brake pad set designed for reliable everyday stopping power.',
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
      status: 'active',
      createdAt: '2026-06-30T08:00:00.000Z',
      updatedAt: '2026-06-30T08:00:00.000Z',
      images: [
        {
          id: 5001,
          productId: 4001,
          url: 'https://example.com/products/front-brake-pad-camry-1.jpg',
          position: 1
        },
        {
          id: 5002,
          productId: 4001,
          url: 'https://example.com/products/front-brake-pad-camry-2.jpg',
          position: 2
        }
      ],
      compatibility: [
        {
          id: 6001,
          productId: 4001,
          make: 'Toyota',
          model: 'Camry',
          yearFrom: 2007,
          yearTo: 2011
        }
      ]
    },
    {
      id: 4002,
      sellerId: 9002,
      title: 'Rear Shock Absorber Pair for Honda Accord',
      description: 'Gas-filled rear shock absorber pair built to restore ride comfort and handling.',
      categoryId: 1003,
      categoryName: 'Suspension & Steering',
      categorySlug: 'suspension-steering',
      partNumber: 'RSA-ACC-0812',
      condition: 'new',
      priceKobo: 4200000,
      stockQty: 9,
      location: 'Abuja',
      sellerBusinessName: 'Savannah Parts Depot',
      sellerRating: 4.2,
      status: 'active',
      createdAt: '2026-06-29T08:00:00.000Z',
      updatedAt: '2026-06-29T08:00:00.000Z',
      images: [
        {
          id: 5003,
          productId: 4002,
          url: 'https://example.com/products/rear-shock-accord-1.jpg',
          position: 1
        }
      ],
      compatibility: [
        {
          id: 6002,
          productId: 4002,
          make: 'Honda',
          model: 'Accord',
          yearFrom: 2008,
          yearTo: 2012
        }
      ]
    },
    {
      id: 4003,
      sellerId: 9003,
      title: 'Air Filter for Toyota Corolla 2014-2019',
      description: 'OEM-style engine air filter that improves airflow and keeps dust out of the intake system.',
      categoryId: 1005,
      categoryName: 'Filters',
      categorySlug: 'filters',
      partNumber: 'AF-COR-1419',
      condition: 'new',
      priceKobo: 650000,
      stockQty: 32,
      location: 'Port Harcourt',
      sellerBusinessName: 'Naija OEM Spares',
      sellerRating: 4.8,
      status: 'active',
      createdAt: '2026-06-28T08:00:00.000Z',
      updatedAt: '2026-06-28T08:00:00.000Z',
      images: [
        {
          id: 5005,
          productId: 4003,
          url: 'https://example.com/products/air-filter-corolla-1.jpg',
          position: 1
        }
      ],
      compatibility: [
        {
          id: 6003,
          productId: 4003,
          make: 'Toyota',
          model: 'Corolla',
          yearFrom: 2014,
          yearTo: 2019
        }
      ]
    },
    {
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
      status: 'active',
      createdAt: '2026-06-27T08:00:00.000Z',
      updatedAt: '2026-06-27T08:00:00.000Z',
      images: [
        {
          id: 5006,
          productId: 4004,
          url: 'https://example.com/products/starter-motor-rx330-1.jpg',
          position: 1
        },
        {
          id: 5007,
          productId: 4004,
          url: 'https://example.com/products/starter-motor-rx330-2.jpg',
          position: 2
        }
      ],
      compatibility: [
        {
          id: 6004,
          productId: 4004,
          make: 'Lexus',
          model: 'RX 330',
          yearFrom: 2004,
          yearTo: 2006
        },
        {
          id: 6005,
          productId: 4004,
          make: 'Toyota',
          model: 'Highlander',
          yearFrom: 2003,
          yearTo: 2007
        }
      ]
    }
  ];
}

function matchesProductFilters(product, filters) {
  if (product.status !== 'active') {
    return false;
  }

  if (filters.partName) {
    const search = filters.partName.toLowerCase();
    const searchableText = `${product.title} ${product.description}`.toLowerCase();

    if (!searchableText.includes(search)) {
      return false;
    }
  }

  if (filters.partNumber && !product.partNumber.toLowerCase().includes(filters.partNumber.toLowerCase())) {
    return false;
  }

  if (filters.category !== null && filters.category !== undefined) {
    if (typeof filters.category === 'number' && product.categoryId !== filters.category) {
      return false;
    }

    if (typeof filters.category === 'string') {
      const normalizedCategory = filters.category.toLowerCase();

      if (
        product.categorySlug.toLowerCase() !== normalizedCategory
        && product.categoryName.toLowerCase() !== normalizedCategory
      ) {
        return false;
      }
    }
  }

  if (filters.minPriceKobo !== null && filters.minPriceKobo !== undefined && product.priceKobo < filters.minPriceKobo) {
    return false;
  }

  if (filters.maxPriceKobo !== null && filters.maxPriceKobo !== undefined && product.priceKobo > filters.maxPriceKobo) {
    return false;
  }

  if (filters.location && !product.location.toLowerCase().includes(filters.location.toLowerCase())) {
    return false;
  }

  if (
    filters.sellerBusinessName
    && !product.sellerBusinessName.toLowerCase().includes(filters.sellerBusinessName.toLowerCase())
  ) {
    return false;
  }

  if (filters.sellerRating !== null && filters.sellerRating !== undefined && product.sellerRating < filters.sellerRating) {
    return false;
  }

  if (filters.vehicleMake || filters.vehicleModel || filters.vehicleYear) {
    const isCompatible = product.compatibility.some((compatibility) => {
      if (
        filters.vehicleMake
        && compatibility.make.toLowerCase() !== filters.vehicleMake.toLowerCase()
      ) {
        return false;
      }

      if (
        filters.vehicleModel
        && compatibility.model.toLowerCase() !== filters.vehicleModel.toLowerCase()
      ) {
        return false;
      }

      if (
        filters.vehicleYear !== null
        && filters.vehicleYear !== undefined
        && (compatibility.yearFrom > filters.vehicleYear || compatibility.yearTo < filters.vehicleYear)
      ) {
        return false;
      }

      return true;
    });

    if (!isCompatible) {
      return false;
    }
  }

  return true;
}

function toRepositoryProduct(product) {
  return {
    id: product.id,
    sellerId: product.sellerId,
    title: product.title,
    description: product.description,
    categoryId: product.categoryId,
    categoryName: product.categoryName,
    categorySlug: product.categorySlug,
    partNumber: product.partNumber,
    condition: product.condition,
    priceKobo: product.priceKobo,
    stockQty: product.stockQty,
    location: product.location,
    sellerBusinessName: product.sellerBusinessName,
    sellerRating: product.sellerRating,
    status: product.status,
    primaryImageUrl: product.images[0] ? product.images[0].url : null,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt
  };
}

function createInMemoryProductsRepository() {
  const products = createCatalogueFixture();

  return {
    async findProductById(productId) {
      const product = products.find((entry) => entry.id === Number(productId) && entry.status === 'active');

      return product ? toRepositoryProduct(product) : null;
    },

    async findProductCompatibilityByProductId(productId) {
      const product = products.find((entry) => entry.id === Number(productId));

      return product ? product.compatibility.map((entry) => ({ ...entry })) : [];
    },

    async findProductImagesByProductId(productId) {
      const product = products.find((entry) => entry.id === Number(productId));

      return product ? product.images.map((entry) => ({ ...entry })) : [];
    },

    async listProducts(filters) {
      const matchedProducts = products
        .filter((product) => matchesProductFilters(product, filters))
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));

      return {
        products: matchedProducts
          .slice(filters.offset, filters.offset + filters.limit)
          .map(toRepositoryProduct),
        total: matchedProducts.length
      };
    }
  };
}

module.exports = {
  createInMemoryProductsRepository
};
