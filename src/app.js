const express = require('express');
const morgan = require('morgan');
const { getPool } = require('./config/database');
const logger = require('./utils/logger');
const { createAdminRepository } = require('./repositories/admin.repository');
const { createUsersRepository } = require('./repositories/users.repository');
const { createProductsRepository } = require('./repositories/products.repository');
const { createBuyerAddressesRepository } = require('./repositories/buyer-addresses.repository');
const { createCartsRepository } = require('./repositories/carts.repository');
const { createOrdersRepository } = require('./repositories/orders.repository');
const { createPaymentsRepository } = require('./repositories/payments.repository');
const { createSellerFinanceRepository } = require('./repositories/seller-finance.repository');
const { createSellersRepository } = require('./repositories/sellers.repository');
const { createAdminService } = require('./services/admin.service');
const { createAuthService } = require('./services/auth.service');
const { createCartService } = require('./services/cart.service');
const { createOrdersService } = require('./services/orders.service');
const { createPaymentsService } = require('./services/payments.service');
const { createProductsService } = require('./services/products.service');
const { createSellerDashboardService } = require('./services/seller-dashboard.service');
const { createSellerFinanceService } = require('./services/seller-finance.service');
const { createSellersService } = require('./services/sellers.service');
const { createCacVerificationService } = require('./services/cac-verification.service');
const { createAdminController } = require('./controllers/admin.controller');
const { createAuthController } = require('./controllers/auth.controller');
const { createCartController } = require('./controllers/cart.controller');
const { createMeController } = require('./controllers/me.controller');
const { createOrdersController } = require('./controllers/orders.controller');
const { createPaymentsController } = require('./controllers/payments.controller');
const { createProductsController } = require('./controllers/products.controller');
const { createSellerDashboardController } = require('./controllers/seller-dashboard.controller');
const { createSellerFinanceController } = require('./controllers/seller-finance.controller');
const { createSellerController } = require('./controllers/seller.controller');
const { createSellerInventoryController } = require('./controllers/seller-inventory.controller');
const { createSellerOrdersController } = require('./controllers/seller-orders.controller');
const { createSellerProductsController } = require('./controllers/seller-products.controller');
const { createAdminRouter } = require('./routes/admin.routes');
const { createAuthRouter } = require('./routes/auth.routes');
const { createCartRouter } = require('./routes/cart.routes');
const { createMeRouter } = require('./routes/me.routes');
const { createOrdersRouter } = require('./routes/orders.routes');
const { createPaymentsRouter } = require('./routes/payments.routes');
const { createProductsRouter } = require('./routes/products.routes');
const { createSellerDashboardRouter } = require('./routes/seller-dashboard.routes');
const { createSellerFinanceRouter } = require('./routes/seller-finance.routes');
const { createSellerInventoryRouter } = require('./routes/seller-inventory.routes');
const { createSellerOrdersRouter } = require('./routes/seller-orders.routes');
const { createSellerRouter } = require('./routes/seller.routes');
const { createSellerProductsRouter } = require('./routes/seller-products.routes');
const { createAdminAuthMiddleware, createAuthMiddleware } = require('./middleware/auth.middleware');
const { createErrorMiddleware } = require('./middleware/error.middleware');
const env = require('./config/env');
const jwtUtils = require('./utils/jwt');
const { createPaystackClient } = require('./utils/paystack');
const passwordUtils = require('./utils/password');
const passwordResetUtils = require('./utils/password-reset');

function createDependencies(overrides = {}) {
  const appLogger = overrides.logger || logger;
  let dbInstance;
  const resolveDb = () => {
    if (!dbInstance) {
      dbInstance = overrides.db || getPool();
    }

    return dbInstance;
  };
  const usersRepository = overrides.usersRepository || createUsersRepository({
    db: resolveDb()
  });
  const adminRepository = overrides.adminRepository || createAdminRepository({
    db: resolveDb()
  });
  const productsRepository = overrides.productsRepository || createProductsRepository({
    db: resolveDb()
  });
  const buyerAddressesRepository = overrides.buyerAddressesRepository || createBuyerAddressesRepository({
    db: resolveDb()
  });
  const cartsRepository = overrides.cartsRepository || createCartsRepository({
    db: resolveDb()
  });
  const ordersRepository = overrides.ordersRepository || createOrdersRepository({
    db: resolveDb()
  });
  const paymentsRepository = overrides.paymentsRepository || createPaymentsRepository({
    db: resolveDb()
  });
  const sellerFinanceRepository = overrides.sellerFinanceRepository || createSellerFinanceRepository({
    db: resolveDb()
  });
  const sellersRepository = overrides.sellersRepository || createSellersRepository({
    db: resolveDb()
  });
  const appEnv = overrides.env || env;
  const paystackClient = overrides.paystackClient || createPaystackClient({
    secretKey: appEnv.PAYSTACK_SECRET_KEY,
    logger: appLogger
  });
  const cacVerificationService = overrides.cacVerificationService || createCacVerificationService({
    env: appEnv,
    logger: appLogger
  });
  const authService = overrides.authService || createAuthService({
    usersRepository,
    jwtUtils: overrides.jwtUtils || jwtUtils,
    passwordUtils: overrides.passwordUtils || passwordUtils,
    passwordResetUtils: overrides.passwordResetUtils || passwordResetUtils,
    env: appEnv
  });
  const adminService = overrides.adminService || createAdminService({
    adminRepository,
    productsRepository,
    jwtUtils: overrides.jwtUtils || jwtUtils,
    passwordUtils: overrides.passwordUtils || passwordUtils
  });
  const cartService = overrides.cartService || createCartService({
    cartsRepository,
    productsRepository
  });
  const ordersService = overrides.ordersService || createOrdersService({
    buyerAddressesRepository,
    cartsRepository,
    ordersRepository,
    sellersRepository
  });
  const productsService = overrides.productsService || createProductsService({
    productsRepository,
    sellersRepository
  });
  const paymentsService = overrides.paymentsService || createPaymentsService({
    paymentsRepository,
    paystackClient
  });
  const sellersService = overrides.sellersService || createSellersService({
    cacVerificationService,
    usersRepository,
    sellersRepository,
    jwtUtils: overrides.jwtUtils || jwtUtils,
    passwordUtils: overrides.passwordUtils || passwordUtils
  });
  const sellerFinanceService = overrides.sellerFinanceService || createSellerFinanceService({
    env: appEnv,
    sellerFinanceRepository,
    sellersRepository
  });
  const sellerDashboardService = overrides.sellerDashboardService || createSellerDashboardService({
    env: appEnv,
    ordersRepository,
    productsRepository,
    sellerFinanceRepository,
    sellersRepository
  });

  return {
    adminController: overrides.adminController || createAdminController({ adminService }),
    authController: overrides.authController || createAuthController({ authService }),
    cartController: overrides.cartController || createCartController({ cartService }),
    meController: overrides.meController || createMeController(),
    ordersController: overrides.ordersController || createOrdersController({ ordersService }),
    paymentsController: overrides.paymentsController || createPaymentsController({ paymentsService }),
    productsController: overrides.productsController || createProductsController({ productsService }),
    sellerDashboardController: overrides.sellerDashboardController
      || createSellerDashboardController({ sellerDashboardService }),
    sellerController: overrides.sellerController || createSellerController({ sellersService }),
    sellerFinanceController: overrides.sellerFinanceController
      || createSellerFinanceController({ sellerFinanceService }),
    sellerInventoryController: overrides.sellerInventoryController
      || createSellerInventoryController({ productsService }),
    sellerOrdersController: overrides.sellerOrdersController
      || createSellerOrdersController({ ordersService }),
    sellerProductsController: overrides.sellerProductsController
      || createSellerProductsController({ productsService }),
    adminAuthMiddleware: overrides.adminAuthMiddleware || createAdminAuthMiddleware({ adminService }),
    authMiddleware: overrides.authMiddleware || createAuthMiddleware({ authService }),
    errorMiddleware: overrides.errorMiddleware || createErrorMiddleware({ logger: appLogger }),
    env: appEnv,
    logger: appLogger
  };
}

function createApp(overrides = {}) {
  const dependencies = createDependencies(overrides);
  const app = express();

  app.use(express.json({
    verify: (req, _res, buffer) => {
      req.rawBody = buffer && buffer.length ? buffer.toString('utf8') : '';
    }
  }));
  app.use(morgan('dev', { stream: dependencies.logger.stream }));

  app.get('/health', (req, res) => {
    res.status(200).json({
      success: true,
      data: {
        status: 'ok'
      },
      message: 'Service is healthy.'
    });
  });

  app.use('/api/v1/auth', createAuthRouter({
    authController: dependencies.authController,
    authMiddleware: dependencies.authMiddleware
  }));

  app.use('/api/v1/admin', createAdminRouter({
    adminAuthMiddleware: dependencies.adminAuthMiddleware,
    adminController: dependencies.adminController,
  }));

  app.use('/api/v1', createMeRouter({
    meController: dependencies.meController,
    authMiddleware: dependencies.authMiddleware
  }));

  app.use('/api/v1/products', createProductsRouter({
    productsController: dependencies.productsController
  }));

  app.use('/api/v1/cart', createCartRouter({
    authMiddleware: dependencies.authMiddleware,
    cartController: dependencies.cartController
  }));

  app.use('/api/v1/orders', createOrdersRouter({
    authMiddleware: dependencies.authMiddleware,
    ordersController: dependencies.ordersController
  }));

  app.use('/api/v1/payments', createPaymentsRouter({
    authMiddleware: dependencies.authMiddleware,
    paymentsController: dependencies.paymentsController
  }));

  app.use('/api/v1/seller/products', createSellerProductsRouter({
    authMiddleware: dependencies.authMiddleware,
    env: dependencies.env,
    sellerProductsController: dependencies.sellerProductsController
  }));

  app.use('/api/v1/seller/inventory', createSellerInventoryRouter({
    authMiddleware: dependencies.authMiddleware,
    sellerInventoryController: dependencies.sellerInventoryController
  }));

  app.use('/api/v1/seller/orders', createSellerOrdersRouter({
    authMiddleware: dependencies.authMiddleware,
    sellerOrdersController: dependencies.sellerOrdersController
  }));

  app.use('/api/v1/seller', createSellerFinanceRouter({
    authMiddleware: dependencies.authMiddleware,
    sellerFinanceController: dependencies.sellerFinanceController
  }));

  app.use('/api/v1/seller', createSellerDashboardRouter({
    authMiddleware: dependencies.authMiddleware,
    sellerDashboardController: dependencies.sellerDashboardController
  }));

  app.use('/api/v1/seller', createSellerRouter({
    authMiddleware: dependencies.authMiddleware,
    env: dependencies.env,
    sellerController: dependencies.sellerController
  }));

  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Requested resource was not found.'
      }
    });
  });

  app.use(dependencies.errorMiddleware);

  return app;
}

module.exports = {
  createApp,
  createDependencies
};
