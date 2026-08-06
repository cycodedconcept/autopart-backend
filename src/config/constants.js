const USER_ROLES = {
  ADMIN: 'admin',
  BUYER: 'buyer',
  LOGISTICS: 'logistics',
  LOGISTICS_COMPANY: 'logistics_company',
  RIDER: 'rider',
  SELLER: 'seller'
};

const USER_ACCOUNT_STATUSES = {
  ACTIVE: 'active',
  BANNED: 'banned',
  SUSPENDED: 'suspended'
};

const TOKEN_SUBJECT_TYPES = {
  ADMIN: 'admin',
  LOGISTICS_COMPANY: 'logistics_company',
  RIDER: 'rider',
  USER: 'user'
};

const ADMIN_ROLE_NAMES = {
  SUPER_ADMIN: 'super_admin',
  VERIFICATION_ADMIN: 'verification_admin'
};

const ADMIN_PERMISSION_KEYS = {
  APPROVE_PAYOUTS: 'payouts.approve',
  READ_DASHBOARD: 'dashboard.read',
  MANAGE_CATEGORIES: 'categories.manage',
  MANAGE_CONFIG: 'config.manage',
  MANAGE_LOGISTICS: 'logistics.manage',
  MANAGE_ORDERS: 'orders.manage',
  MANAGE_USERS: 'users.manage',
  READ_AUDIT_LOGS: 'audit_logs.read',
  READ_SELF: 'admins.read_self',
  RESOLVE_DISPUTES: 'disputes.resolve',
  VERIFY_SELLERS: 'sellers.verify'
};

const ADMIN_PERMISSION_DEFINITIONS = [
  {
    key: ADMIN_PERMISSION_KEYS.READ_DASHBOARD,
    description: 'Read the super admin dashboard overview and operational widgets.'
  },
  {
    key: ADMIN_PERMISSION_KEYS.READ_SELF,
    description: 'View the authenticated admin profile and assigned permissions.'
  },
  {
    key: ADMIN_PERMISSION_KEYS.VERIFY_SELLERS,
    description: 'Review and update seller verification decisions.'
  },
  {
    key: ADMIN_PERMISSION_KEYS.MANAGE_CATEGORIES,
    description: 'Create, update, archive, and restore catalogue categories.'
  },
  {
    key: ADMIN_PERMISSION_KEYS.MANAGE_USERS,
    description: 'Review and update buyer or seller account access.'
  },
  {
    key: ADMIN_PERMISSION_KEYS.MANAGE_ORDERS,
    description: 'Review and intervene in platform-wide order workflows.'
  },
  {
    key: ADMIN_PERMISSION_KEYS.APPROVE_PAYOUTS,
    description: 'Review seller payout requests and advance payout states.'
  },
  {
    key: ADMIN_PERMISSION_KEYS.MANAGE_CONFIG,
    description: 'Update global platform configuration values.'
  },
  {
    key: ADMIN_PERMISSION_KEYS.MANAGE_LOGISTICS,
    description: 'Review logistics companies and riders, and manage company access.'
  },
  {
    key: ADMIN_PERMISSION_KEYS.RESOLVE_DISPUTES,
    description: 'Review and resolve buyer or seller disputes.'
  },
  {
    key: ADMIN_PERMISSION_KEYS.READ_AUDIT_LOGS,
    description: 'Read sensitive admin audit log entries.'
  }
];

const ADMIN_ROLE_DEFINITIONS = [
  {
    name: ADMIN_ROLE_NAMES.SUPER_ADMIN,
    description: 'Full-access administrator for platform operations.',
    permissionKeys: Object.values(ADMIN_PERMISSION_KEYS)
  },
  {
    name: ADMIN_ROLE_NAMES.VERIFICATION_ADMIN,
    description: 'Scoped administrator for seller verification reviews.',
    permissionKeys: [
      ADMIN_PERMISSION_KEYS.READ_SELF,
      ADMIN_PERMISSION_KEYS.VERIFY_SELLERS
    ]
  }
];

const PRODUCT_STATUSES = {
  ACTIVE: 'active',
  INACTIVE: 'inactive'
};

const CATEGORY_STATUSES = {
  ACTIVE: 'active',
  ARCHIVED: 'archived'
};

const SELLER_DOCUMENT_TYPES = {
  CAC: 'cac',
  PROOF_OF_ADDRESS: 'proof_of_address'
};

const CAC_VERIFICATION_OUTCOMES = {
  COMPLETED: 'completed',
  FAILED: 'failed',
  NOT_CONFIGURED: 'not_configured',
  UNAVAILABLE: 'unavailable'
};

const SELLER_VERIFICATION_STATUSES = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  REJECTED: 'rejected'
};

const ORDER_STATUSES = {
  CANCELLED: 'cancelled',
  CONFIRMED: 'confirmed',
  DELIVERED: 'delivered',
  DISPUTED: 'disputed',
  IN_TRANSIT: 'in_transit',
  PENDING_PAYMENT: 'pending_payment',
  PICKED_UP: 'picked_up'
};

const ORDER_ITEM_STATUSES = {
  CANCELLED: 'cancelled',
  DELIVERED: 'delivered',
  PENDING: 'pending',
  PICKED_UP: 'picked_up',
  READY_FOR_PICKUP: 'ready_for_pickup'
};

const DELIVERY_JOB_STATUSES = {
  ASSIGNED: 'assigned',
  CANCELLED: 'cancelled',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  IN_TRANSIT: 'in_transit',
  PENDING: 'pending',
  PICKED_UP: 'picked_up'
};

const LOGISTICS_COMPANY_STATUSES = {
  APPROVED: 'approved',
  PENDING: 'pending',
  SUSPENDED: 'suspended'
};

const RIDER_STATUSES = {
  AVAILABLE: 'available',
  INACTIVE: 'inactive',
  ON_DELIVERY: 'on_delivery',
  UNAVAILABLE: 'unavailable'
};

const RIDER_ACCOUNT_STATUSES = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended'
};

const PAYMENT_METHODS = {
  BANK_TRANSFER: 'bank_transfer',
  PAYSTACK: 'paystack',
  USSD: 'ussd'
};

const PAYMENT_STATUSES = {
  CANCELLED: 'cancelled',
  FAILED: 'failed',
  PAID: 'paid',
  PENDING: 'pending'
};

const PAYOUT_STATUSES = {
  APPROVED: 'approved',
  PAID: 'paid',
  REQUESTED: 'requested',
  REJECTED: 'rejected'
};

const PAYOUT_PAYEE_TYPES = {
  LOGISTICS_COMPANY: 'logistics_company',
  SELLER: 'seller'
};

const DISPUTE_RAISED_BY = {
  BUYER: 'buyer',
  SELLER: 'seller'
};

const DISPUTE_STATUSES = {
  OPEN: 'open',
  REJECTED: 'rejected',
  RESOLVED: 'resolved'
};

const PLATFORM_CONFIG_KEYS = {
  COMMISSION_RATE_DEFAULT: 'commission_rate_default',
  COMMISSION_RATES_BY_CATEGORY: 'commission_rates_by_category',
  COMMISSION_RATES_BY_SELLER_TIER: 'commission_rates_by_seller_tier',
  PLATFORM_SETTINGS: 'platform_settings'
};

const ERROR_CODES = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  CART_EMPTY: 'CART_EMPTY',
  CONFLICT: 'CONFLICT',
  FORBIDDEN: 'FORBIDDEN',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INVALID_RESET_TOKEN: 'INVALID_RESET_TOKEN',
  NOT_FOUND: 'NOT_FOUND',
  OUT_OF_STOCK: 'OUT_OF_STOCK',
  PAYMENT_CONFIGURATION_ERROR: 'PAYMENT_CONFIGURATION_ERROR',
  PAYMENT_INITIALIZATION_FAILED: 'PAYMENT_INITIALIZATION_FAILED',
  PAYMENT_VERIFICATION_FAILED: 'PAYMENT_VERIFICATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  VALIDATION_ERROR: 'VALIDATION_ERROR'
};

module.exports = {
  ADMIN_PERMISSION_DEFINITIONS,
  ADMIN_PERMISSION_KEYS,
  ADMIN_ROLE_DEFINITIONS,
  ADMIN_ROLE_NAMES,
  CATEGORY_STATUSES,
  DELIVERY_JOB_STATUSES,
  DISPUTE_RAISED_BY,
  DISPUTE_STATUSES,
  LOGISTICS_COMPANY_STATUSES,
  ORDER_ITEM_STATUSES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PAYOUT_PAYEE_TYPES,
  PAYOUT_STATUSES,
  PLATFORM_CONFIG_KEYS,
  PRODUCT_STATUSES,
  CAC_VERIFICATION_OUTCOMES,
  RIDER_STATUSES,
  RIDER_ACCOUNT_STATUSES,
  SELLER_DOCUMENT_TYPES,
  SELLER_VERIFICATION_STATUSES,
  TOKEN_SUBJECT_TYPES,
  USER_ACCOUNT_STATUSES,
  USER_ROLES,
  ERROR_CODES
};
