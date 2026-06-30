require('../setup/mocha');

const chai = require('chai');
const request = require('supertest');
const { createApp } = require('../../src/app');
const { createInMemoryUsersRepository } = require('./support/in-memory-users-repository');
const { createInMemoryProductsRepository } = require('./support/in-memory-products-repository');

const { expect } = chai;

describe('Products API integration', () => {
  let app;

  beforeEach(() => {
    app = createApp({
      usersRepository: createInMemoryUsersRepository(),
      productsRepository: createInMemoryProductsRepository()
    });
  });

  it('lists products with filters and pagination metadata', async () => {
    const response = await request(app)
      .get('/api/v1/products')
      .query({
        vehicleMake: 'Toyota',
        vehicleModel: 'Camry',
        vehicleYear: 2010,
        sellerRating: 4.5,
        page: 1,
        limit: 2
      });

    expect(response.status).to.equal(200);
    expect(response.body.success).to.equal(true);
    expect(response.body.data.products).to.have.length(1);
    expect(response.body.data.products[0].title).to.equal('Front Brake Pad Set for Toyota Camry');
    expect(response.body.data.products[0].seller.businessName).to.equal('Prime Auto Hub');
    expect(response.body.data.pagination).to.deep.equal({
      page: 1,
      limit: 2,
      total: 1,
      totalPages: 1
    });
  });

  it('returns a single product detail with photos and compatibility', async () => {
    const response = await request(app)
      .get('/api/v1/products/4004');

    expect(response.status).to.equal(200);
    expect(response.body.success).to.equal(true);
    expect(response.body.data.title).to.equal('Starter Motor for Lexus RX 330');
    expect(response.body.data.photos).to.have.length(2);
    expect(response.body.data.compatibility).to.deep.include({
      id: 6004,
      make: 'Lexus',
      model: 'RX 330',
      yearFrom: 2004,
      yearTo: 2006
    });
  });

  it('returns 404 when the product does not exist', async () => {
    const response = await request(app)
      .get('/api/v1/products/9999');

    expect(response.status).to.equal(404);
    expect(response.body.success).to.equal(false);
    expect(response.body.error.code).to.equal('NOT_FOUND');
  });
});
