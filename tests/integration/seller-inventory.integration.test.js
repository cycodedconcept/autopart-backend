require('../setup/mocha');

const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const chai = require('chai');
const request = require('supertest');
const { createApp } = require('../../src/app');
const { createInMemoryBuyerAddressesRepository } = require('./support/in-memory-buyer-addresses-repository');
const { createInMemoryCartsRepository } = require('./support/in-memory-carts-repository');
const { createInMemoryCommerceStore } = require('./support/in-memory-commerce-store');
const { createFakePaystackClient } = require('./support/fake-paystack-client');
const { createInMemoryOrdersRepository } = require('./support/in-memory-orders-repository');
const { createInMemoryPaymentsRepository } = require('./support/in-memory-payments-repository');
const { createInMemoryProductsRepository } = require('./support/in-memory-products-repository');
const { createInMemorySellersRepository } = require('./support/in-memory-sellers-repository');
const { createInMemoryUsersRepository } = require('./support/in-memory-users-repository');

const { expect } = chai;

async function registerBuyer(app, email) {
  const response = await request(app)
    .post('/api/v1/auth/register')
    .send({
      fullName: 'Buyer User',
      email,
      password: 'Password123'
    })
    .expect(201);

  return response.body.data.token;
}

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

async function createSellerListing(app, token, product) {
  const response = await request(app)
    .post('/api/v1/seller/products')
    .set('Authorization', `Bearer ${token}`)
    .field('title', product.title)
    .field('description', product.description)
    .field('categoryId', String(product.categoryId))
    .field('partNumber', product.partNumber)
    .field('condition', product.condition)
    .field('priceKobo', String(product.priceKobo))
    .field('stockQty', String(product.stockQty))
    .field('location', product.location)
    .field('compatibility', JSON.stringify(product.compatibility))
    .attach('photos', Buffer.from('fake-image'), {
      filename: `${product.partNumber}.png`,
      contentType: 'image/png'
    })
    .expect(201);

  return response.body.data.id;
}

async function createOrder(app, token, productId, quantity) {
  await request(app)
    .post('/api/v1/cart/items')
    .set('Authorization', `Bearer ${token}`)
    .send({
      productId,
      quantity
    })
    .expect(200);

  const response = await request(app)
    .post('/api/v1/orders')
    .set('Authorization', `Bearer ${token}`)
    .send({
      paymentMethod: 'paystack',
      deliveryAddress: {
        label: 'Workshop',
        street: '12 Adeola Odeku Street',
        city: 'Ikeja',
        state: 'Lagos',
        phone: '08012345678'
      }
    })
    .expect(201);

  return response.body.data.id;
}

describe('Seller inventory API integration', () => {
  let app;
  let uploadDirectory;

  beforeEach(() => {
    const usersRepository = createInMemoryUsersRepository();
    const sellersRepository = createInMemorySellersRepository({ usersRepository });
    const productsRepository = createInMemoryProductsRepository();
    const commerceStore = createInMemoryCommerceStore();

    uploadDirectory = path.join(os.tmpdir(), `autoparts-seller-inventory-${Date.now()}`);
    app = createApp({
      usersRepository,
      sellersRepository,
      productsRepository,
      buyerAddressesRepository: createInMemoryBuyerAddressesRepository({ store: commerceStore }),
      cartsRepository: createInMemoryCartsRepository({
        productsRepository,
        store: commerceStore
      }),
      ordersRepository: createInMemoryOrdersRepository({
        productsRepository,
        store: commerceStore
      }),
      paymentsRepository: createInMemoryPaymentsRepository({
        productsRepository,
        store: commerceStore
      }),
      paystackClient: createFakePaystackClient(),
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
        UPLOAD_DIR: uploadDirectory,
        SELLER_AUTO_VERIFY: true
      }
    });
  });

  afterEach(async () => {
    await fs.rm(uploadDirectory, {
      recursive: true,
      force: true
    });
  });

  it('shows seller stock levels and decrements stock after payment confirmation', async () => {
    const sellerToken = await registerAndLoginSeller(app, {
      fullName: 'Uche Okafor',
      email: 'seller-inventory@example.com',
      phone: '08012345678',
      password: 'Password123',
      businessName: 'Prime Auto Hub',
      contactEmail: 'sales@primeautohub.ng',
      contactPhone: '08012345678',
      address: '12 Sapara Williams Close, Victoria Island, Lagos',
      cacNumber: 'RC-323456'
    });
    const productId = await createSellerListing(app, sellerToken, {
      title: 'Front Brake Disc',
      description: 'Premium brake disc for Toyota Camry sedans.',
      categoryId: 1002,
      partNumber: 'DISC-INV-001',
      condition: 'new',
      priceKobo: 4500000,
      stockQty: 8,
      location: 'Lagos',
      compatibility: [
        {
          make: 'Toyota',
          model: 'Camry',
          yearFrom: 2007,
          yearTo: 2011
        }
      ]
    });

    const initialInventoryResponse = await request(app)
      .get('/api/v1/seller/inventory')
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(200);

    expect(initialInventoryResponse.body.data.inventory).to.have.length(1);
    expect(initialInventoryResponse.body.data.inventory[0].stockQty).to.equal(8);
    expect(initialInventoryResponse.body.data.inventory[0].isLowStock).to.equal(false);
    expect(initialInventoryResponse.body.data.summary.totalUnitsInStock).to.equal(8);

    const buyerToken = await registerBuyer(app, 'inventory-buyer@example.com');
    const orderId = await createOrder(app, buyerToken, productId, 3);

    const initializeResponse = await request(app)
      .post('/api/v1/payments/initialize')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        orderId
      })
      .expect(200);

    await request(app)
      .get('/api/v1/payments/callback')
      .query({
        reference: initializeResponse.body.data.payment.reference
      })
      .expect(200);

    const postPaymentInventoryResponse = await request(app)
      .get('/api/v1/seller/inventory')
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(200);

    expect(postPaymentInventoryResponse.body.data.inventory[0].stockQty).to.equal(5);
    expect(postPaymentInventoryResponse.body.data.inventory[0].isLowStock).to.equal(true);
    expect(postPaymentInventoryResponse.body.data.summary.lowStockThreshold).to.equal(5);
    expect(postPaymentInventoryResponse.body.data.summary.lowStockListings).to.equal(1);
    expect(postPaymentInventoryResponse.body.data.summary.totalUnitsInStock).to.equal(5);

    const productDetailResponse = await request(app)
      .get(`/api/v1/products/${productId}`)
      .expect(200);

    expect(productDetailResponse.body.data.stockQty).to.equal(5);
  });

  it('accepts a seller inventory csv bulk upload and returns created listings', async () => {
    const sellerToken = await registerAndLoginSeller(app, {
      fullName: 'Amaka Obi',
      email: 'bulk-seller@example.com',
      phone: '08012345679',
      password: 'Password123',
      businessName: 'Savannah Parts Depot',
      contactEmail: 'sales@savannahparts.ng',
      contactPhone: '08012345679',
      address: '24 Aminu Kano Crescent, Wuse II, Abuja',
      cacNumber: 'RC-323457'
    });

    const csvContent = [
      'title,description,categoryId,partNumber,condition,priceKobo,stockQty,location,status,compatibleMake,compatibleModel,compatibleYearFrom,compatibleYearTo,imageUrls',
      'Front Brake Disc,"Premium brake disc for Toyota Camry sedans.",1002,BULK-DISC-001,new,4500000,12,Lagos,active,Toyota,Camry,2007,2011,https://example.com/disc-1.png',
      'Rear Shock Absorber,"Gas-filled rear shock absorber for Honda Accord.",1003,BULK-SHOCK-001,new,5200000,4,Abuja,inactive,Honda,Accord,2008,2012,https://example.com/shock-1.png|https://example.com/shock-2.png'
    ].join('\n');

    const uploadResponse = await request(app)
      .post('/api/v1/seller/inventory/bulk')
      .set('Authorization', `Bearer ${sellerToken}`)
      .attach('file', Buffer.from(csvContent), {
        filename: 'inventory.csv',
        contentType: 'text/csv'
      })
      .expect(201);

    expect(uploadResponse.body.success).to.equal(true);
    expect(uploadResponse.body.data.createdCount).to.equal(2);
    expect(uploadResponse.body.data.products[1].isLowStock).to.equal(true);

    const inventoryResponse = await request(app)
      .get('/api/v1/seller/inventory')
      .set('Authorization', `Bearer ${sellerToken}`)
      .query({
        status: 'all',
        page: 1,
        limit: 10
      })
      .expect(200);

    expect(inventoryResponse.body.data.inventory).to.have.length(2);
    expect(inventoryResponse.body.data.summary.totalListings).to.equal(2);
    expect(inventoryResponse.body.data.summary.lowStockListings).to.equal(1);

    const publicListResponse = await request(app)
      .get('/api/v1/products')
      .query({
        partNumber: 'BULK-DISC-001'
      })
      .expect(200);

    expect(publicListResponse.body.data.products).to.have.length(1);
    expect(publicListResponse.body.data.products[0].partNumber).to.equal('BULK-DISC-001');
  });
});
