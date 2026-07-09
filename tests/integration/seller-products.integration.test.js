require('../setup/mocha');

const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const chai = require('chai');
const request = require('supertest');
const { createApp } = require('../../src/app');
const { createInMemoryProductsRepository } = require('./support/in-memory-products-repository');
const { createInMemorySellersRepository } = require('./support/in-memory-sellers-repository');
const { createInMemoryUsersRepository } = require('./support/in-memory-users-repository');

const { expect } = chai;

async function registerAndLoginSeller(app, seller) {
  await request(app)
    .post('/api/v1/seller/register')
    .send({
      fullName: seller.fullName,
      email: seller.email,
      phone: seller.phone,
      password: seller.password,
      businessName: seller.businessName,
      contactEmail: seller.contactEmail,
      contactPhone: seller.contactPhone,
      address: seller.address,
      cacNumber: seller.cacNumber
    })
    .expect(201);

  const loginResponse = await request(app)
    .post('/api/v1/auth/login')
    .send({
      identifier: seller.email,
      password: seller.password
    })
    .expect(200);

  await request(app)
    .post('/api/v1/seller/documents')
    .set('Authorization', `Bearer ${loginResponse.body.data.token}`)
    .attach('cacDocument', Buffer.from('fake-cac'), {
      filename: 'cac.pdf',
      contentType: 'application/pdf'
    })
    .attach('proofOfAddressDocument', Buffer.from('fake-proof'), {
      filename: 'proof.pdf',
      contentType: 'application/pdf'
    })
    .expect(200);

  return loginResponse.body.data.token;
}

describe('Seller products API integration', () => {
  let app;
  let uploadDirectory;

  beforeEach(() => {
    const usersRepository = createInMemoryUsersRepository();
    const sellersRepository = createInMemorySellersRepository({ usersRepository });
    const productsRepository = createInMemoryProductsRepository();

    uploadDirectory = path.join(os.tmpdir(), `autoparts-product-uploads-${Date.now()}`);
    app = createApp({
      usersRepository,
      sellersRepository,
      productsRepository,
      env: {
        NODE_ENV: 'test',
        DB_HOST: 'localhost',
        DB_PORT: 3306,
        DB_USER: 'root',
        DB_PASSWORD: '',
        DB_NAME: 'autoparts_test',
        JWT_SECRET: 'test-jwt-secret-12345',
        JWT_EXPIRES_IN: '1d',
        BCRYPT_SALT_ROUNDS: 4,
        PASSWORD_RESET_TOKEN_TTL_MINUTES: 30,
        PAYSTACK_SECRET_KEY: '',
        PAYSTACK_PUBLIC_KEY: '',
        UPLOAD_DIR: uploadDirectory
      }
    });
  });

  afterEach(async () => {
    await fs.rm(uploadDirectory, {
      recursive: true,
      force: true
    });
  });

  it('creates, lists, updates, and soft-deletes a seller-owned product listing', async () => {
    const token = await registerAndLoginSeller(app, {
      fullName: 'Uche Okafor',
      email: 'uche@example.com',
      phone: '08012345678',
      password: 'Password123',
      businessName: 'Prime Auto Hub',
      contactEmail: 'sales@primeautohub.ng',
      contactPhone: '08012345678',
      address: '12 Sapara Williams Close, Victoria Island, Lagos',
      cacNumber: 'RC-123456'
    });

    const createResponse = await request(app)
      .post('/api/v1/seller/products')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Front Brake Disc')
      .field('description', 'Premium brake disc for Toyota Camry sedans.')
      .field('categoryId', '1002')
      .field('partNumber', 'DISC-001')
      .field('condition', 'new')
      .field('priceKobo', '4500000')
      .field('stockQty', '12')
      .field('location', 'Lagos')
      .field('compatibility', JSON.stringify([
        {
          make: 'Toyota',
          model: 'Camry',
          yearFrom: 2007,
          yearTo: 2011
        }
      ]))
      .attach('photos', Buffer.from('fake-image-1'), {
        filename: 'disc-1.png',
        contentType: 'image/png'
      })
      .attach('photos', Buffer.from('fake-image-2'), {
        filename: 'disc-2.png',
        contentType: 'image/png'
      });

    expect(createResponse.status).to.equal(201);
    expect(createResponse.body.success).to.equal(true);
    expect(createResponse.body.data.status).to.equal('active');
    expect(createResponse.body.data.photos).to.have.length(2);
    expect(createResponse.body.data.compatibility).to.have.length(1);

    const productId = createResponse.body.data.id;

    const sellerListResponse = await request(app)
      .get('/api/v1/seller/products')
      .set('Authorization', `Bearer ${token}`)
      .query({
        status: 'active'
      });

    expect(sellerListResponse.status).to.equal(200);
    expect(sellerListResponse.body.data.products).to.have.length(1);
    expect(sellerListResponse.body.data.products[0].id).to.equal(productId);

    const publicListResponse = await request(app)
      .get('/api/v1/products')
      .query({
        partNumber: 'DISC-001'
      });

    expect(publicListResponse.status).to.equal(200);
    expect(publicListResponse.body.data.products.map((product) => product.id)).to.include(productId);

    const updateResponse = await request(app)
      .patch(`/api/v1/seller/products/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .field('priceKobo', '5200000')
      .field('stockQty', '9')
      .field('compatibility', JSON.stringify([
        {
          make: 'Toyota',
          model: 'Camry',
          yearFrom: 2008,
          yearTo: 2012
        }
      ]))
      .attach('photos', Buffer.from('replacement-image'), {
        filename: 'disc-updated.png',
        contentType: 'image/png'
      });

    expect(updateResponse.status).to.equal(200);
    expect(updateResponse.body.data.priceKobo).to.equal(5200000);
    expect(updateResponse.body.data.stockQty).to.equal(9);
    expect(updateResponse.body.data.photos).to.have.length(1);
    expect(updateResponse.body.data.compatibility[0].yearFrom).to.equal(2008);

    const publicDetailResponse = await request(app)
      .get(`/api/v1/products/${productId}`);

    expect(publicDetailResponse.status).to.equal(200);
    expect(publicDetailResponse.body.data.priceKobo).to.equal(5200000);

    const deleteResponse = await request(app)
      .delete(`/api/v1/seller/products/${productId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(deleteResponse.status).to.equal(200);
    expect(deleteResponse.body.data.status).to.equal('inactive');

    await request(app)
      .get(`/api/v1/products/${productId}`)
      .expect(404);
  });

  it('prevents one seller from editing another seller product', async () => {
    const firstSellerToken = await registerAndLoginSeller(app, {
      fullName: 'Seller One',
      email: 'seller1@example.com',
      phone: '08012345670',
      password: 'Password123',
      businessName: 'Seller One Hub',
      contactEmail: 'one@example.com',
      contactPhone: '08012345670',
      address: '1 Broad Street, Lagos',
      cacNumber: 'RC-500001'
    });

    const secondSellerToken = await registerAndLoginSeller(app, {
      fullName: 'Seller Two',
      email: 'seller2@example.com',
      phone: '08012345671',
      password: 'Password123',
      businessName: 'Seller Two Hub',
      contactEmail: 'two@example.com',
      contactPhone: '08012345671',
      address: '2 Broad Street, Lagos',
      cacNumber: 'RC-500002'
    });

    const createResponse = await request(app)
      .post('/api/v1/seller/products')
      .set('Authorization', `Bearer ${firstSellerToken}`)
      .field('title', 'Engine Mount')
      .field('description', 'Heavy-duty engine mount for Toyota Corolla.')
      .field('categoryId', '1001')
      .field('partNumber', 'ENG-MNT-01')
      .field('condition', 'new')
      .field('priceKobo', '2500000')
      .field('stockQty', '5')
      .field('location', 'Lagos')
      .field('compatibility', JSON.stringify([
        {
          make: 'Toyota',
          model: 'Corolla',
          yearFrom: 2010,
          yearTo: 2016
        }
      ]))
      .attach('photos', Buffer.from('engine-mount-image'), {
        filename: 'engine-mount.png',
        contentType: 'image/png'
      })
      .expect(201);

    const response = await request(app)
      .patch(`/api/v1/seller/products/${createResponse.body.data.id}`)
      .set('Authorization', `Bearer ${secondSellerToken}`)
      .field('priceKobo', '2600000');

    expect(response.status).to.equal(404);
    expect(response.body.success).to.equal(false);
    expect(response.body.error.code).to.equal('NOT_FOUND');
  });
});
