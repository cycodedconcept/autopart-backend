require('../setup/env');
const assert = require('node:assert/strict');
const mysql = require('mysql2/promise');
const request = require('supertest');
const { createApp } = require('../../src/app');
const { createFixturesRepository } = require('./fixtures.repository');
const { createAdminAnalyticsRepository } = require('../../src/repositories/admin-analytics.repository');
const { createAdminAnalyticsService } = require('../../src/services/admin-analytics.service');
const { createAdminDisputesService } = require('../../src/services/admin-disputes.service');
const { createDisputesRepository } = require('../../src/repositories/disputes.repository');
const { createOrdersRepository } = require('../../src/repositories/orders.repository');
const { createAuditLogRepository } = require('../../src/repositories/audit-log.repository');
const { createPlatformConfigRepository } = require('../../src/repositories/platform-config.repository');
const { ADMIN_PERMISSION_KEYS } = require('../../src/config/constants');
const { analyticsWindow } = require('../../src/utils/admin-reporting');
const jwt = require('../../src/utils/jwt');

describe('Admin platform API against MySQL 8 (isolated fixtures)', function () {
  this.timeout(20000);
  let db, fixtures, app, analytics, disputesRepository, platformConfigRepository;
  const fixedNow = () => new Date('2026-09-06T12:00:00Z');
  const auth = (req) => req.set('Authorization', 'Bearer fixture-admin');

  before(async () => {
    // Deliberately fixed to the disposable compose service; never read application DB credentials.
    db = mysql.createPool({ host: '127.0.0.1', port: 33316, user: 'root', password: '', database: 'autoparts_admin_test' });
    fixtures = createFixturesRepository(db);
    await fixtures.seed();
    const adminAnalyticsRepository = createAdminAnalyticsRepository({ db });
    analytics = createAdminAnalyticsService({ adminAnalyticsRepository, now: fixedNow });
    disputesRepository = createDisputesRepository({ db });
    platformConfigRepository = createPlatformConfigRepository({ db });
    const adminDisputesService = createAdminDisputesService({ disputesRepository, platformConfigRepository,
      auditLogRepository: createAuditLogRepository({ db }), now: fixedNow });
    app = createApp({ db, adminAnalyticsService: analytics, adminDisputesService,
      adminAuthMiddleware: (req, res, next) => {
        if (req.headers.authorization === 'Bearer fixture-admin') req.admin = { id: 100, permissions: Object.values(ADMIN_PERMISSION_KEYS) };
        if (req.headers.authorization === 'Bearer no-permissions') req.admin = { id: 100, permissions: [] };
        next();
      }, logger: { info() {}, warn() {}, error(...args) { console.error(...args); } }
    });
  });
  after(async () => { if (db) await db.end(); });

  it('reconciles GMV, averages, changes, sellers and category shares without join duplication', async () => {
    const { body } = await auth(request(app).get('/api/v1/admin/analytics/platform?period=7d&topSellersLimit=20')).expect(200);
    assert.equal(body.success, true);
    const data = body.data;
    assert.equal(data.summary.totalGmvKobo.value, 6272);
    assert.equal(data.summary.totalOrders.value, 3);
    assert.equal(data.summary.activeSellers.value, 2);
    assert.equal(data.summary.totalOrders.changePercent, 200);
    assert.equal(data.summary.activeSellers.changePercent, 100);
    assert.equal(data.summary.avgOrderValueKobo.value, 2091);
    assert.ok(Math.abs(data.summary.avgOrderValueKobo.value * 3 - 6272) <= 1.5);
    assert.equal(data.gmvSeries.length, 7);
    assert.deepEqual(data.gmvSeries[0], { bucket: '2026-08-31', gmvKobo: 3301 });
    assert.equal(data.gmvSeries[1].gmvKobo, 0);
    assert.equal(data.gmvSeries.reduce((sum, row) => sum + row.gmvKobo, 0), 6272);
    assert.equal(data.ordersByWeek.length, 8);
    assert.equal(data.ordersByWeek.at(-1).orderCount, 3);
    assert.equal(data.categoryBreakdown.length, 6);
    assert.deepEqual(data.categoryBreakdown.at(-1), { categoryId: null, name: 'Other', orderCount: 2, percentage: 20 });
    assert.equal(data.categoryBreakdown.reduce((sum, row) => sum + Math.round(row.percentage * 100), 0), 10000);
    assert.equal(data.revenueByCategory.reduce((sum, row) => sum + row.revenueKobo, 0), 5902);
    assert.equal(data.topSellers.reduce((sum, row) => sum + row.gmvKobo, 0), 5902);
    assert.equal(data.topSellers[0].rank, 1);
    assert.equal(typeof data.topSellers[0].rating, 'number');
  });

  for (const period of ['30d', '90d', '1y']) it(`returns continuous, reconciling ${period} buckets`, async () => {
    const data = (await auth(request(app).get(`/api/v1/admin/analytics/platform?period=${period}`)).expect(200)).body.data;
    assert.equal(data.summary.totalGmvKobo.value, 6872);
    assert.equal(data.gmvSeries.length, analyticsWindow(period, fixedNow()).buckets.length);
    assert.equal(data.gmvSeries.reduce((sum, row) => sum + row.gmvKobo, 0), 6872);
    assert.equal(data.summary.totalGmvKobo.changePercent, null);
  });

  it('returns null averages/changes and zero buckets with no sales', async () => {
    const empty = createAdminAnalyticsService({ adminAnalyticsRepository: createAdminAnalyticsRepository({ db }),
      now: () => new Date('2027-01-01T12:00:00Z') });
    const data = await empty.getPlatformAnalytics({ period: '7d' });
    assert.deepEqual(data.summary.avgOrderValueKobo, { value: null, changePercent: null });
    assert.equal(data.summary.totalOrders.value, 0);
    assert.ok(data.gmvSeries.every((point) => point.gmvKobo === 0));
    assert.deepEqual(data.categoryBreakdown, []);
  });

  it('is independent of MySQL session timezone', async () => {
    const connection = await db.getConnection();
    try {
      await fixtures.setSessionTimezone(connection, '-07:00');
      const scopedDb = { getConnection: async () => ({ execute: (...args) => connection.execute(...args),
        query: (...args) => connection.query(...args), commit: () => connection.commit(),
        rollback: () => connection.rollback(), release() {} }) };
      const service = createAdminAnalyticsService({ adminAnalyticsRepository: createAdminAnalyticsRepository({ db: scopedDb }), now: fixedNow });
      assert.deepEqual(await service.getPlatformAnalytics({ period: '7d' }), await analytics.getPlatformAnalytics({ period: '7d' }));
    } finally { await fixtures.setSessionTimezone(connection, '+00:00'); connection.release(); }
  });

  it('exports all sections with attachment headers and matching totals', async () => {
    const response = await auth(request(app).get('/api/v1/admin/analytics/platform/export?period=7d')).expect(200);
    assert.match(response.headers['content-disposition'], /attachment; filename="platform-analytics-7d/);
    assert.match(response.headers['content-type'], /text\/csv/);
    for (const section of ['summary', 'gmvSeries', 'ordersByWeek', 'categoryBreakdown', 'revenueByCategory', 'topSellers']) assert.ok(response.text.includes(section));
    assert.ok(response.text.includes('summary,totalGmvKobo,6272,'));
  });

  it('lists seller context in one repository query, including empty pages', async () => {
    let calls = 0;
    const repository = createOrdersRepository({ db: { execute: (...args) => { calls += 1; return db.execute(...args); } } });
    for (const filters of [{ limit: 1 }, { limit: 20 }, { limit: 10, offset: 1000 }, { search: 'no-match' }]) {
      calls = 0;
      const result = await repository.listOrdersForAdmin(filters);
      assert.equal(calls, 1);
      assert.equal(result.total, filters.search ? 0 : 8);
      if (filters.offset || filters.search) assert.deepEqual(result.orders, []);
    }
    const result = (await auth(request(app).get('/api/v1/admin/orders?limit=20')).expect(200)).body.data;
    const mixed = result.orders.find((order) => order.id === 1);
    assert.deepEqual(mixed.seller, { id: 101, businessName: 'One Parts', location: 'Ikeja, Lagos' });
    assert.deepEqual(mixed.sellers.map((seller) => seller.id), [101, 102]);
    assert.deepEqual(result.orders.find((order) => order.id === 2).seller,
      { id: 101, businessName: 'One Parts', location: 'Ikeja, Lagos' });
  });

  it('returns full order detail, deliveries, amounts and linked disputes', async () => {
    const data = (await auth(request(app).get('/api/v1/admin/orders/1')).expect(200)).body.data;
    assert.equal(data.buyer.fullName, 'Test Buyer');
    assert.deepEqual(data.seller, { id: 101, businessName: 'One Parts', location: 'Ikeja, Lagos' });
    assert.equal(data.items.length, 2);
    assert.equal(data.items[1].quantity, 2);
    assert.equal(data.items[1].partName, 'Part 2');
    assert.equal(data.totalKobo, 3301);
    assert.equal(data.paymentStatus, 'paid');
    assert.equal(data.deliveryStatus, 'delivered');
    assert.equal(data.createdAt, '2026-08-30T23:00:00.000Z');
    assert.equal(data.disputes.length, 6);
    assert.ok(data.disputeId);
    await auth(request(app).get('/api/v1/admin/orders/999')).expect(404);
  });

  it('returns stats, filtered disputes, evidence, actors and configured SLA', async () => {
    const stats = (await auth(request(app).get('/api/v1/admin/disputes/stats')).expect(200)).body.data;
    assert.deepEqual(stats, { open: 1, inReview: 1, escalated: 1, resolved: 1, total: 6 });
    const list = (await auth(request(app).get('/api/v1/admin/disputes?status=open&sellerId=102&dateFrom=2026-09-06&dateTo=2026-09-06')).expect(200)).body.data;
    assert.equal(list.disputes.length, 1);
    assert.equal(list.disputes[0].sellerBusinessName, 'Two Parts');
    assert.equal(list.disputes[0].buyerName, 'Test Buyer');
    assert.equal(list.disputes[0].openedAt, '2026-09-05T23:30:00.000Z');
    const data = (await auth(request(app).get('/api/v1/admin/disputes/1')).expect(200)).body.data;
    assert.equal(data.dispute.seller.id, 102);
    assert.equal(data.dispute.description, 'Part arrived damaged');
    assert.equal(data.evidence.buyer.attachments[0].filename, 'damage.jpg');
    assert.equal(data.evidence.seller.summary, 'Packed intact');
    assert.equal(data.order.orderValueKobo, 3301);
    assert.equal(data.sla.deadlineAt, '2026-09-07T23:30:00.000Z');
    assert.equal(data.sla.remainingMinutes, 2130);
    assert.equal(data.sla.breached, false);
    assert.deepEqual(data.timeline[0].actor, { id: 100, type: 'user', name: 'Test Buyer' });
    await auth(request(app).get('/api/v1/admin/disputes/999')).expect(404);
  });

  it('validates every query/body and requires admin permissions', async () => {
    const invalidUrls = ['/analytics/platform?period=2d', '/analytics/platform?topSellersLimit=21', '/analytics/platform/export?period=2d',
      '/disputes?dateFrom=2026-02-30', '/disputes?dateFrom=2026-09-06&dateTo=2026-09-01', '/disputes?sellerId=0', '/orders/nope'];
    for (const url of invalidUrls) await auth(request(app).get(`/api/v1/admin${url}`)).expect(422);
    const actions = [['request-info', {}], ['escalate', {}], ['close', {}],
      ['ruling', { decision: 'partial_refund', notes: 'A sufficiently long note' }],
      ['ruling', { decision: 'partial_refund', partialAmountKobo: 3302, notes: 'A sufficiently long note' }],
      ['ruling', { decision: 'no_action', partialAmountKobo: 1, notes: 'A sufficiently long note' }]];
    for (const [action, body] of actions) await auth(request(app).post(`/api/v1/admin/disputes/1/${action}`)).send(body).expect(422);
    const routes = ['/analytics/platform', '/analytics/platform/export', '/disputes', '/disputes/stats', '/disputes/1', '/orders/1'];
    for (const route of routes) {
      await request(app).get(`/api/v1/admin${route}`).expect(401);
      await request(app).get(`/api/v1/admin${route}`).set('Authorization', 'Bearer no-permissions').expect(403);
    }
    for (const action of ['request-info', 'escalate', 'ruling', 'close']) {
      await request(app).post(`/api/v1/admin/disputes/1/${action}`).send({}).expect(401);
    }
    // Exercise the real admin authentication middleware: a buyer token cannot use new routes.
    const realAuthApp = createApp({ db });
    await request(realAuthApp).get('/api/v1/admin/analytics/platform').expect(401);
    await request(realAuthApp).get('/api/v1/admin/analytics/platform')
      .set('Authorization', `Bearer ${jwt.signAccessToken({ sub: 100, actorType: 'user' })}`).expect(401);
  });

  it('records the full action chain with the admin in both timeline and audit log', async () => {
    const deliveries = await fixtures.deliveryCount();
    const post = (action, body, code = 200) => auth(request(app).post(`/api/v1/admin/disputes/1/${action}`)).send(body).expect(code);
    await post('close', { reason: 'Cannot close yet' }, 409);
    await post('request-info', { message: 'Please supply another photo', requestedFrom: 'both' });
    await post('request-info', { message: 'Repeated request', requestedFrom: 'buyer' }, 409);
    await post('escalate', { reason: 'Requires supervisor review' });
    const ruled = await post('ruling', { notes: 'Partial refund for the damaged item', decision: 'partial_refund',
      partialAmountKobo: 500, requireReverseLogistics: true });
    assert.equal(ruled.body.data.ruling.partialAmountKobo, 500);
    assert.equal(ruled.body.data.ruling.requireReverseLogistics, true);
    await post('escalate', { reason: 'Invalid after resolution' }, 409);
    const closed = await post('close', { reason: 'Review completed' });
    assert.deepEqual(closed.body.data.timeline.map((event) => event.event), ['opened', 'info_requested', 'escalated', 'ruled', 'closed']);
    assert.ok(closed.body.data.timeline.slice(1).every((event) => event.actor.id === 100 && event.actor.type === 'admin'));
    const counts = await fixtures.counts(1);
    assert.equal(counts.events, 5);
    assert.equal(counts.rulings, 1);
    assert.equal(counts.audits, 4);
    assert.equal(await fixtures.deliveryCount(), deliveries);
    const logs = (await auth(request(app).get('/api/v1/admin/audit-logs?targetType=dispute&targetId=1')).expect(200)).body.data.auditLogs;
    assert.equal(logs.length, 4);
    assert.ok(logs.every((log) => log.admin.id === 100));
  });

  it('allows close from escalated and treats rejected/closed as terminal', async () => {
    await auth(request(app).post('/api/v1/admin/disputes/3/close')).send({ reason: 'Escalation concluded' }).expect(200);
    for (const id of [5, 6]) await auth(request(app).post(`/api/v1/admin/disputes/${id}/ruling`))
      .send({ decision: 'no_action', notes: 'Cannot reopen a terminal case' }).expect(409);
  });

  it('serializes concurrent rulings, returning 409 for the losing action', async () => {
    await fixtures.createDispute(20);
    const responses = await Promise.all([1, 2].map(() => auth(request(app).post('/api/v1/admin/disputes/20/ruling'))
      .send({ decision: 'refund_buyer_full', notes: 'Full refund after evidence review' })));
    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
    assert.deepEqual(await fixtures.counts(20), { status: 'resolved', events: 2, rulings: 1, audits: 1 });
  });

  it('rolls back status, ruling and timeline when audit persistence fails', async () => {
    await fixtures.createDispute(21);
    const service = createAdminDisputesService({ disputesRepository, platformConfigRepository,
      auditLogRepository: { async createAuditLog() { throw new Error('Audit write failed'); } } });
    await assert.rejects(service.rule({ adminId: 100, disputeId: 21,
      decision: 'refund_seller', notes: 'Seller evidence supports the ruling' }), /Audit write failed/);
    assert.deepEqual(await fixtures.counts(21), { status: 'open', events: 0, rulings: 0, audits: 0 });
  });

  it('uses the first line item seller consistently even when another seller has a lower ID', async () => {
    await fixtures.createOrder(40, '2026-09-01T12:00:00Z', [[2, 1, 200], [1, 1, 100]], 0);
    const list = (await auth(request(app).get('/api/v1/admin/orders?limit=20')).expect(200)).body.data;
    const detail = (await auth(request(app).get('/api/v1/admin/orders/40')).expect(200)).body.data;
    const listed = list.orders.find((order) => order.id === 40);
    assert.deepEqual(listed.seller, { id: 102, businessName: 'Two Parts', location: 'Abuja' });
    assert.deepEqual(listed.seller, detail.seller);
    assert.deepEqual(listed.sellers, detail.sellers);
    assert.deepEqual(listed.sellers.map((seller) => seller.id), [101, 102]);
    assert.deepEqual(detail.seller, detail.items[0].seller);
  });
});
