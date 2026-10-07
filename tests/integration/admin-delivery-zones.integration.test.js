const { expect } = require('chai');
const request = require('supertest');
const { createApp } = require('../../src/app');
const { ADMIN_ROLE_NAMES, TOKEN_SUBJECT_TYPES } = require('../../src/config/constants');
const { signAccessToken } = require('../../src/utils/jwt');
const { createInMemoryAdminRepository } = require('./support/in-memory-admin-repository');
const { createInMemoryCommerceStore } = require('./support/in-memory-commerce-store');
const { createInMemoryLogisticsRepository } = require('./support/in-memory-logistics-repository');

describe('Admin delivery zone creation', () => {
  let app;
  let token;
  let restrictedToken;
  let store;
  const endpoint = '/api/v1/admin/logistics/zones';
  const payload = { name: 'Lekki Phase 1', state: 'Lagos', city: 'Lekki' };

  beforeEach(async () => {
    store = createInMemoryCommerceStore();
    const adminRepository = createInMemoryAdminRepository({});
    const admin = await adminRepository.createAdmin({
      fullName: 'Zone Admin', email: 'zones@example.com',
      roleNames: [ADMIN_ROLE_NAMES.SUPER_ADMIN]
    });
    const restricted = await adminRepository.createAdmin({
      fullName: 'Restricted Admin', email: 'restricted@example.com', roleNames: []
    });
    token = signAccessToken({ sub: admin.id, actorType: TOKEN_SUBJECT_TYPES.ADMIN });
    restrictedToken = signAccessToken({ sub: restricted.id, actorType: TOKEN_SUBJECT_TYPES.ADMIN });
    app = createApp({
      adminRepository,
      logisticsRepository: createInMemoryLogisticsRepository({ store })
    });
  });

  it('creates a zone and exposes it in the logistics zone list', async () => {
    const created = await request(app).post(endpoint)
      .set('Authorization', `Bearer ${token}`)
      .send({ ...payload, name: ` ${payload.name} ` }).expect(201);
    expect(created.body.success).to.equal(true);
    expect(created.body.data).to.include(payload);
    expect(created.body.data.id).to.be.a('number');

    const company = await request(app).post('/api/v1/logistics/register').send({
      name: 'Zone Dispatch', email: 'dispatch@example.com', phone: '08012345678',
      password: 'Password123', address: '12 Lekki Road, Lagos'
    }).expect(201);
    const listed = await request(app).get('/api/v1/logistics/zones')
      .set('Authorization', `Bearer ${company.body.data.token}`).expect(200);
    expect(listed.body.data.zones).to.deep.include(created.body.data);
  });

  it('returns 409 for a duplicate without creating another zone', async () => {
    await request(app).post(endpoint).set('Authorization', `Bearer ${token}`)
      .send(payload).expect(201);
    const response = await request(app).post(endpoint).set('Authorization', `Bearer ${token}`)
      .send({ ...payload, name: payload.name.toUpperCase() }).expect(409);
    expect(response.body.error.code).to.equal('CONFLICT');
    expect(store.deliveryZones.filter((zone) => zone.city === payload.city)).to.have.length(1);
  });

  it('requires authentication and logistics management permission', async () => {
    await request(app).post(endpoint).send(payload).expect(401);
    await request(app).post(endpoint).set('Authorization', `Bearer ${restrictedToken}`)
      .send(payload).expect(403);
    const buyerToken = signAccessToken({ sub: 1, actorType: TOKEN_SUBJECT_TYPES.USER });
    await request(app).post(endpoint).set('Authorization', `Bearer ${buyerToken}`)
      .send(payload).expect(401);
    expect(store.deliveryZones).to.have.length(2);
  });

  it('rejects missing, empty and oversized fields', async () => {
    for (const body of [
      {}, { ...payload, name: ' ' }, { ...payload, name: 'x'.repeat(161) },
      { ...payload, state: 'x'.repeat(121) }, { ...payload, city: 'x'.repeat(121) }
    ]) {
      await request(app).post(endpoint).set('Authorization', `Bearer ${token}`)
        .send(body).expect(422);
    }
    expect(store.deliveryZones).to.have.length(2);
  });
});
