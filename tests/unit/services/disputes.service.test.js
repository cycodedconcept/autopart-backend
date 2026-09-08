const { createDisputesService } = require('../../../src/services/disputes.service');

describe('Dispute party privacy and request ownership', () => {
  let repository, service, dispute, extra;
  const buyer = { id: 10, role: 'buyer' };
  const seller = { id: 20, role: 'seller' };
  const buyerFile = 'a'.repeat(32) + '.png';
  const sellerFile = 'b'.repeat(32) + '.png';
  const secret = 'PRIVATE_ADMIN_OR_SELLER_CONTENT';

  beforeEach(() => {
    dispute = { id: 1, orderId: 2, buyerId: 10, sellerId: 30, sellers: [{ id: 30 }],
      description: 'The part arrived damaged.', status: 'in_review',
      createdAt: '2026-09-08T00:00:00Z', buyerEvidenceSummary: 'Buyer summary', sellerEvidenceSummary: secret,
      resolutionNote: secret, internalField: secret };
    extra = {
      attachments: [{ id: 1, submittedBy: 'buyer', filename: buyerFile, filePath: `disputes/${buyerFile}` },
        { id: 2, submittedBy: 'seller', filename: sellerFile, filePath: `disputes/${sellerFile}` }],
      timeline: [
        { id: 1, event: 'opened', detail: { raisedBy: 'buyer', notes: secret } },
        { id: 2, event: 'seller_responded', detail: { message: secret, attachmentIds: [2] } },
        { id: 3, event: 'info_requested', detail: { requestedFrom: 'seller', message: secret } },
        { id: 4, event: 'escalated', detail: { reason: secret } },
        { id: 5, event: 'ruled', detail: { decision: 'no_action', notes: secret } },
        { id: 6, event: 'closed', detail: { reason: secret } }
      ],
      ruling: { id: 1, decision: 'no_action', partialAmountKobo: null,
        requireReverseLogistics: false, createdAt: '2026-09-08T01:00:00Z', notes: secret }
    };
    repository = {
      findDispute: jest.fn(async () => dispute),
      findEvidenceAndTimeline: jest.fn(async () => extra),
      withLockedDispute: jest.fn(async (_id, callback) => callback({ dispute,
        findEvents: async () => extra.timeline, addAttachments: jest.fn(async () => []),
        addEvent: jest.fn(), updateSummary: jest.fn(),
        findDispute: async () => dispute, findEvidenceAndTimeline: async () => extra }))
    };
    service = createDisputesService({ partyDisputesRepository: repository,
      sellersRepository: { findByUserId: async () => ({ sellerProfile: { id: 30 } }) },
      platformConfigRepository: { findPlatformConfigByKey: async () => null },
      env: { BASE_URL: 'https://api.test.local' }, now: () => new Date('2026-09-08T12:00:00Z') });
  });

  it('allowlists buyer fields even when a repository returns private ruling fields', async () => {
    const result = await service.getDispute({ user: buyer, party: 'buyer', disputeId: 1 });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain(sellerFile);
    expect(result.evidence.buyer.attachments[0].url).toBe(`https://api.test.local/api/v1/dispute-evidence/${buyerFile}`);
    expect(result.ruling).not.toHaveProperty('notes');
    expect(result.sla.deadlineAt).toBe('2026-09-09T00:00:00.000Z');
  });

  it('shows the seller both evidence groups while stripping all internal ruling and escalation fields', async () => {
    const result = await service.getDispute({ user: seller, party: 'seller', disputeId: 1 });
    expect(result.evidence.seller.attachments[0].filename).toBe(sellerFile);
    expect(result.evidence.buyer.attachments[0].filename).toBe(buyerFile);
    expect(result.ruling).not.toHaveProperty('notes');
    expect(result.dispute).not.toHaveProperty('resolutionNote');
    expect(result.timeline.find((event) => event.event === 'escalated').detail).toBeNull();
    expect(result.timeline.find((event) => event.event === 'closed').detail).toBeNull();
    expect(result.timeline.find((event) => event.event === 'ruled').detail).toEqual({ decision: 'no_action' });
  });

  it('does not fetch evidence for another buyer', async () => {
    await expect(service.getDispute({ user: { ...buyer, id: 99 }, party: 'buyer', disputeId: 1 }))
      .rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
    expect(repository.findEvidenceAndTimeline).not.toHaveBeenCalled();
  });

  it('rejects a mismatched role in the service even without the route guard', async () => {
    await expect(service.getDispute({ user: seller, party: 'buyer', disputeId: 1 }))
      .rejects.toMatchObject({ statusCode: 403 });
    expect(repository.findDispute).not.toHaveBeenCalled();
  });

  it('does not mistake a response to an old request for a response to the latest request', async () => {
    extra.timeline = [
      { id: 1, event: 'info_requested', detail: { requestedFrom: 'buyer' } },
      { id: 2, event: 'buyer_responded', detail: { requestEventId: 1 } },
      { id: 3, event: 'info_requested', detail: { requestedFrom: 'both' } },
      { id: 4, event: 'seller_responded', detail: { requestEventId: 3 } }
    ];
    await expect(service.respond({ user: buyer, party: 'buyer', disputeId: 1, message: 'Additional buyer evidence' }))
      .resolves.toHaveProperty('dispute.id', 1);
    extra.timeline.push({ id: 5, event: 'buyer_responded', detail: { requestEventId: 3 } });
    await expect(service.respond({ user: buyer, party: 'buyer', disputeId: 1, message: 'Additional buyer evidence' }))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  it('does not expose legacy external attachment URLs to parties', async () => {
    extra.attachments = [{ id: 1, submittedBy: 'buyer', filename: 'legacy.png', filePath: null,
      url: 'https://public.example/private-evidence.png' }];
    const result = await service.getDispute({ user: buyer, party: 'buyer', disputeId: 1 });
    expect(result.evidence.buyer.attachments[0].url).toBeNull();
    expect(JSON.stringify(result)).not.toContain('public.example');
  });
});
