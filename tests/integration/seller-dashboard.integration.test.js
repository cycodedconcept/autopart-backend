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
const { createInMemoryDeliveryJobsRepository } = require('./support/in-memory-delivery-jobs-repository');
const { createInMemoryLogisticsRepository } = require('./support/in-memory-logistics-repository');
const { createInMemoryOrdersRepository } = require('./support/in-memory-orders-repository');
const { createInMemoryPaymentsRepository } = require('./support/in-memory-payments-repository');
const { createInMemoryPlatformConfigRepository } = require('./support/in-memory-platform-config-repository');
const { createInMemoryProductsRepository } = require('./support/in-memory-products-repository');
const { createInMemorySellerFinanceRepository } = require('./support/in-memory-seller-finance-repository');
const { createInMemorySellersRepository } = require('./support/in-memory-sellers-repository');
const { createInMemoryUsersRepository } = require('./support/in-memory-users-repository');
const {
  progressDeliveryJob,
  registerAndLoginLogistics
} = require('./support/logistics-test-helpers');

const { expect } = chai;

function shiftDate(dateValue, days) {
  const date = new Date(`${dateValue}T00:00:00.000Z`);

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

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

describe('Seller dashboard API integration', () => {
  let app;
  let uploadDirectory;

  beforeEach(() => {
    const usersRepository = createInMemoryUsersRepository();
    const sellersRepository = createInMemorySellersRepository({ usersRepository });
    const productsRepository = createInMemoryProductsRepository();
    const commerceStore = createInMemoryCommerceStore();
    const platformConfigRepository = createInMemoryPlatformConfigRepository();
    const logisticsRepository = createInMemoryLogisticsRepository({
      store: commerceStore,
      usersRepository
    });
    const deliveryJobsRepository = createInMemoryDeliveryJobsRepository({
      logisticsRepository,
      productsRepository,
      sellersRepository,
      store: commerceStore,
      usersRepository
    });

    uploadDirectory = path.join(os.tmpdir(), `autoparts-seller-dashboard-${Date.now()}`);
    app = createApp({
      deliveryJobsRepository,
      logisticsRepository,
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
        store: commerceStore,
        usersRepository
      }),
      paymentsRepository: createInMemoryPaymentsRepository({
        productsRepository,
        store: commerceStore
      }),
      sellerFinanceRepository: createInMemorySellerFinanceRepository({
        sellersRepository,
        store: commerceStore
      }),
      platformConfigRepository,
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
        PLATFORM_COMMISSION_RATE_PERCENT: 10
      }
    });
  });

  afterEach(async () => {
    await fs.rm(uploadDirectory, {
      recursive: true,
      force: true
    });
  });

  it('returns the seller dashboard summary cards for the authenticated seller', async () => {
    const sellerToken = await registerAndLoginSeller(app, {
      fullName: 'Uche Okafor',
      email: 'seller-dashboard@example.com',
      phone: '08012345678',
      password: 'Password123',
      businessName: 'Prime Auto Hub',
      contactEmail: 'sales@primeautohub.ng',
      contactPhone: '08012345678',
      address: '12 Sapara Williams Close, Victoria Island, Lagos',
      cacNumber: 'RC-323500'
    });
    const logistics = await registerAndLoginLogistics(app, {
      fullName: 'Alex Rider',
      email: 'logistics-dashboard@example.com',
      phone: '08012345002',
      password: 'Password123',
      providerName: 'Swift Dispatch',
      vehicleType: 'van',
      plateNumber: 'LAG-502XY'
    });
    const productId = await createSellerListing(app, sellerToken, {
      title: 'Front Brake Disc',
      description: 'Premium brake disc for Toyota Camry sedans.',
      categoryId: 1002,
      partNumber: 'DISC-DB-001',
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
    const buyerToken = await registerBuyer(app, 'seller-dashboard-buyer@example.com');
    const orderId = await createOrder(app, buyerToken, productId, 2);
    const initializeResponse = await request(app)
      .post('/api/v1/payments/initialize')
      .set('Authorization', `Bearer ${buyerToken}`)
      .send({
        orderId
      })
      .expect(200);

    await request(app)
      .get('/api/v1/payments/callback')
      .set('Authorization', `Bearer ${buyerToken}`)
      .query({
        reference: initializeResponse.body.data.payment.reference
      })
      .expect(200);

    const sellerOrdersResponse = await request(app)
      .get('/api/v1/seller/orders')
      .set('Authorization', `Bearer ${sellerToken}`)
      .expect(200);
    const orderItemId = sellerOrdersResponse.body.data.orders[0].items[0].id;

    await request(app)
      .patch(`/api/v1/seller/orders/${orderItemId}/status`)
      .set('Authorization', `Bearer ${sellerToken}`)
      .send({
        itemStatus: 'ready_for_pickup'
      })
      .expect(200);

    await progressDeliveryJob(app, logistics.token, orderItemId);

    const today = new Date().toISOString().slice(0, 10);
    const response = await request(app)
      .get('/api/v1/seller/dashboard')
      .set('Authorization', `Bearer ${sellerToken}`)
      .query({
        dateFrom: today,
        dateTo: today
      })
      .expect(200);

    expect(response.body.success).to.equal(true);
    const { data } = response.body;

    expect(data.seller).to.deep.equal({
      id: 1,
      businessName: 'Prime Auto Hub',
      rating: 0,
      contactPhone: '+2348012345678',
      contactEmail: 'sales@primeautohub.ng',
      verificationStatus: 'pending',
      rejectionReason: null
    });
    expect(data.comparison).to.deep.equal({
      label: 'Since last week',
      currentPeriod: {
        dateFrom: shiftDate(today, -6),
        dateTo: today
      },
      previousPeriod: {
        dateFrom: shiftDate(today, -13),
        dateTo: shiftDate(today, -7)
      }
    });
    expect(data.overviewCards).to.deep.equal({
      productsListed: {
        label: 'Products Listed',
        value: 1,
        trend: {
          label: 'Since last week',
          direction: 'up',
          changePercent: 100,
          delta: 1,
          currentPeriodValue: 1,
          previousPeriodValue: 0
        }
      },
      totalOrders: {
        label: 'Total Orders',
        value: 1,
        trend: {
          label: 'Since last week',
          direction: 'up',
          changePercent: 100,
          delta: 1,
          currentPeriodValue: 1,
          previousPeriodValue: 0
        }
      },
      totalCustomers: {
        label: 'Total Customers',
        value: 1,
        trend: {
          label: 'Since last week',
          direction: 'up',
          changePercent: 100,
          delta: 1,
          currentPeriodValue: 1,
          previousPeriodValue: 0
        }
      },
      totalRevenue: {
        label: 'Total Revenue',
        valueKobo: 9000000,
        currency: 'NGN',
        trend: {
          label: 'Since last week',
          direction: 'up',
          changePercent: 100,
          delta: 9000000,
          currentPeriodValue: 9000000,
          previousPeriodValue: 0
        }
      }
    });
    expect(data.revenueChart.label).to.equal('Total Revenue');
    expect(data.revenueChart.interval).to.equal('monthly');
    expect(data.revenueChart.points).to.have.length(12);
    expect(data.revenueChart.year).to.equal(Number(today.slice(0, 4)));
    expect(
      data.revenueChart.points.find((point) => point.monthNumber === Number(today.slice(5, 7)))
    ).to.deep.equal({
      monthNumber: Number(today.slice(5, 7)),
      label: data.revenueChart.points[Number(today.slice(5, 7)) - 1].label,
      totalOrders: 1,
      totalItems: 2,
      grossSalesKobo: 9000000,
      commissionKobo: 900000,
      netSalesKobo: 8100000
    });
    expect(data.productStatus).to.deep.equal({
      label: 'Total Products',
      totalProducts: 1,
      inStock: 1,
      lowStock: 0,
      outOfStock: 0,
      lowStockThreshold: 5
    });
    expect(data.featuredProducts).to.have.length(1);
    expect(data.featuredProducts[0]).to.include({
      id: productId,
      title: 'Front Brake Disc',
      priceKobo: 4500000,
      stockQty: 6,
      stockLabel: '6 Units',
      location: 'Lagos',
      condition: 'new',
      status: 'active',
      isLowStock: false,
      isOutOfStock: false,
      compatibilityLabel: 'Toyota Camry'
    });
    expect(data.featuredProducts[0].category).to.deep.equal({
      id: 1002,
      name: 'Brake System',
      slug: 'brake-system'
    });
    expect(data.featuredProducts[0].tags).to.deep.equal([
      'Brake System',
      '6 Units',
      'Toyota Camry'
    ]);
    expect(data.topCustomers).to.deep.equal([
      {
        buyerId: 2,
        fullName: 'Buyer User',
        email: 'seller-dashboard-buyer@example.com',
        phone: null,
        totalOrders: 1,
        totalItems: 2,
        totalSpentKobo: 9000000
      }
    ]);
    expect(data.inventory).to.deep.equal({
      totalListings: 1,
      activeListings: 1,
      inactiveListings: 0,
      outOfStockListings: 0,
      lowStockListings: 0,
      totalUnitsInStock: 6,
      lowStockThreshold: 5
    });
    expect(data.orders).to.deep.equal({
      totalOrders: 1,
      paidOrders: 1,
      unpaidOrders: 0,
      totalCustomers: 1,
      pendingOrders: 0,
      sellerLineItems: 1,
      totalItems: 2,
      pendingLineItems: 0,
      readyForPickupLineItems: 0,
      pickedUpLineItems: 0,
      deliveredLineItems: 1,
      cancelledLineItems: 0
    });
    expect(data.sales).to.deep.equal({
      period: {
        dateFrom: today,
        dateTo: today
      },
      commissionRatePercent: 10,
      totalOrders: 1,
      totalItems: 2,
      grossSalesKobo: 9000000,
      commissionKobo: 900000,
      netSalesKobo: 8100000
    });
    expect(data.payouts).to.deep.equal({
      pendingKobo: 8100000,
      requestedKobo: 0,
      approvedKobo: 0,
      paidKobo: 0
    });
  });
});
