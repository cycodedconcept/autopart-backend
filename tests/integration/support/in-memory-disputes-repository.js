function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

function createInMemoryDisputesRepository({
  adminRepository,
  sellersRepository,
  store,
  usersRepository
}) {
  async function mapSellerSummary(sellerId) {
    const sellerAccount = await sellersRepository.findBySellerId(Number(sellerId));

    if (!sellerAccount) {
      return null;
    }

    return {
      id: sellerAccount.sellerProfile.id,
      userId: sellerAccount.user.id,
      businessName: sellerAccount.sellerProfile.businessName,
      contactEmail: sellerAccount.sellerProfile.contactEmail,
      contactPhone: sellerAccount.sellerProfile.contactPhone,
      fullName: sellerAccount.user.fullName,
      email: sellerAccount.user.email,
      phone: sellerAccount.user.phone
    };
  }

  async function mapResolvedAdminSummary(adminId) {
    if (!adminId || !adminRepository || typeof adminRepository.findAdminById !== 'function') {
      return null;
    }

    const admin = await adminRepository.findAdminById(Number(adminId));

    if (!admin) {
      return null;
    }

    return {
      id: admin.id,
      fullName: admin.fullName,
      email: admin.email
    };
  }

  async function mapDispute(dispute) {
    if (!dispute) {
      return null;
    }

    const order = store.orders.find((entry) => entry.id === Number(dispute.orderId)) || null;
    const buyer = order && usersRepository && typeof usersRepository.findById === 'function'
      ? await usersRepository.findById(order.buyerId)
      : null;
    const sellerIds = Array.from(new Set(
      store.orderItems
        .filter((entry) => entry.orderId === Number(dispute.orderId))
        .map((entry) => Number(entry.sellerId))
    ));
    const sellers = await Promise.all(sellerIds.map((sellerId) => mapSellerSummary(sellerId)));

    return {
      id: dispute.id,
      orderId: dispute.orderId,
      raisedBy: dispute.raisedBy,
      reason: dispute.reason,
      status: dispute.status,
      resolutionNote: dispute.resolutionNote || null,
      refundReference: dispute.refundReference || null,
      refundAmountKobo: dispute.refundAmountKobo === undefined ? null : Number(dispute.refundAmountKobo),
      resolvedBy: dispute.resolvedBy || null,
      resolvedAt: dispute.resolvedAt || null,
      createdAt: dispute.createdAt,
      updatedAt: dispute.updatedAt,
      order: order
        ? {
          id: order.id,
          status: order.status,
          paymentMethod: order.paymentMethod,
          paymentReference: order.paymentReference,
          paymentStatus: order.paymentStatus,
          totalKobo: Number(order.totalKobo),
          createdAt: order.createdAt,
          updatedAt: order.updatedAt
        }
        : null,
      buyer: buyer
        ? {
          id: buyer.id,
          fullName: buyer.fullName,
          email: buyer.email,
          phone: buyer.phone
        }
        : null,
      raisedBySeller: dispute.sellerId ? await mapSellerSummary(dispute.sellerId) : null,
      resolvedByAdmin: dispute.resolvedBy ? await mapResolvedAdminSummary(dispute.resolvedBy) : null,
      sellers: sellers.filter(Boolean)
    };
  }

  return {
    async createDispute(payload) {
      const now = new Date().toISOString();
      const dispute = {
        id: store.counters.disputeId,
        orderId: Number(payload.orderId),
        sellerId: payload.sellerId ? Number(payload.sellerId) : null,
        raisedBy: payload.raisedBy,
        reason: payload.reason,
        status: payload.status || 'open',
        resolutionNote: null,
        refundReference: null,
        refundAmountKobo: null,
        resolvedBy: null,
        resolvedAt: null,
        createdAt: now,
        updatedAt: now
      };

      store.disputes.push(dispute);
      store.counters.disputeId += 1;

      return mapDispute(dispute);
    },

    async listDisputesForAdmin(filters) {
      const matchedDisputes = [];

      for (const dispute of store.disputes) {
        if (filters.status && filters.status !== 'all' && dispute.status !== filters.status) {
          continue;
        }

        if (filters.raisedBy && filters.raisedBy !== 'all' && dispute.raisedBy !== filters.raisedBy) {
          continue;
        }

        const mappedDispute = await mapDispute(dispute);

        if (filters.search) {
          const search = String(filters.search).trim().toLowerCase();
          const searchableFields = [
            String(mappedDispute.id),
            String(mappedDispute.orderId),
            mappedDispute.order ? mappedDispute.order.paymentReference : null,
            mappedDispute.buyer ? mappedDispute.buyer.fullName : null,
            mappedDispute.buyer ? mappedDispute.buyer.email : null,
            mappedDispute.buyer ? mappedDispute.buyer.phone : null,
            mappedDispute.reason
          ];

          if (!searchableFields.some((value) => String(value || '').toLowerCase().includes(search))) {
            continue;
          }
        }

        matchedDisputes.push(mappedDispute);
      }

      matchedDisputes.sort(
        (left, right) => new Date(right.createdAt) - new Date(left.createdAt) || right.id - left.id
      );

      return {
        disputes: matchedDisputes.slice(filters.offset, filters.offset + filters.limit).map(clone),
        total: matchedDisputes.length
      };
    },

    async findDisputeByIdForAdmin(disputeId) {
      const dispute = store.disputes.find((entry) => entry.id === Number(disputeId)) || null;

      return dispute ? mapDispute(dispute) : null;
    },

    async updateDisputeDecision({
      adminId,
      disputeId,
      refundAmountKobo,
      refundReference,
      resolutionNote,
      status
    }) {
      const dispute = store.disputes.find((entry) => entry.id === Number(disputeId)) || null;

      if (!dispute) {
        return null;
      }

      const now = new Date().toISOString();

      dispute.status = status;
      dispute.resolutionNote = resolutionNote;
      dispute.refundReference = refundReference || null;
      dispute.refundAmountKobo = refundAmountKobo === undefined ? null : Number(refundAmountKobo);
      dispute.resolvedBy = Number(adminId);
      dispute.resolvedAt = now;
      dispute.updatedAt = now;

      return mapDispute(dispute);
    }
  };
}

module.exports = {
  createInMemoryDisputesRepository
};
