const Joi = require('joi');
const { buildPaginationQuerySchema } = require('./pagination.validator');
const {
  DELIVERY_JOB_STATUSES,
  LOGISTICS_COMPANY_STATUSES,
  RIDER_STATUSES
} = require('../config/constants');
const { isValidNigerianPhone } = require('../utils/phone');

function nigerianPhoneRule(value, helpers) {
  if (!isValidNigerianPhone(value)) {
    return helpers.error('string.nigerianPhone');
  }

  return value;
}

const logisticsPasswordSchema = Joi.string()
  .min(8)
  .max(72)
  .pattern(/[A-Z]/, 'uppercase letter')
  .pattern(/[a-z]/, 'lowercase letter')
  .pattern(/\d/, 'number');

const riderManagementStatuses = [
  RIDER_STATUSES.AVAILABLE,
  RIDER_STATUSES.INACTIVE,
  RIDER_STATUSES.ON_DELIVERY,
  RIDER_STATUSES.UNAVAILABLE
];

const riderAvailabilityStatuses = [
  RIDER_STATUSES.AVAILABLE,
  RIDER_STATUSES.ON_DELIVERY,
  RIDER_STATUSES.UNAVAILABLE
];

const logisticsJobStatuses = [
  'all',
  ...Object.values(DELIVERY_JOB_STATUSES)
];

const logisticsCompanyStatuses = [
  'all',
  ...Object.values(LOGISTICS_COMPANY_STATUSES)
];

const riderListStatuses = [
  'all',
  ...riderManagementStatuses
];

const logisticsRegisterSchema = Joi.object({
  body: Joi.object({
    name: Joi.string().trim().min(2).max(160).required(),
    email: Joi.string().trim().lowercase().email().required(),
    phone: Joi.string().trim().custom(nigerianPhoneRule).required().messages({
      'string.nigerianPhone': 'phone must be a valid Nigerian phone number'
    }),
    password: logisticsPasswordSchema.required(),
    address: Joi.string().trim().min(5).max(500).required()
  }).required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const logisticsLoginSchema = Joi.object({
  body: Joi.object({
    identifier: Joi.string().trim().min(5).max(255).required(),
    password: Joi.string().min(8).max(72).required()
  }).required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const getLogisticsMeSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const listDeliveryZonesSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const createRiderSchema = Joi.object({
  body: Joi.object({
    fullName: Joi.string().trim().min(2).max(160).required(),
    email: Joi.string().trim().lowercase().email().required(),
    phone: Joi.string().trim().custom(nigerianPhoneRule).required().messages({
      'string.nigerianPhone': 'phone must be a valid Nigerian phone number'
    }),
    password: logisticsPasswordSchema.required(),
    vehicleType: Joi.string().trim().min(2).max(120).required(),
    zoneId: Joi.number().integer().positive().required(),
    status: Joi.string().valid(...riderManagementStatuses).optional()
  }).required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const listLogisticsRidersSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: buildPaginationQuerySchema({
    status: Joi.string().valid(...riderListStatuses).default('all'),
    search: Joi.string().trim().max(120).allow('', null).optional()
  })
});

const getLogisticsRiderSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }).required(),
  query: Joi.object({}).default({})
});

const manageLogisticsRiderAccountSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }).required(),
  query: Joi.object({}).default({})
});

const updateLogisticsRiderSchema = Joi.object({
  body: Joi.object({
    fullName: Joi.string().trim().min(2).max(160).optional(),
    email: Joi.string().trim().lowercase().email().optional(),
    phone: Joi.string().trim().custom(nigerianPhoneRule).optional().messages({
      'string.nigerianPhone': 'phone must be a valid Nigerian phone number'
    }),
    vehicleType: Joi.string().trim().min(2).max(120).optional(),
    zoneId: Joi.number().integer().positive().optional(),
    status: Joi.string().valid(...riderManagementStatuses).optional()
  }).or('fullName', 'email', 'phone', 'vehicleType', 'zoneId', 'status').required(),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }).required(),
  query: Joi.object({}).default({})
});

const listLogisticsJobsSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: buildPaginationQuerySchema({
    status: Joi.string().valid(...logisticsJobStatuses).default('all'),
    search: Joi.string().trim().max(120).allow('', null).optional()
  })
});

const getLogisticsEarningsSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const createLogisticsPayoutSchema = Joi.object({
  body: Joi.object({
    bankAccountRef: Joi.string().trim().min(3).max(255).required()
  }).required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const listAdminLogisticsCompaniesSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: buildPaginationQuerySchema({
    status: Joi.string().valid(...logisticsCompanyStatuses).default('all'),
    search: Joi.string().trim().max(120).allow('', null).optional()
  })
});

const updateAdminLogisticsCompanyStatusSchema = Joi.object({
  body: Joi.object({
    status: Joi.string()
      .valid(
        LOGISTICS_COMPANY_STATUSES.APPROVED,
        LOGISTICS_COMPANY_STATUSES.SUSPENDED
      )
      .required()
  }).required(),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }).required(),
  query: Joi.object({}).default({})
});

const listAdminLogisticsRidersSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: buildPaginationQuerySchema({
    companyId: Joi.number().integer().positive().optional(),
    status: Joi.string().valid(...riderListStatuses).default('all'),
    search: Joi.string().trim().max(120).allow('', null).optional()
  })
});

const listAdminDeliveryJobsSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: buildPaginationQuerySchema({
    companyId: Joi.number().integer().positive().optional(),
    riderId: Joi.number().integer().positive().optional(),
    status: Joi.string().valid(...logisticsJobStatuses).default('all'),
    search: Joi.string().trim().max(120).allow('', null).optional()
  })
});

const assignAdminDeliveryJobSchema = Joi.object({
  body: Joi.object({
    riderId: Joi.number().integer().positive().required(),
    note: Joi.string().trim().min(5).max(255).optional()
  }).required(),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }).required(),
  query: Joi.object({}).default({})
});

const riderLoginSchema = Joi.object({
  body: Joi.object({
    identifier: Joi.string().trim().min(5).max(255).required(),
    password: Joi.string().min(8).max(72).required()
  }).required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const getRiderMeSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const updateRiderAvailabilitySchema = Joi.object({
  body: Joi.object({
    status: Joi.string().valid(...riderAvailabilityStatuses).required()
  }).required(),
  params: Joi.object({}).default({}),
  query: Joi.object({}).default({})
});

const getDeliveryJobSchema = Joi.object({
  body: Joi.object({}).default({}),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }).required(),
  query: Joi.object({}).default({})
});

const updateDeliveryJobStatusSchema = Joi.object({
  body: Joi.object({
    status: Joi.string()
      .valid(
        DELIVERY_JOB_STATUSES.PICKED_UP,
        DELIVERY_JOB_STATUSES.IN_TRANSIT,
        DELIVERY_JOB_STATUSES.DELIVERED,
        DELIVERY_JOB_STATUSES.FAILED
      )
      .required(),
    note: Joi.string().trim().min(5).max(255).optional(),
    failureReason: Joi.string().trim().min(5).max(255).when('status', {
      is: DELIVERY_JOB_STATUSES.FAILED,
      then: Joi.required(),
      otherwise: Joi.optional()
    })
  }).required(),
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  }).required(),
  query: Joi.object({}).default({})
});

module.exports = {
  assignAdminDeliveryJobSchema,
  createLogisticsPayoutSchema,
  createRiderSchema,
  getDeliveryJobSchema,
  getLogisticsEarningsSchema,
  getLogisticsMeSchema,
  getLogisticsRiderSchema,
  getRiderMeSchema,
  manageLogisticsRiderAccountSchema,
  listAdminLogisticsCompaniesSchema,
  listAdminDeliveryJobsSchema,
  listAdminLogisticsRidersSchema,
  listDeliveryZonesSchema,
  listLogisticsJobsSchema,
  listLogisticsRidersSchema,
  logisticsLoginSchema,
  logisticsRegisterSchema,
  riderLoginSchema,
  updateAdminLogisticsCompanyStatusSchema,
  updateDeliveryJobStatusSchema,
  updateLogisticsRiderSchema,
  updateRiderAvailabilitySchema
};
