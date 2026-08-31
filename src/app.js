const express = require('express');
const morgan = require('morgan');
const { getPool } = require('./config/database');
const logger = require('./utils/logger');
const { createAdminDashboardRepository } = require('./repositories/admin-dashboard.repository');
const { createAdminRepository } = require('./repositories/admin.repository');
const { createAuditLogRepository } = require('./repositories/audit-log.repository');
const { createBlogCategoriesRepository } = require('./repositories/blog-categories.repository');
const { createBlogCommentsRepository } = require('./repositories/blog-comments.repository');
const { createBlogPostTagsRepository } = require('./repositories/blog-post-tags.repository');
const { createBlogPostsRepository } = require('./repositories/blog-posts.repository');
const { createBlogTagsRepository } = require('./repositories/blog-tags.repository');
const { createNewsletterSubscribersRepository } = require('./repositories/newsletter-subscribers.repository');
const { createUsersRepository } = require('./repositories/users.repository');
const { createPlatformConfigRepository } = require('./repositories/platform-config.repository');
const { createProductsRepository } = require('./repositories/products.repository');
const { createBuyerAddressesRepository } = require('./repositories/buyer-addresses.repository');
const { createCartsRepository } = require('./repositories/carts.repository');
const { createDisputesRepository } = require('./repositories/disputes.repository');
const { createDeliveryJobsRepository } = require('./repositories/delivery-jobs.repository');
const { createLogisticsRepository } = require('./repositories/logistics.repository');
const { createOrdersRepository } = require('./repositories/orders.repository');
const { createPaymentsRepository } = require('./repositories/payments.repository');
const { createSellerFinanceRepository } = require('./repositories/seller-finance.repository');
const { createSellersRepository } = require('./repositories/sellers.repository');
const { createAdminService } = require('./services/admin.service');
const { createAdminDashboardService } = require('./services/admin-dashboard.service');
const { createAssignmentService } = require('./services/assignment.service');
const { createAuthService } = require('./services/auth.service');
const { createBlogService } = require('./services/blog.service');
const { createCartService } = require('./services/cart.service');
const { createLogisticsService } = require('./services/logistics.service');
const { createNewsletterService } = require('./services/newsletter.service');
const { createOrdersService } = require('./services/orders.service');
const { createPaymentsService } = require('./services/payments.service');
const { createProductsService } = require('./services/products.service');
const { createSellerDashboardService } = require('./services/seller-dashboard.service');
const { createSellerFinanceService } = require('./services/seller-finance.service');
const { createSellersService } = require('./services/sellers.service');
const { createCacVerificationService } = require('./services/cac-verification.service');
const { createAdminController } = require('./controllers/admin.controller');
const { createAdminDashboardController } = require('./controllers/admin-dashboard.controller');
const { createAuthController } = require('./controllers/auth.controller');
const { createBlogController } = require('./controllers/blog.controller');
const { createCartController } = require('./controllers/cart.controller');
const { createLogisticsController } = require('./controllers/logistics.controller');
const { createMeController } = require('./controllers/me.controller');
const { createNewsletterController } = require('./controllers/newsletter.controller');
const { createOrdersController } = require('./controllers/orders.controller');
const { createPaymentsController } = require('./controllers/payments.controller');
const { createProductsController } = require('./controllers/products.controller');
const { createSellerDashboardController } = require('./controllers/seller-dashboard.controller');
const { createSellerFinanceController } = require('./controllers/seller-finance.controller');
const { createSellerController } = require('./controllers/seller.controller');
const { createSellerInventoryController } = require('./controllers/seller-inventory.controller');
const { createSellerOrdersController } = require('./controllers/seller-orders.controller');
const { createSellerProductsController } = require('./controllers/seller-products.controller');
const { createRiderController } = require('./controllers/rider.controller');
const { createAdminRouter } = require('./routes/admin.routes');
const { createAuthRouter } = require('./routes/auth.routes');
const { createBlogRouter } = require('./routes/blog.routes');
const { createCartRouter } = require('./routes/cart.routes');
const { createLogisticsRouter } = require('./routes/logistics.routes');
const { createMeRouter } = require('./routes/me.routes');
const { createNewsletterRouter } = require('./routes/newsletter.routes');
const { createOrdersRouter } = require('./routes/orders.routes');
const { createPaymentsRouter } = require('./routes/payments.routes');
const { createProductsRouter } = require('./routes/products.routes');
const { createRiderRouter } = require('./routes/rider.routes');
const { createSellerDashboardRouter } = require('./routes/seller-dashboard.routes');
const { createSellerFinanceRouter } = require('./routes/seller-finance.routes');
const { createSellerInventoryRouter } = require('./routes/seller-inventory.routes');
const { createSellerOrdersRouter } = require('./routes/seller-orders.routes');
const { createSellerRouter } = require('./routes/seller.routes');
const { createSellerProductsRouter } = require('./routes/seller-products.routes');
const { createWebhooksRouter } = require('./routes/webhooks.routes');
const {
  createAdminAuthMiddleware,
  createAuthMiddleware,
  createLogisticsCompanyAuthMiddleware,
  createRiderAuthMiddleware
} = require('./middleware/auth.middleware');
const { createCorsMiddleware } = require('./middleware/cors.middleware');
const { createErrorMiddleware } = require('./middleware/error.middleware');
const env = require('./config/env');
const jwtUtils = require('./utils/jwt');
const { createPaystackClient } = require('./utils/paystack');
const passwordUtils = require('./utils/password');
const passwordResetUtils = require('./utils/password-reset');
const { ensureProductUploadDirectory } = require('./utils/product-image-files');

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
  const blogCategoriesRepository = overrides.blogCategoriesRepository || createBlogCategoriesRepository({
    db: resolveDb()
  });
  const blogCommentsRepository = overrides.blogCommentsRepository || createBlogCommentsRepository({
    db: resolveDb()
  });
  const blogPostTagsRepository = overrides.blogPostTagsRepository || createBlogPostTagsRepository({
    db: resolveDb()
  });
  const blogPostsRepository = overrides.blogPostsRepository || createBlogPostsRepository({
    db: resolveDb()
  });
  const blogTagsRepository = overrides.blogTagsRepository || createBlogTagsRepository({
    db: resolveDb()
  });
  const newsletterSubscribersRepository = overrides.newsletterSubscribersRepository
    || createNewsletterSubscribersRepository({
      db: resolveDb()
    });
  const adminRepository = overrides.adminRepository || createAdminRepository({
    db: resolveDb()
  });
  const adminDashboardRepository = overrides.adminDashboardRepository || createAdminDashboardRepository({
    db: resolveDb()
  });
  const auditLogRepository = overrides.auditLogRepository || createAuditLogRepository({
    db: resolveDb()
  });
  const productsRepository = overrides.productsRepository || createProductsRepository({
    db: resolveDb()
  });
  const platformConfigRepository = overrides.platformConfigRepository || createPlatformConfigRepository({
    db: resolveDb()
  });
  const buyerAddressesRepository = overrides.buyerAddressesRepository || createBuyerAddressesRepository({
    db: resolveDb()
  });
  const cartsRepository = overrides.cartsRepository || createCartsRepository({
    db: resolveDb()
  });
  const disputesRepository = overrides.disputesRepository || createDisputesRepository({
    db: resolveDb()
  });
  const deliveryJobsRepository = overrides.deliveryJobsRepository || createDeliveryJobsRepository({
    db: resolveDb()
  });
  const logisticsRepository = overrides.logisticsRepository || createLogisticsRepository({
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
    baseUrl: appEnv.PAYSTACK_BASE_URL,
    secretKey: appEnv.PAYSTACK_SECRET_KEY,
    logger: appLogger
  });
  const paymentsService = overrides.paymentsService || createPaymentsService({
    paymentsRepository,
    paystackClient,
    env: appEnv,
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
  const newsletterService = overrides.newsletterService || createNewsletterService({
    newsletterSubscribersRepository
  });
  const assignmentService = overrides.assignmentService || createAssignmentService({
    deliveryJobsRepository,
    logisticsRepository
  });
  const adminService = overrides.adminService || createAdminService({
    assignmentService,
    env: appEnv,
    adminRepository,
    auditLogRepository,
    blogCategoriesRepository,
    blogCommentsRepository,
    blogPostTagsRepository,
    blogPostsRepository,
    blogTagsRepository,
    deliveryJobsRepository,
    disputesRepository,
    logisticsRepository,
    newsletterSubscribersRepository,
    platformConfigRepository,
    productsRepository,
    sellerFinanceRepository,
    usersRepository,
    sellersRepository,
    ordersRepository,
    paymentsService,
    jwtUtils: overrides.jwtUtils || jwtUtils,
    passwordUtils: overrides.passwordUtils || passwordUtils
  });
  const adminDashboardService = overrides.adminDashboardService || createAdminDashboardService({
    adminDashboardRepository,
    adminRepository,
    auditLogRepository,
    disputesRepository,
    env: appEnv,
    platformConfigRepository
  });
  const cartService = overrides.cartService || createCartService({
    cartsRepository,
    env: appEnv,
    productsRepository
  });
  const logisticsService = overrides.logisticsService || createLogisticsService({
    assignmentService,
    deliveryJobsRepository,
    env: appEnv,
    jwtUtils: overrides.jwtUtils || jwtUtils,
    logisticsRepository,
    passwordUtils: overrides.passwordUtils || passwordUtils,
    sellerFinanceRepository
  });
  const ordersService = overrides.ordersService || createOrdersService({
    assignmentService,
    buyerAddressesRepository,
    cartsRepository,
    deliveryJobsRepository,
    env: appEnv,
    ordersRepository,
    sellersRepository
  });
  const productsService = overrides.productsService || createProductsService({
    env: appEnv,
    productsRepository,
    sellersRepository
  });
  const blogService = overrides.blogService || createBlogService({
    blogCategoriesRepository,
    blogCommentsRepository,
    blogPostTagsRepository,
    blogPostsRepository,
    blogTagsRepository,
    env: appEnv,
    productsService
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
    platformConfigRepository,
    sellerFinanceRepository,
    sellersRepository
  });
  const sellerDashboardService = overrides.sellerDashboardService || createSellerDashboardService({
    env: appEnv,
    ordersRepository,
    platformConfigRepository,
    productsRepository,
    sellerFinanceRepository,
    sellersRepository
  });

  return {
    adminController: overrides.adminController || createAdminController({ adminService }),
    adminDashboardController: overrides.adminDashboardController
      || createAdminDashboardController({ adminDashboardService }),
    authController: overrides.authController || createAuthController({ authService }),
    blogController: overrides.blogController || createBlogController({ blogService }),
    cartController: overrides.cartController || createCartController({ cartService }),
    logisticsController: overrides.logisticsController
      || createLogisticsController({ logisticsService }),
    riderController: overrides.riderController || createRiderController({ logisticsService }),
    meController: overrides.meController || createMeController(),
    newsletterController: overrides.newsletterController
      || createNewsletterController({ newsletterService }),
    ordersController: overrides.ordersController || createOrdersController({ ordersService }),
    paymentsController: overrides.paymentsController || createPaymentsController({
      paymentsService,
      logger: appLogger
    }),
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
    logisticsCompanyAuthMiddleware: overrides.logisticsCompanyAuthMiddleware
      || createLogisticsCompanyAuthMiddleware({ logisticsService }),
    riderAuthMiddleware: overrides.riderAuthMiddleware || createRiderAuthMiddleware({ logisticsService }),
    errorMiddleware: overrides.errorMiddleware || createErrorMiddleware({ logger: appLogger }),
    env: appEnv,
    logger: appLogger
  };
}

function createApp(overrides = {}) {
  const dependencies = createDependencies(overrides);
  ensureProductUploadDirectory(dependencies.env);
  const app = express();

  app.set('trust proxy', 1);

  app.use(createCorsMiddleware({ env: dependencies.env }));
  app.use('/webhooks/paystack', express.raw({ type: 'application/json' }));
  app.use('/webhooks', createWebhooksRouter({
    paymentsController: dependencies.paymentsController
  }));
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


  app.use('/uploads', express.static(dependencies.env.UPLOAD_DIR, {
    maxAge: '7d',
    index: false,
    dotfiles: 'deny'
  }));

  app.use('/api/v1/auth', createAuthRouter({
    authController: dependencies.authController,
    authMiddleware: dependencies.authMiddleware
  }));

  app.use('/api/v1/admin', createAdminRouter({
    adminAuthMiddleware: dependencies.adminAuthMiddleware,
    adminController: dependencies.adminController,
    adminDashboardController: dependencies.adminDashboardController,
    env: dependencies.env
  }));

  app.use('/api/v1', createMeRouter({
    meController: dependencies.meController,
    authMiddleware: dependencies.authMiddleware
  }));

  app.use('/api/v1/products', createProductsRouter({
    productsController: dependencies.productsController
  }));

  app.use('/api/v1/blog', createBlogRouter({
    blogController: dependencies.blogController
  }));

  app.use('/api/v1/newsletter', createNewsletterRouter({
    newsletterController: dependencies.newsletterController
  }));

  app.use('/api/v1/cart', createCartRouter({
    authMiddleware: dependencies.authMiddleware,
    cartController: dependencies.cartController
  }));

  app.use('/api/v1/logistics', createLogisticsRouter({
    logisticsCompanyAuthMiddleware: dependencies.logisticsCompanyAuthMiddleware,
    logisticsController: dependencies.logisticsController
  }));

  app.use('/api/v1/rider', createRiderRouter({
    riderAuthMiddleware: dependencies.riderAuthMiddleware,
    riderController: dependencies.riderController
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
