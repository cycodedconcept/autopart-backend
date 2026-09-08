require('../setup/env');
const assert = require('node:assert/strict');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const mysql = require('mysql2/promise');
const request = require('supertest');
const { createApp } = require('../../src/app');
const { createDisputesService } = require('../../src/services/disputes.service');
const { createPartyDisputesRepository } = require('../../src/repositories/party-disputes.repository');
const { createSellersRepository } = require('../../src/repositories/sellers.repository');
const { createPlatformConfigRepository } = require('../../src/repositories/platform-config.repository');
const { createDisputesFixturesRepository } = require('./disputes-fixtures.repository');
const { PNG_IMAGE } = require('../integration/support/image-fixtures');
const { signAccessToken } = require('../../src/utils/jwt');
const baseEnv = require('../../src/config/env');

describe('Buyer and seller dispute flow against isolated MySQL', function () {
  this.timeout(20000);
  let db, fixtures, app, directory, env;
  const fixedNow = () => new Date('2026-09-08T12:00:00Z');
  const tokens = {};
  const auth = (req, actor = 'buyer') => req.set('Authorization', `Bearer ${tokens[actor]}`);
  const message = 'The evidence clearly shows the condition of the delivered item.';
  const sellerSecret = 'SELLER-PRIVATE-EVIDENCE: the package was intact at dispatch.';
  const filesOnDisk = async () => (await fs.readdir(path.join(directory, 'disputes'))).filter((name) => name !== '.htaccess');

  function buildApp(repositoryDb = db, environment = env) {
    const partyDisputesRepository = createPartyDisputesRepository({ db: repositoryDb });
    const disputesService = createDisputesService({ partyDisputesRepository,
      sellersRepository: createSellersRepository({ db }), platformConfigRepository: createPlatformConfigRepository({ db }),
      env: environment, now: fixedNow });
    return createApp({ db, env: environment, disputesService,
      logger: { info() {}, warn() {}, error() {}, stream: { write() {} } } });
  }

  function open(orderId, { actor = 'buyer', sellerId, target = app, description = message } = {}) {
    let req = auth(request(target).post(`/api/v1/orders/${orderId}/disputes`), actor)
      .field('reason', 'damaged_on_arrival').field('description', description);
    if (sellerId) req = req.field('sellerId', sellerId);
    return req;
  }

  async function openWithEvidence(orderId, options = {}) {
    return (await open(orderId, options).attach('evidence', PNG_IMAGE, { filename: '../../client-name.png', contentType: 'image/png' })
      .expect(201)).body.data;
  }

  const adminAction = (id, action, body) => auth(request(app).post(`/api/v1/admin/disputes/${id}/${action}`), 'admin').send(body);
  const detail = async (id, actor = 'buyer') => (await auth(request(app).get(
    `/api/v1/${actor.startsWith('seller') ? 'seller/' : ''}disputes/${id}`), actor).expect(200)).body.data;

  before(async () => {
    db = mysql.createPool({ host: '127.0.0.1', port: 33316, user: 'root', password: '', database: 'autoparts_disputes_test' });
    fixtures = createDisputesFixturesRepository(db);
    await fixtures.seed();
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'autoparts-disputes-'));
    env = { ...baseEnv, UPLOAD_DIR: directory, BASE_URL: 'https://api.test.local', DISPUTE_WINDOW_DAYS: 7 };
    for (const [actor, id, actorType] of [['buyer', 2100, 'user'], ['otherBuyer', 2101, 'user'],
      ['seller', 2102, 'user'], ['sellerTwo', 2103, 'user'], ['sellerThree', 2104, 'user'],
      ['admin', 2100, 'admin'], ['noPermission', 2101, 'admin']]) {
      tokens[actor] = signAccessToken({ sub: String(id), actorType });
    }
    app = buildApp();
  });

  beforeEach(async () => {
    await fixtures.reset();
    for (const filename of await filesOnDisk()) await fs.unlink(path.join(directory, 'disputes', filename));
  });

  after(async () => {
    if (db) await db.end();
    if (directory) await fs.rm(directory, { recursive: true, force: true });
  });

  it('opens a delivered order with private evidence, records the buyer, and matches the admin SLA', async () => {
    const orderId = await fixtures.createOrder();
    const data = await openWithEvidence(orderId);
    assert.equal(data.dispute.sellerId, 2201);
    assert.equal(data.dispute.description, message);
    assert.equal(data.dispute.status, 'open');
    assert.equal(Date.parse(data.sla.deadlineAt) - Date.parse(data.dispute.createdAt), 48 * 3600000);
    const state = await fixtures.state(orderId);
    assert.equal(state.events.length, 1);
    assert.equal(state.events[0].event_type, 'opened');
    assert.equal(Number(state.events[0].actor_user_id), 2100);
    assert.equal(state.attachments[0].submitted_by, 'buyer');
    assert.match(state.attachments[0].filename, /^[a-f0-9]{32}\.png$/);
    assert.equal(state.attachments[0].file_path, `disputes/${state.attachments[0].filename}`);
    const admin = (await auth(request(app).get(`/api/v1/admin/disputes/${data.dispute.id}`), 'admin').expect(200)).body.data;
    assert.equal(admin.dispute.description, message);
    assert.equal(admin.sla.deadlineAt, data.sla.deadlineAt);
    assert.equal(admin.evidence.buyer.attachments.length, 1);
    await auth(request(app).get(admin.evidence.buyer.attachments[0].url), 'admin').expect(200);
  });

  it('requires buyer authentication and forbids another buyer’s order without retaining uploads', async () => {
    const orderId = await fixtures.createOrder();
    await request(app).post(`/api/v1/orders/${orderId}/disputes`).send({}).expect(401);
    await open(orderId, { actor: 'seller' }).expect(403);
    await open(orderId, { actor: 'otherBuyer' }).attach('evidence', PNG_IMAGE, 'x.png').expect(403);
    await auth(request(app).get(`/api/v1/orders/${orderId}/disputes`), 'otherBuyer').expect(403);
    assert.deepEqual(await filesOnDisk(), []);
    assert.equal((await fixtures.state(orderId)).disputes.length, 0);
  });

  it('serializes simultaneous openings and names the winning dispute in the 409', async () => {
    const orderId = await fixtures.createOrder();
    const responses = await Promise.all([open(orderId).attach('evidence', PNG_IMAGE, 'one.png'),
      open(orderId).attach('evidence', PNG_IMAGE, 'two.png')]);
    assert.deepEqual(responses.map((res) => res.status).sort(), [201, 409]);
    const winner = responses.find((res) => res.status === 201).body.data.dispute.id;
    assert.ok(responses.find((res) => res.status === 409).body.error.message.includes(String(winner)));
    const state = await fixtures.state(orderId);
    assert.equal(state.disputes.length, 1);
    assert.equal(state.events.length, 1);
    assert.equal(state.attachments.length, 1);
    assert.equal((await filesOnDisk()).length, 1);
  });

  for (const status of ['pending_payment', 'confirmed', 'picked_up', 'in_transit', 'cancelled', 'disputed']) {
    it(`rejects creation for order status ${status}`, async () => {
      await open(await fixtures.createOrder({ status })).expect(409);
    });
  }

  for (const status of ['open', 'in_review', 'escalated']) {
    it(`treats ${status} disputes as active`, async () => {
      const orderId = await fixtures.createOrder();
      const id = await fixtures.createLegacyDispute(orderId, { status });
      const res = await open(orderId).expect(409);
      assert.ok(res.body.error.message.includes(String(id)));
    });
  }

  it('uses the first delivered timestamp and enforces an inclusive seven-day boundary', async () => {
    await open(await fixtures.createOrder({ deliveredAt: '2026-09-01T11:59:59Z' })).expect(409);
    await open(await fixtures.createOrder({ deliveredAt: '2026-09-01T12:00:00Z' })).expect(201);
    const old = await fixtures.createOrder({ deliveredAt: '2026-08-01T12:00:00Z' });
    await fixtures.addDeliveryHistory(old, '2026-09-07T12:00:00Z');
    await open(old).expect(409);
    await open(await fixtures.createOrder({ deliveredAt: null })).expect(409);
    await open(await fixtures.createOrder({ deliveredAt: '2026-09-09T12:00:00Z' })).expect(409);
  });

  it('prefers platform window configuration, then env, then seven days', async () => {
    await fixtures.setSettings({ disputeWindowDays: 2 });
    await open(await fixtures.createOrder({ deliveredAt: '2026-09-05T12:00:00Z' })).expect(409);
    await fixtures.setSettings({ disputeWindowDays: 10 });
    await open(await fixtures.createOrder({ deliveredAt: '2026-08-30T12:00:00Z' })).expect(201);
    await fixtures.setSettings({ disputeWindowDays: -1 });
    const envApp = buildApp(db, { ...env, DISPUTE_WINDOW_DAYS: 3 });
    await open(await fixtures.createOrder({ deliveredAt: '2026-09-04T12:00:00Z' }), { target: envApp }).expect(409);
    const defaultApp = buildApp(db, { ...env, DISPUTE_WINDOW_DAYS: undefined });
    await open(await fixtures.createOrder({ deliveredAt: '2026-09-01T12:00:00Z' }), { target: defaultApp }).expect(201);
  });

  it('requires a target on mixed-seller orders and restricts the dispute to that seller', async () => {
    const orderId = await fixtures.createOrder({ sellers: [2201, 2202] });
    await open(orderId).expect(422);
    await open(orderId, { sellerId: 2203 }).expect(422);
    const data = await openWithEvidence(orderId, { sellerId: 2202 });
    await detail(data.dispute.id, 'sellerTwo');
    await auth(request(app).get(`/api/v1/seller/disputes/${data.dispute.id}`), 'seller').expect(403);
    await auth(request(app).post(`/api/v1/seller/disputes/${data.dispute.id}/respond`), 'seller').send({ message }).expect(403);
    const ownList = (await auth(request(app).get('/api/v1/seller/disputes'), 'seller').expect(200)).body.data;
    assert.equal(ownList.pagination.total, 0);
    await open(orderId, { sellerId: 2201 }).expect(409);
  });

  it('handles unassigned legacy single-seller disputes without sharing mixed-seller evidence', async () => {
    const one = await fixtures.createLegacyDispute(await fixtures.createOrder(), { sellerId: null });
    const mixed = await fixtures.createLegacyDispute(await fixtures.createOrder({ sellers: [2201, 2202] }), { sellerId: null });
    await detail(one, 'seller');
    await auth(request(app).get(`/api/v1/seller/disputes/${mixed}`), 'seller').expect(403);
    const list = (await auth(request(app).get('/api/v1/seller/disputes'), 'seller').expect(200)).body.data;
    assert.deepEqual(list.disputes.map((item) => item.id), [one]);
  });

  it('lets the seller respond, hides seller evidence everywhere for the buyer, and protects downloads', async () => {
    const orderId = await fixtures.createOrder();
    const data = await openWithEvidence(orderId);
    const id = data.dispute.id;
    const reply = (await auth(request(app).post(`/api/v1/seller/disputes/${id}/respond`), 'seller')
      .field('message', sellerSecret).attach('evidence', PNG_IMAGE, 'packing.png').expect(200)).body.data;
    const buyer = await detail(id);
    assert.equal(buyer.evidence.seller, undefined);
    assert.ok(!JSON.stringify(buyer).includes('SELLER-PRIVATE'));
    const evidence = reply.evidence.seller.attachments[0];
    assert.ok(!JSON.stringify(buyer).includes(evidence.filename));
    const url = new URL(evidence.url).pathname;
    await request(app).get(url).expect(401);
    await auth(request(app).get(url)).expect(403);
    await auth(request(app).get(url), 'otherBuyer').expect(403);
    await auth(request(app).get(url), 'sellerTwo').expect(403);
    await auth(request(app).get(url), 'noPermission').expect(403);
    const downloaded = await auth(request(app).get(url), 'seller').expect(200);
    assert.deepEqual(downloaded.body, PNG_IMAGE);
    assert.equal(downloaded.headers['cache-control'], 'private, no-store');
    assert.equal(downloaded.headers['x-content-type-options'], 'nosniff');
    await auth(request(app).get(url), 'admin').expect(200);
    const buyerUrl = new URL(data.evidence.buyer.attachments[0].url).pathname;
    await auth(request(app).get(buyerUrl)).expect(200);
    await auth(request(app).get(buyerUrl), 'seller').expect(200);
    const state = await fixtures.state(orderId);
    assert.equal(state.events[1].event_type, 'seller_responded');
    assert.equal(Number(state.events[1].actor_user_id), 2102);
    assert.equal(state.attachments[1].submitted_by, 'seller');
  });

  it('blocks direct upload paths including encoded/dot variants and writes the Apache deny rule', async () => {
    const data = await openWithEvidence(await fixtures.createOrder());
    const name = data.evidence.buyer.attachments[0].filename;
    for (const prefix of ['/uploads/disputes/', '/uploads/%64isputes/', '/uploads/%2fdisputes/',
      '/uploads/products/%2e%2e/disputes/', '/uploads/DISPUTES/', '/uploads//disputes/']) {
      await request(app).get(`${prefix}${name}`).expect(404);
    }
    assert.equal(await fs.readFile(path.join(directory, 'disputes', '.htaccess'), 'utf8'), 'Require all denied\n');
    await fs.writeFile(path.join(directory, 'products', 'public.png'), PNG_IMAGE);
    await request(app).get('/uploads/products/public.png').expect(200);
  });

  it('allows both parties to answer a request independently and consumes the buyer request once', async () => {
    const data = await openWithEvidence(await fixtures.createOrder());
    const id = data.dispute.id;
    await auth(request(app).post(`/api/v1/disputes/${id}/respond`)).send({ message }).expect(409);
    await adminAction(id, 'request-info', { message: 'Please send additional images.', requestedFrom: 'both' }).expect(200);
    await auth(request(app).post(`/api/v1/seller/disputes/${id}/respond`), 'seller').send({ message: sellerSecret }).expect(200);
    const response = await auth(request(app).post(`/api/v1/disputes/${id}/respond`))
      .field('message', message).attach('attachments', PNG_IMAGE, 'extra.png').expect(200);
    assert.equal(response.body.data.evidence.buyer.attachments.length, 2);
    assert.equal(response.body.data.timeline.at(-1).event, 'buyer_responded');
    await auth(request(app).post(`/api/v1/disputes/${id}/respond`)).send({ message }).expect(409);
    // The existing admin transition rule continues rejecting another request while in_review.
    await adminAction(id, 'request-info', { message: 'Another request', requestedFrom: 'both' }).expect(409);
  });

  for (const requestedFrom of ['buyer', 'seller']) {
    it(`only accepts responses from the ${requestedFrom} when that party was requested`, async () => {
      const data = await openWithEvidence(await fixtures.createOrder());
      const id = data.dispute.id;
      await adminAction(id, 'request-info', { message: 'PRIVATE-REQUEST: Please clarify.', requestedFrom }).expect(200);
      await auth(request(app).post(`/api/v1/disputes/${id}/respond`)).send({ message })
        .expect(requestedFrom === 'buyer' ? 200 : 409);
      await auth(request(app).post(`/api/v1/seller/disputes/${id}/respond`), 'seller').send({ message })
        .expect(requestedFrom === 'seller' ? 200 : 409);
      const other = await detail(id, requestedFrom === 'buyer' ? 'seller' : 'buyer');
      assert.ok(!JSON.stringify(other).includes('PRIVATE-REQUEST'));
    });
  }

  it('serializes duplicate buyer replies and preserves a single response event', async () => {
    const orderId = await fixtures.createOrder();
    const { dispute: { id } } = await openWithEvidence(orderId);
    await adminAction(id, 'request-info', { message: 'Please clarify.', requestedFrom: 'buyer' }).expect(200);
    const responses = await Promise.all([1, 2].map(() => auth(request(app).post(`/api/v1/disputes/${id}/respond`)).send({ message })));
    assert.deepEqual(responses.map((res) => res.status).sort(), [200, 409]);
    assert.equal((await fixtures.state(orderId)).events.filter((e) => e.event_type === 'buyer_responded').length, 1);
  });

  it('keeps admin escalation and ruling notes private while exposing the ruling decision', async () => {
    const { dispute: { id } } = await openWithEvidence(await fixtures.createOrder());
    await adminAction(id, 'escalate', { reason: 'INTERNAL-ESCALATION: fraud review rationale.' }).expect(200);
    for (const actor of ['buyer', 'seller']) assert.ok(!JSON.stringify(await detail(id, actor)).includes('INTERNAL-ESCALATION'));
    await auth(request(app).post(`/api/v1/seller/disputes/${id}/respond`), 'seller').send({ message }).expect(409);
    const ruling = await adminAction(id, 'ruling', { decision: 'partial_refund', partialAmountKobo: 500,
      notes: 'ADMIN-PRIVATE-NOTES: internal findings.', requireReverseLogistics: false }).expect(200);
    assert.equal(ruling.body.data.ruling.notes, 'ADMIN-PRIVATE-NOTES: internal findings.');
    for (const actor of ['buyer', 'seller']) {
      const data = await detail(id, actor);
      assert.equal(data.ruling.decision, 'partial_refund');
      assert.equal(data.ruling.partialAmountKobo, 500);
      assert.equal(data.ruling.notes, undefined);
      assert.ok(!JSON.stringify(data).includes('ADMIN-PRIVATE'));
    }
    await adminAction(id, 'close', { reason: 'ADMIN-PRIVATE-CLOSE' }).expect(200);
    assert.ok(!JSON.stringify(await detail(id)).includes('ADMIN-PRIVATE'));
  });

  for (const status of ['resolved', 'closed', 'rejected']) {
    it(`rejects responses to ${status} disputes but permits a new in-window dispute`, async () => {
      const orderId = await fixtures.createOrder();
      const id = await fixtures.createLegacyDispute(orderId, { status });
      await auth(request(app).post(`/api/v1/disputes/${id}/respond`)).send({ message }).expect(409);
      await auth(request(app).post(`/api/v1/seller/disputes/${id}/respond`), 'seller').send({ message }).expect(409);
      await open(orderId).expect(201);
    });
  }

  it('paginates scoped lists and applies inclusive Lagos dates', async () => {
    const dates = ['2026-09-07T22:59:59Z', '2026-09-07T23:00:00Z', '2026-09-08T22:59:59Z', '2026-09-08T23:00:00Z'];
    const ids = [];
    for (const timestamp of dates) ids.push(await fixtures.createLegacyDispute(await fixtures.createOrder(), { timestamp }));
    await fixtures.createLegacyDispute(await fixtures.createOrder({ buyerId: 2101, sellers: [2202] }), { sellerId: 2202 });
    for (const [prefix, actor] of [['', 'buyer'], ['seller/', 'seller']]) {
      const url = `/api/v1/${prefix}disputes?dateFrom=2026-09-08&dateTo=2026-09-08&limit=1`;
      const first = (await auth(request(app).get(url), actor).expect(200)).body.data;
      assert.deepEqual(first.pagination, { page: 1, limit: 1, total: 2, totalPages: 2 });
      assert.equal(first.disputes[0].id, ids[2]);
      const second = (await auth(request(app).get(`${url}&page=2`), actor).expect(200)).body.data;
      assert.equal(second.disputes[0].id, ids[1]);
      const empty = (await auth(request(app).get(`/api/v1/${prefix}disputes?status=closed`), actor).expect(200)).body.data;
      assert.deepEqual(empty.disputes, []);
      assert.equal(empty.pagination.totalPages, 0);
    }
    const orderId = (await detail(ids[0])).dispute.orderId;
    const ownOrder = (await auth(request(app).get(`/api/v1/orders/${orderId}/disputes`)).expect(200)).body.data;
    assert.deepEqual(ownOrder.disputes.map((item) => item.id), [ids[0]]);
    await auth(request(app).get(`/api/v1/disputes/${ids[0]}`), 'otherBuyer').expect(403);
    await auth(request(app).get('/api/v1/seller/disputes')).expect(403);
    await auth(request(app).get('/api/v1/disputes'), 'seller').expect(403);
  });

  it('validates dates, identifiers, reason, description, responses, and untrusted attachment references', async () => {
    for (const query of ['dateFrom=2026-02-30', 'dateFrom=2026-09-09&dateTo=2026-09-08', 'page=0', 'limit=51', 'status=bogus']) {
      await auth(request(app).get(`/api/v1/disputes?${query}`)).expect(422);
    }
    await open('invalid').expect(422);
    await open(999999).expect(404);
    const orderId = await fixtures.createOrder();
    await open(orderId, { description: 'Too short' }).attach('evidence', PNG_IMAGE, 'x.png').expect(422);
    await auth(request(app).post(`/api/v1/orders/${orderId}/disputes`))
      .send({ reason: 'invented', description: message }).expect(422);
    assert.deepEqual(await filesOnDisk(), []);
    const id = (await openWithEvidence(orderId)).dispute.id;
    await auth(request(app).post(`/api/v1/disputes/${id}/respond`)).send({ message: 'short' }).expect(422);
    await auth(request(app).post(`/api/v1/disputes/${id}/respond`)).send({ message, attachments: ['https://other/evidence.png'] }).expect(422);
  });

  it('enforces five-image/5MB/MIME/magic-byte limits and cleans rejected uploads', async () => {
    const orderId = await fixtures.createOrder();
    await open(orderId).attach('evidence', Buffer.from('not an image'), { filename: 'x.png', contentType: 'image/png' }).expect(422);
    await open(orderId).attach('evidence', PNG_IMAGE, { filename: 'x.jpg', contentType: 'image/jpeg' }).expect(422);
    await open(orderId).attach('evidence', PNG_IMAGE, { filename: 'x.svg', contentType: 'image/svg+xml' }).expect(422);
    await open(orderId).attach('evidence', Buffer.alloc(5 * 1024 * 1024 + 1), { filename: 'large.png', contentType: 'image/png' }).expect(422);
    let six = open(orderId);
    for (let i = 0; i < 6; i += 1) six = six.attach('evidence', PNG_IMAGE, `${i}.png`);
    await six.expect(422);
    assert.deepEqual(await filesOnDisk(), []);
    let five = open(orderId);
    for (let i = 0; i < 5; i += 1) five = five.attach('evidence', PNG_IMAGE, `${i}.png`);
    assert.equal((await five.expect(201)).body.data.evidence.buyer.attachments.length, 5);
  });

  it('rolls back dispute creation and evidence if event persistence fails', async () => {
    const orderId = await fixtures.createOrder();
    const brokenApp = buildApp(fixtures.failingEventWritesDb());
    await open(orderId, { target: brokenApp }).attach('evidence', PNG_IMAGE, 'x.png').expect(500);
    const state = await fixtures.state(orderId);
    assert.deepEqual(state, { disputes: [], attachments: [], events: [] });
    assert.deepEqual(await filesOnDisk(), []);
  });

  it('rolls back a seller response and removes its files when the event cannot be written', async () => {
    const orderId = await fixtures.createOrder();
    const { dispute: { id } } = await openWithEvidence(orderId);
    const before = await fixtures.state(orderId);
    const brokenApp = buildApp(fixtures.failingEventWritesDb());
    await auth(request(brokenApp).post(`/api/v1/seller/disputes/${id}/respond`), 'seller')
      .field('message', sellerSecret).attach('evidence', PNG_IMAGE, 'x.png').expect(500);
    assert.deepEqual(await fixtures.state(orderId), before);
    assert.equal((await filesOnDisk()).length, 1);
  });

  it('uses a fixed number of list queries as page size grows', async () => {
    for (let i = 0; i < 6; i += 1) await fixtures.createLegacyDispute(await fixtures.createOrder());
    let calls = 0;
    const repository = createPartyDisputesRepository({ db: { execute: (...args) => { calls += 1; return db.execute(...args); } } });
    for (const limit of [1, 50]) {
      calls = 0;
      const data = await repository.listDisputes({ sellerId: 2201, limit, offset: 0 });
      assert.equal(data.total, 6);
      assert.equal(calls, 2);
    }
  });
});
