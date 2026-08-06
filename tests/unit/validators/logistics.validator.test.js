require('../../setup/jest');

const {
  assignAdminDeliveryJobSchema,
  createRiderSchema,
  getDeliveryJobSchema,
  getLogisticsMeSchema,
  getLogisticsRiderSchema,
  getRiderMeSchema,
  listAdminLogisticsCompaniesSchema,
  listAdminDeliveryJobsSchema,
  listAdminLogisticsRidersSchema,
  listDeliveryZonesSchema,
  listLogisticsJobsSchema,
  listLogisticsRidersSchema,
  logisticsLoginSchema,
  logisticsRegisterSchema,
  manageLogisticsRiderAccountSchema,
  riderLoginSchema,
  updateAdminLogisticsCompanyStatusSchema,
  updateDeliveryJobStatusSchema,
  updateLogisticsRiderSchema,
  updateRiderAvailabilitySchema
} = require('../../../src/validators/logistics.validator');

describe('logistics validator', () => {
  it('accepts a valid logistics company registration payload', () => {
    const { error, value } = logisticsRegisterSchema.validate({
      body: {
        name: 'Swift Dispatch',
        email: 'ops@swift.ng',
        phone: '08012345678',
        password: 'Password123',
        address: '12 Sapara Williams Close'
      }
    });

    expect(error).toBeUndefined();
    expect(value.body.phone).toBe('08012345678');
  });

  it('accepts a valid logistics company login payload', () => {
    const { error } = logisticsLoginSchema.validate({
      body: {
        identifier: 'ops@swift.ng',
        password: 'Password123'
      }
    });

    expect(error).toBeUndefined();
  });

  it('accepts company me and delivery zone request envelopes', () => {
    expect(getLogisticsMeSchema.validate({}).error).toBeUndefined();
    expect(listDeliveryZonesSchema.validate({}).error).toBeUndefined();
  });

  it('accepts a valid rider creation payload', () => {
    const { error } = createRiderSchema.validate({
      body: {
        fullName: 'Alex Rider',
        email: 'alex@swift.ng',
        phone: '08012345679',
        password: 'Password123',
        vehicleType: 'van',
        zoneId: 7,
        status: 'available'
      }
    });

    expect(error).toBeUndefined();
  });

  it('accepts valid logistics rider queries and params', () => {
    const riderList = listLogisticsRidersSchema.validate({
      query: {
        status: 'available',
        page: '2',
        limit: '5'
      }
    });
    const riderDetail = getLogisticsRiderSchema.validate({
      params: {
        id: '17'
      }
    });

    expect(riderList.error).toBeUndefined();
    expect(riderList.value.query.page).toBe(2);
    expect(riderDetail.error).toBeUndefined();
    expect(riderDetail.value.params.id).toBe(17);
  });

  it('accepts a valid logistics rider update payload', () => {
    const { error } = updateLogisticsRiderSchema.validate({
      body: {
        vehicleType: 'bike',
        status: 'inactive'
      },
      params: {
        id: 17
      }
    });

    expect(error).toBeUndefined();
  });

  it('accepts a valid logistics rider suspension envelope', () => {
    const { error, value } = manageLogisticsRiderAccountSchema.validate({
      params: {
        id: '17'
      }
    });

    expect(error).toBeUndefined();
    expect(value.params.id).toBe(17);
  });

  it('accepts admin logistics company and rider list filters', () => {
    expect(listAdminLogisticsCompaniesSchema.validate({
      query: {
        status: 'pending',
        search: 'swift'
      }
    }).error).toBeUndefined();

    expect(listAdminLogisticsRidersSchema.validate({
      query: {
        companyId: '4',
        status: 'available'
      }
    }).error).toBeUndefined();

    expect(listAdminDeliveryJobsSchema.validate({
      query: {
        companyId: '4',
        riderId: '11',
        status: 'pending',
        search: 'Brake Disc'
      }
    }).error).toBeUndefined();
  });

  it('accepts a valid admin logistics company status update payload', () => {
    const { error } = updateAdminLogisticsCompanyStatusSchema.validate({
      body: {
        status: 'approved'
      },
      params: {
        id: 11
      }
    });

    expect(error).toBeUndefined();
  });

  it('accepts a valid admin manual delivery assignment payload', () => {
    const { error } = assignAdminDeliveryJobSchema.validate({
      body: {
        riderId: 12,
        note: 'Assigning this job after the auto-assignment fallback queue review.'
      },
      params: {
        id: 19
      }
    });

    expect(error).toBeUndefined();
  });

  it('accepts valid rider auth and availability payloads', () => {
    expect(riderLoginSchema.validate({
      body: {
        identifier: 'alex@swift.ng',
        password: 'Password123'
      }
    }).error).toBeUndefined();

    expect(getRiderMeSchema.validate({}).error).toBeUndefined();

    expect(updateRiderAvailabilitySchema.validate({
      body: {
        status: 'unavailable'
      }
    }).error).toBeUndefined();
  });

  it('accepts valid rider job list/detail/status payloads', () => {
    const listResult = listLogisticsJobsSchema.validate({
      query: {
        status: 'assigned',
        search: 'Brake Disc',
        page: '2',
        limit: '5'
      }
    });
    const detailResult = getDeliveryJobSchema.validate({
      params: {
        id: '17'
      }
    });
    const statusResult = updateDeliveryJobStatusSchema.validate({
      body: {
        status: 'in_transit',
        note: 'Vehicle has left the pickup location.'
      },
      params: {
        id: 17
      }
    });

    expect(listResult.error).toBeUndefined();
    expect(listResult.value.query.page).toBe(2);
    expect(detailResult.error).toBeUndefined();
    expect(detailResult.value.params.id).toBe(17);
    expect(statusResult.error).toBeUndefined();
  });

  it('requires a failure reason when a rider marks a delivery job as failed', () => {
    const missingReason = updateDeliveryJobStatusSchema.validate({
      body: {
        status: 'failed'
      },
      params: {
        id: 17
      }
    });
    const withReason = updateDeliveryJobStatusSchema.validate({
      body: {
        status: 'failed',
        failureReason: 'Buyer was unavailable on arrival.'
      },
      params: {
        id: 17
      }
    });

    expect(missingReason.error).toBeDefined();
    expect(withReason.error).toBeUndefined();
  });
});
