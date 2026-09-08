const fs = require('fs/promises');
const AppError = require('../utils/app-error');
const { ERROR_CODES, ADMIN_PERMISSION_KEYS } = require('../config/constants');
const { normalizePagination, buildPagination } = require('../utils/pagination');
const { dateEpoch, disputeSla, disputeSlaHours } = require('../utils/admin-reporting');
const { buildPublicUrl } = require('../utils/product-image-files');
const { disputeFilePath, disputeEvidenceUrl, resolveDisputeFile } = require('../utils/dispute-files');

const ACTIVE_STATUSES = ['open', 'in_review', 'escalated'];
const DAY_MS = 86400000;

function fail(message, statusCode, code) { throw new AppError(message, { statusCode, code }); }
function requireRecord(record, name) {
  if (!record) fail(`${name} was not found.`, 404, ERROR_CODES.NOT_FOUND);
  return record;
}

function requireBuyerOrder(order, userId) {
  requireRecord(order, 'Order');
  if (order.buyerId !== userId) fail('This order belongs to another buyer.', 403, ERROR_CODES.FORBIDDEN);
}

function requireOwnership(dispute, actor) {
  requireRecord(dispute, 'Dispute');
  if (actor.party === 'buyer' && dispute.buyerId === actor.userId) return;
  const sellers = dispute.sellers || [];
  const targetSellerId = dispute.sellerId || (sellers.length === 1 ? sellers[0].id : null);
  if (actor.party === 'seller' && targetSellerId === actor.sellerId
    && sellers.some((seller) => seller.id === actor.sellerId)) return;
  fail('You do not have permission to access this dispute.', 403, ERROR_CODES.FORBIDDEN);
}

function publicDispute(dispute) {
  return { id: dispute.id, orderId: dispute.orderId, sellerId: dispute.sellerId,
    raisedBy: dispute.raisedBy, reason: dispute.reason, description: dispute.description,
    status: dispute.status, createdAt: dispute.createdAt, updatedAt: dispute.updatedAt,
    resolvedAt: dispute.resolvedAt, closedAt: dispute.closedAt };
}

function publicRuling(ruling) {
  if (!ruling) return null;
  return { id: ruling.id, decision: ruling.decision, partialAmountKobo: ruling.partialAmountKobo,
    requireReverseLogistics: ruling.requireReverseLogistics, createdAt: ruling.createdAt };
}

function visibleTimeline(events, party, visibleAttachmentIds) {
  return events.map((event) => {
    const raw = event.detail || {};
    let detail = null;
    if (event.event === 'opened') detail = { raisedBy: raw.raisedBy };
    if (event.event === 'info_requested') {
      detail = { requestedFrom: raw.requestedFrom };
      if ([party, 'both'].includes(raw.requestedFrom)) detail.message = raw.message;
    }
    if (event.event === 'buyer_responded' || (party === 'seller' && event.event === 'seller_responded')) {
      detail = { message: raw.message, requestEventId: raw.requestEventId || null,
        attachmentIds: (Array.isArray(raw.attachmentIds) ? raw.attachmentIds : [])
          .filter((id) => visibleAttachmentIds.has(id)) };
    }
    if (event.event === 'ruled') {
      detail = {};
      for (const key of ['decision', 'partialAmountKobo', 'requireReverseLogistics', 'legacyStatus']) {
        if (raw[key] !== undefined) detail[key] = raw[key];
      }
    }
    return { id: event.id, event: event.event, timestamp: event.timestamp,
      actor: { id: event.adminId || event.actorUserId,
        type: event.adminId ? 'admin' : event.actorUserId ? 'user' : 'unknown' }, detail };
  });
}

function createDisputesService({ partyDisputesRepository: repository, sellersRepository,
  platformConfigRepository, env, now = () => new Date() }) {
  async function resolveActor(user, party) {
    if (!user || user.role !== party || !['buyer', 'seller'].includes(party)) {
      fail('You do not have permission to access this resource.', 403, ERROR_CODES.FORBIDDEN);
    }
    const actor = { party, userId: Number(user.id) };
    if (party === 'seller') {
      const seller = requireRecord(await sellersRepository.findByUserId(actor.userId), 'Seller profile');
      actor.sellerId = Number(seller.sellerProfile.id);
    }
    return actor;
  }

  async function windowDays() {
    const entry = await platformConfigRepository.findPlatformConfigByKey('platform_settings');
    const configured = Number(entry?.value?.disputeWindowDays);
    if (Number.isSafeInteger(configured) && configured > 0 && configured <= 36500) return configured;
    const fallback = Number(env.DISPUTE_WINDOW_DAYS);
    return Number.isSafeInteger(fallback) && fallback > 0 && fallback <= 36500 ? fallback : 7;
  }

  function serializeDetail(dispute, extra, party, hours) {
    const attachments = extra.attachments.filter((item) => party === 'seller' || item.submittedBy === 'buyer');
    const evidenceFor = (submittedBy) => ({
      summary: dispute[`${submittedBy}EvidenceSummary`] || null,
      attachments: attachments.filter((item) => item.submittedBy === submittedBy).map((item) => ({
        id: item.id, filename: item.filename, uploadedAt: item.uploadedAt,
        // Legacy external evidence is not exposed through an unauthenticated fallback URL.
        url: item.filePath ? buildPublicUrl(env.BASE_URL, disputeEvidenceUrl(item.filename)) : null
      }))
    });
    const evidence = { buyer: evidenceFor('buyer') };
    if (party === 'seller') evidence.seller = evidenceFor('seller');
    return { dispute: publicDispute(dispute), evidence,
      sla: disputeSla(dispute, hours, now()),
      timeline: visibleTimeline(extra.timeline, party, new Set(attachments.map((item) => item.id))),
      ruling: publicRuling(extra.ruling) };
  }

  async function getDispute({ user, party, disputeId }) {
    const actor = await resolveActor(user, party);
    const dispute = await repository.findDispute(disputeId);
    requireOwnership(dispute, actor);
    const [extra, hours] = await Promise.all([
      repository.findEvidenceAndTimeline(disputeId), disputeSlaHours(platformConfigRepository)
    ]);
    return serializeDetail(dispute, extra, party, hours);
  }

  async function listDisputes({ user, party, orderId, query = {} }) {
    const actor = await resolveActor(user, party);
    if (orderId !== undefined) requireBuyerOrder(await repository.findOrder(orderId), actor.userId);
    const pagination = normalizePagination(query);
    const result = await repository.listDisputes({
      ...(party === 'buyer' ? { buyerId: actor.userId } : { sellerId: actor.sellerId }),
      orderId, status: query.status,
      dateFrom: query.dateFrom ? dateEpoch(query.dateFrom) : undefined,
      dateTo: query.dateTo ? dateEpoch(query.dateTo) + DAY_MS / 1000 : undefined,
      limit: pagination.limit, offset: pagination.offset
    });
    return { disputes: result.disputes.map(publicDispute),
      pagination: buildPagination({ ...pagination, total: result.total }),
      filters: { status: query.status || 'all', dateFrom: query.dateFrom || null, dateTo: query.dateTo || null } };
  }

  async function createDispute({ user, orderId, reason, description, sellerId, files = [] }) {
    const actor = await resolveActor(user, 'buyer');
    const [days, hours] = await Promise.all([windowDays(), disputeSlaHours(platformConfigRepository)]);
    const result = await repository.withLockedOrder(orderId, async (tx) => {
      const order = tx.order;
      requireBuyerOrder(order, actor.userId);
      // Check active cases first so the conflict always identifies an existing dispute.
      const existing = await tx.findActiveDispute(orderId, ACTIVE_STATUSES);
      if (existing) fail(`Order already has active dispute ${existing.id}.`, 409, ERROR_CODES.CONFLICT);
      if (order.status !== 'delivered') fail('Only delivered orders can be disputed.', 409, ERROR_CODES.CONFLICT);
      const deliveredAt = order.deliveredAt && Date.parse(order.deliveredAt);
      if (!Number.isFinite(deliveredAt) || deliveredAt > now().getTime()) {
        fail('The delivery timestamp could not be established for this order.', 409, ERROR_CODES.CONFLICT);
      }
      if (now().getTime() > deliveredAt + days * DAY_MS) {
        fail(`The ${days}-day dispute window has expired.`, 409, ERROR_CODES.CONFLICT);
      }
      if (!order.sellers.length) fail('The seller for this order could not be established.', 409, ERROR_CODES.CONFLICT);
      const targetId = sellerId || (order.sellers.length === 1 ? order.sellers[0].id : null);
      if (!targetId) fail('sellerId is required for an order containing multiple sellers.', 422, ERROR_CODES.VALIDATION_ERROR);
      if (!order.sellers.some((seller) => seller.id === targetId)) {
        fail('sellerId must identify a seller on this order.', 422, ERROR_CODES.VALIDATION_ERROR);
      }
      const disputeId = await tx.insertDispute({ orderId, sellerId: targetId, reason, description,
        raisedBy: 'buyer', status: 'open' });
      const attachmentIds = await tx.addAttachments(disputeId, 'buyer', files);
      await tx.addEvent({ disputeId, event: 'opened', userId: actor.userId,
        detail: { raisedBy: 'buyer', attachmentIds } });
      return serializeDetail(await tx.findDispute(disputeId), await tx.findEvidenceAndTimeline(disputeId), 'buyer', hours);
    });
    // TODO(notifications): dispute opened -> notify the selected seller and admin after commit.
    return result;
  }

  async function respond({ user, party, disputeId, message, files = [] }) {
    const actor = await resolveActor(user, party);
    const hours = await disputeSlaHours(platformConfigRepository);
    const result = await repository.withLockedDispute(disputeId, async (tx) => {
      const dispute = tx.dispute;
      requireOwnership(dispute, actor);
      const allowed = party === 'buyer' ? ['in_review'] : ['open', 'in_review'];
      if (!allowed.includes(dispute.status)) fail('This dispute does not currently accept your response.', 409, ERROR_CODES.CONFLICT);
      const events = await tx.findEvents(disputeId);
      const request = events.filter((event) => event.event === 'info_requested').at(-1);
      if (request && ![party, 'both'].includes(request.detail?.requestedFrom)) {
        fail('The information request was not addressed to you.', 409, ERROR_CODES.CONFLICT);
      }
      if (party === 'buyer' && (!request || events.some((event) => event.event === 'buyer_responded'
        && event.detail?.requestEventId === request.id))) {
        fail('There is no outstanding information request for the buyer.', 409, ERROR_CODES.CONFLICT);
      }
      const attachmentIds = await tx.addAttachments(disputeId, party, files);
      await tx.updateSummary(disputeId, party, message);
      await tx.addEvent({ disputeId, userId: actor.userId, event: `${party}_responded`,
        detail: { message, attachmentIds, requestEventId: request?.id || null } });
      return serializeDetail(await tx.findDispute(disputeId), await tx.findEvidenceAndTimeline(disputeId), party, hours);
    });
    // TODO(notifications): when party === 'seller', notify the buyer and admin after commit.
    return result;
  }

  async function getEvidence({ user, admin, filename }) {
    const attachment = requireRecord(await repository.findAttachmentByPath(disputeFilePath(filename)), 'Dispute attachment');
    if (admin) {
      if (!(admin.permissions || []).includes(ADMIN_PERMISSION_KEYS.RESOLVE_DISPUTES)) {
        fail('You do not have permission to access dispute evidence.', 403, ERROR_CODES.FORBIDDEN);
      }
    } else {
      const actor = await resolveActor(user, user?.role);
      requireOwnership(await repository.findDispute(attachment.disputeId), actor);
      if (actor.party === 'buyer' && attachment.submittedBy !== 'buyer') {
        fail('You do not have permission to access this evidence.', 403, ERROR_CODES.FORBIDDEN);
      }
    }
    const filePath = resolveDisputeFile(env, attachment.filePath);
    if (!filePath) fail('Dispute attachment was not found.', 404, ERROR_CODES.NOT_FOUND);
    try { await fs.access(filePath); } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      fail('Dispute attachment was not found.', 404, ERROR_CODES.NOT_FOUND);
    }
    return { path: filePath, filename: attachment.filename };
  }

  return { createDispute, getDispute, getEvidence, listDisputes, respond };
}

module.exports = { createDisputesService };
