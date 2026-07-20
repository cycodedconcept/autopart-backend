const request = require('supertest');

async function registerAndLoginLogistics(app, logistics) {
  const uniqueSuffix = String(Date.now()).slice(-6);
  const companyRegisterResponse = await request(app)
    .post('/api/v1/logistics/register')
    .send({
      name: logistics.companyName || logistics.providerName || 'Swift Dispatch',
      email: logistics.companyEmail || `company+${Date.now()}@swift.ng`,
      phone: logistics.companyPhone || `08011${uniqueSuffix}`,
      password: logistics.companyPassword || logistics.password,
      address: logistics.companyAddress || '12 Sapara Williams Close, Victoria Island, Lagos'
    })
    .expect(201);

  const companyToken = companyRegisterResponse.body.data.token;
  const zonesResponse = await request(app)
    .get('/api/v1/logistics/zones')
    .set('Authorization', `Bearer ${companyToken}`)
    .expect(200);
  const zone = zonesResponse.body.data.zones[0];

  const riderResponse = await request(app)
    .post('/api/v1/logistics/riders')
    .set('Authorization', `Bearer ${companyToken}`)
    .send({
      fullName: logistics.riderFullName || logistics.fullName || 'Alex Rider',
      email: logistics.riderEmail || logistics.email,
      phone: logistics.riderPhone || logistics.phone,
      password: logistics.riderPassword || logistics.password,
      vehicleType: logistics.riderVehicleType || logistics.vehicleType || 'bike',
      zoneId: logistics.zoneId || zone.id,
      status: logistics.riderStatus || 'available'
    })
    .expect(201);

  const riderLoginResponse = await request(app)
    .post('/api/v1/rider/login')
    .send({
      identifier: logistics.riderEmail || logistics.email,
      password: logistics.riderPassword || logistics.password
    })
    .expect(200);

  return {
    companyId: companyRegisterResponse.body.data.company.id,
    companyToken,
    riderId: riderResponse.body.data.rider.id,
    token: riderLoginResponse.body.data.token,
    zoneId: zone.id
  };
}

async function getDeliveryJobByOrderItemId(app, riderToken, orderItemId) {
  const listResponse = await request(app)
    .get('/api/v1/rider/jobs')
    .set('Authorization', `Bearer ${riderToken}`)
    .query({
      page: 1,
      limit: 50
    })
    .expect(200);

  const job = listResponse.body.data.jobs.find((entry) => entry.orderItemId === Number(orderItemId));
  const resolvedJob = job || listResponse.body.data.jobs.find((entry) => (
    entry.item && entry.item.id === Number(orderItemId)
  ));

  if (!resolvedJob) {
    throw new Error(`Delivery job not found for order item ${orderItemId}.`);
  }

  return resolvedJob;
}

async function progressDeliveryJob(app, riderToken, orderItemId) {
  const deliveryJob = await getDeliveryJobByOrderItemId(app, riderToken, orderItemId);

  await request(app)
    .patch(`/api/v1/rider/jobs/${deliveryJob.id}/status`)
    .set('Authorization', `Bearer ${riderToken}`)
    .send({
      status: 'picked_up'
    })
    .expect(200);

  await request(app)
    .patch(`/api/v1/rider/jobs/${deliveryJob.id}/status`)
    .set('Authorization', `Bearer ${riderToken}`)
    .send({
      status: 'in_transit'
    })
    .expect(200);

  const deliveredResponse = await request(app)
    .patch(`/api/v1/rider/jobs/${deliveryJob.id}/status`)
    .set('Authorization', `Bearer ${riderToken}`)
    .send({
      status: 'delivered'
    })
    .expect(200);

  return deliveredResponse.body.data;
}

async function failDeliveryJob(app, riderToken, orderItemId, failureReason) {
  const deliveryJob = await getDeliveryJobByOrderItemId(app, riderToken, orderItemId);

  const response = await request(app)
    .patch(`/api/v1/rider/jobs/${deliveryJob.id}/status`)
    .set('Authorization', `Bearer ${riderToken}`)
    .send({
      status: 'failed',
      failureReason
    })
    .expect(200);

  return response.body.data;
}

module.exports = {
  failDeliveryJob,
  getDeliveryJobByOrderItemId,
  progressDeliveryJob,
  registerAndLoginLogistics
};
