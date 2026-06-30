const express = require('express');
const morgan = require('morgan');
const { getPool } = require('./config/database');
const logger = require('./utils/logger');
const { createUsersRepository } = require('./repositories/users.repository');
const { createProductsRepository } = require('./repositories/products.repository');
const { createBuyerAddressesRepository } = require('./repositories/buyer-addresses.repository');
const { createCartsRepository } = require('./repositories/carts.repository');
const { createOrdersRepository } = require('./repositories/orders.repository');
const { createAuthService } = require('./services/auth.service');
const { createCartService } = require('./services/cart.service');
const { createOrdersService } = require('./services/orders.service');
const { createProductsService } = require('./services/products.service');
const { createAuthController } = require('./controllers/auth.controller');
const { createCartController } = require('./controllers/cart.controller');
const { createMeController } = require('./controllers/me.controller');
const { createOrdersController } = require('./controllers/orders.controller');
const { createProductsController } = require('./controllers/products.controller');
const { createAuthRouter } = require('./routes/auth.routes');
const { createCartRouter } = require('./routes/cart.routes');
const { createMeRouter } = require('./routes/me.routes');
const { createOrdersRouter } = require('./routes/orders.routes');
const { createProductsRouter } = require('./routes/products.routes');
const { createAuthMiddleware } = require('./middleware/auth.middleware');
const { createErrorMiddleware } = require('./middleware/error.middleware');
const env = require('./config/env');
const jwtUtils = require('./utils/jwt');
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
  const authService = overrides.authService || createAuthService({
    usersRepository,
    jwtUtils: overrides.jwtUtils || jwtUtils,
    passwordUtils: overrides.passwordUtils || passwordUtils,
    passwordResetUtils: overrides.passwordResetUtils || passwordResetUtils,
    env: overrides.env || env
  });
  const cartService = overrides.cartService || createCartService({
    cartsRepository,
    productsRepository
  });
  const ordersService = overrides.ordersService || createOrdersService({
    buyerAddressesRepository,
    cartsRepository,
    ordersRepository
  });
  const productsService = overrides.productsService || createProductsService({
    productsRepository
  });

  return {
    authController: overrides.authController || createAuthController({ authService }),
    cartController: overrides.cartController || createCartController({ cartService }),
    meController: overrides.meController || createMeController(),
    ordersController: overrides.ordersController || createOrdersController({ ordersService }),
    productsController: overrides.productsController || createProductsController({ productsService }),
    authMiddleware: overrides.authMiddleware || createAuthMiddleware({ authService }),
    errorMiddleware: overrides.errorMiddleware || createErrorMiddleware({ logger: appLogger }),
    logger: appLogger
  };
}

function createApp(overrides = {}) {
  const dependencies = createDependencies(overrides);
  const app = express();

  app.use(express.json());
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
