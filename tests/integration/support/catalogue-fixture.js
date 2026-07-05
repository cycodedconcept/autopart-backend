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
    },
    {
      id: 4005,
      sellerId: 9005,
      title: 'Fuel Pump Assembly for Toyota Hilux',
      description: 'Clean used fuel pump assembly sourced for Toyota Hilux pickups and inspected before listing.',
      categoryId: 1001,
      categoryName: 'Engine & Transmission',
      categorySlug: 'engine-transmission',
      partNumber: 'FPA-HIL-1215',
      condition: 'used',
      priceKobo: 2750000,
      stockQty: 6,
      location: 'Kano',
      sellerBusinessName: 'Northern Truck Parts',
      sellerRating: 4.1,
      status: 'active',
      createdAt: '2026-06-26T08:00:00.000Z',
      updatedAt: '2026-06-26T08:00:00.000Z',
      images: [
        {
          id: 5008,
          productId: 4005,
          url: 'https://example.com/products/fuel-pump-hilux-1.jpg',
          position: 1
        }
      ],
      compatibility: [
        {
          id: 6006,
          productId: 4005,
          make: 'Toyota',
          model: 'Hilux',
          yearFrom: 2012,
          yearTo: 2015
        }
      ]
    }
  ];
}

module.exports = {
  createCatalogueFixture
};
