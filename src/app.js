const express = require('express');
const morgan = require('morgan');
const { getPool } = require('./config/database');
const logger = require('./utils/logger');
const { createUsersRepository } = require('./repositories/users.repository');
const { createProductsRepository } = require('./repositories/products.repository');
const { createAuthService } = require('./services/auth.service');
const { createProductsService } = require('./services/products.service');
const { createAuthController } = require('./controllers/auth.controller');
const { createMeController } = require('./controllers/me.controller');
const { createProductsController } = require('./controllers/products.controller');
const { createAuthRouter } = require('./routes/auth.routes');
const { createMeRouter } = require('./routes/me.routes');
const { createProductsRouter } = require('./routes/products.routes');
const { createAuthMiddleware } = require('./middleware/auth.middleware');
const { createErrorMiddleware } = require('./middleware/error.middleware');
const env = require('./config/env');
const jwtUtils = require('./utils/jwt');
const passwordUtils = require('./utils/password');
const passwordResetUtils = require('./utils/password-reset');

function createDependencies(overrides = {}) {
  const appLogger = overrides.logger || logger;
  const usersRepository = overrides.usersRepository || createUsersRepository({
    db: overrides.db || getPool()
  });
  const productsRepository = overrides.productsRepository || createProductsRepository({
    db: overrides.db || getPool()
  });
  const authService = overrides.authService || createAuthService({
    usersRepository,
    jwtUtils: overrides.jwtUtils || jwtUtils,
    passwordUtils: overrides.passwordUtils || passwordUtils,
    passwordResetUtils: overrides.passwordResetUtils || passwordResetUtils,
    env: overrides.env || env
  });
  const productsService = overrides.productsService || createProductsService({
    productsRepository
  });

  return {
    authController: overrides.authController || createAuthController({ authService }),
    meController: overrides.meController || createMeController(),
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
