const { ERROR_CODES } = require('../config/constants');
const AppError = require('../utils/app-error');
const { disputeSla, disputeSlaHours } = require('../utils/admin-reporting');

const ACTIONS = {
  requestInfo: { from: ['open'], status: 'in_review', event: 'info_requested' },
  escalate: { from: ['open', 'in_review'], status: 'escalated', event: 'escalated' },
  ruling: { from: ['open', 'in_review', 'escalated'], status: 'resolved', event: 'ruled' },
  close: { from: ['resolved', 'escalated'], status: 'closed', event: 'closed' }
};

function requireDispute(dispute) {
  if (!dispute) throw new AppError('Dispute was not found.', { statusCode: 404, code: ERROR_CODES.NOT_FOUND });
  return dispute;
}

function disputeSeller(dispute) {
  return (dispute.sellers || []).find((seller) => seller.id === dispute.sellerId)
    || dispute.raisedBySeller || ((dispute.sellers || []).length === 1 ? dispute.sellers[0] : null);
}

function createAdminDisputesService({ disputesRepository, auditLogRepository, platformConfigRepository, now = () => new Date() }) {
  async function getDispute({ disputeId }) {
    const dispute = requireDispute(await disputesRepository.findDisputeByIdForAdmin(disputeId));
    const [extra, hours] = await Promise.all([
      disputesRepository.findDisputeEvidenceAndTimeline(disputeId), disputeSlaHours(platformConfigRepository)
    ]);
    const seller = disputeSeller(dispute);
    const evidenceFor = (party) => ({
      summary: dispute[`${party}EvidenceSummary`] || null,
      attachments: extra.attachments.filter((item) => item.submittedBy === party)
        .map(({ id, url, filename, uploadedAt }) => ({ id, url, filename, uploadedAt }))
    });
    const timeline = [...extra.timeline];
    if (!timeline.some((event) => event.event === 'opened')) timeline.unshift({
      id: null, event: 'opened', timestamp: dispute.createdAt,
      actor: dispute.raisedBy === 'buyer'
        ? { id: dispute.buyer.id, type: 'user', name: dispute.buyer.fullName }
        : { id: dispute.raisedBySeller?.userId || null, type: 'user', name: dispute.raisedBySeller?.fullName || null },
      detail: { raisedBy: dispute.raisedBy }
    });
    return {
      dispute: {
        id: dispute.id, orderId: dispute.orderId,
        buyer: { id: dispute.buyer.id, name: dispute.buyer.fullName },
        seller: seller ? { id: seller.id, businessName: seller.businessName } : null,
        sellers: (dispute.sellers || []).map(({ id, businessName }) => ({ id, businessName })),
        reason: dispute.reason, status: dispute.status, openedAt: dispute.createdAt,
        description: dispute.description || null
      },
      evidence: { buyer: evidenceFor('buyer'), seller: evidenceFor('seller') },
      order: { partName: extra.items.map((item) => item.partName).join(', ') || null,
        orderValueKobo: dispute.order.totalKobo, placedAt: dispute.order.createdAt, items: extra.items },
      sla: disputeSla(dispute, hours, now()), timeline, ruling: extra.ruling
    };
  }

  async function act(action, { adminId, disputeId, ...payload }) {
    const rule = ACTIONS[action];
    await disputesRepository.withLockedDispute(disputeId, async (transaction) => {
      const dispute = requireDispute(transaction.dispute);
      if (!rule.from.includes(dispute.status)) throw new AppError(
        `Disputes in ${dispute.status} status cannot ${action === 'requestInfo' ? 'move to in_review' : `move to ${rule.status}`}.`,
        { statusCode: 409, code: ERROR_CODES.CONFLICT }
      );
      if (action === 'ruling' && payload.decision === 'partial_refund'
        && (!Number.isSafeInteger(payload.partialAmountKobo) || payload.partialAmountKobo <= 0
          || payload.partialAmountKobo > dispute.order.totalKobo)) {
        throw new AppError('partialAmountKobo must be a positive integer no greater than the order value.',
          { statusCode: 422, code: ERROR_CODES.VALIDATION_ERROR });
      }
      const ruling = action === 'ruling' ? { ...payload, requireReverseLogistics: payload.requireReverseLogistics || false } : null;
      const detail = { ...payload, ...(ruling || {}), previousStatus: dispute.status, nextStatus: rule.status };
      await transaction.recordAction({ adminId, event: rule.event, nextStatus: rule.status, detail, ruling });
      await auditLogRepository.createAuditLog({ adminId, action: `dispute.${rule.event}`,
        targetType: 'dispute', targetId: dispute.id, detail: { orderId: dispute.orderId, ...detail } }, transaction.executor);
      // TODO(refunds): trigger the approved refund only after a separate Paystack integration is authorized.
      // TODO(reverse-logistics): consume the recorded flag in a separately authorized workflow; do not create a job here.
    });
    return getDispute({ disputeId });
  }

  return {
    getDispute,
    getDisputeStats: () => disputesRepository.getDisputeStats(),
    requestInfo: (payload) => act('requestInfo', payload),
    escalate: (payload) => act('escalate', payload),
    rule: (payload) => act('ruling', payload),
    close: (payload) => act('close', payload)
  };
}

module.exports = { createAdminDisputesService, disputeSeller };
