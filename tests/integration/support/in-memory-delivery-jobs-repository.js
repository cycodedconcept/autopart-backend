const {
  DELIVERY_JOB_STATUSES,
  ORDER_ITEM_STATUSES,
  ORDER_STATUSES
} = require('../../../src/config/constants');

function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

function createInMemoryDeliveryJobsRepository({
  logisticsRepository,
  productsRepository,
  sellersRepository,
  store,
  usersRepository
}) {
  async function buildAssignedCompany(companyId) {
    if (!companyId) {
      return null;
    }

    const company = logisticsRepository
      ? await logisticsRepository.findCompanyById(Number(companyId))
      : null;

    return company ? clone(company) : null;
  }

  async function buildAssignedRider(riderId, companyId) {
    if (!riderId) {
      return null;
    }

    const rider = logisticsRepository
      ? await logisticsRepository.findRiderById(Number(riderId))
      : null;

    if (!rider) {
      return null;
    }

    const assignedCompany = rider.company || await buildAssignedCompany(companyId);

    return clone({
      ...rider,
      company: assignedCompany
    });
  }

  function buildZone(zoneId) {
    if (!zoneId) {
      return null;
    }

    const zone = store.deliveryZones.find((entry) => entry.id === Number(zoneId)) || null;

    return zone ? clone(zone) : null;
  }

  function buildStatusHistory(jobId) {
    return store.deliveryJobStatusHistory
      .filter((entry) => entry.deliveryJobId === Number(jobId))
      .sort((left, right) => (
        new Date(left.createdAt) - new Date(right.createdAt) || left.id - right.id
      ))
      .map((entry) => ({
        id: entry.id,
        deliveryJobId: entry.deliveryJobId,
        status: entry.status,
        note: entry.note,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt
      }));
  }

  async function buildJob(jobRecord) {
    if (!jobRecord) {
      return null;
    }

    const order = store.orders.find((entry) => entry.id === jobRecord.orderId) || null;
    const orderItem = store.orderItems.find((entry) => entry.id === jobRecord.orderItemId) || null;
    const buyer = order && usersRepository ? await usersRepository.findById(order.buyerId) : null;
    const sellerAccount = sellersRepository
      ? await sellersRepository.findBySellerId(jobRecord.sellerId)
      : null;
    const product = orderItem && productsRepository && typeof productsRepository.findProductSnapshotById === 'function'
      ? await productsRepository.findProductSnapshotById(orderItem.productId)
      : null;
    const assignedCompany = await buildAssignedCompany(jobRecord.companyId);

    return {
      id: jobRecord.id,
      orderId: jobRecord.orderId,
      orderItemId: jobRecord.orderItemId,
      sellerId: jobRecord.sellerId,
      zoneId: jobRecord.zoneId || null,
      companyId: jobRecord.companyId || null,
      riderId: jobRecord.riderId || null,
      status: jobRecord.status,
      failureReason: jobRecord.failureReason || null,
      deliveryFeeKobo: Number(jobRecord.deliveryFeeKobo || 0),
      platformMarginKobo: Number(jobRecord.platformMarginKobo || 0),
      companyShareKobo: Number(jobRecord.companyShareKobo || 0),
      pickupAddress: jobRecord.pickupAddress,
      assignedAt: jobRecord.assignedAt,
      pickedUpAt: jobRecord.pickedUpAt,
      inTransitAt: jobRecord.inTransitAt,
      deliveredAt: jobRecord.deliveredAt,
      settlementRecordedAt: jobRecord.settlementRecordedAt || null,
      createdAt: jobRecord.createdAt,
      updatedAt: jobRecord.updatedAt,
      zone: buildZone(jobRecord.zoneId),
      order: order
        ? {
          id: order.id,
          status: order.status,
          paymentMethod: order.paymentMethod,
          paymentReference: order.paymentReference,
          paymentStatus: order.paymentStatus,
          totalKobo: Number(order.totalKobo),
          deliveryAddress: {
            id: order.deliveryAddressId,
            label: order.deliveryLabel,
            street: order.deliveryStreet,
            city: order.deliveryCity,
            state: order.deliveryState,
            phone: order.deliveryPhone
          }
        }
        : null,
      item: orderItem
        ? {
          id: orderItem.id,
          productId: orderItem.productId,
          title: product ? product.title : null,
          partNumber: product ? product.partNumber : null,
          quantity: Number(orderItem.quantity),
          lineTotalKobo: Number(orderItem.lineTotalKobo),
          itemStatus: orderItem.itemStatus
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
      seller: sellerAccount
        ? {
          id: sellerAccount.sellerProfile.id,
          userId: sellerAccount.user.id,
          businessName: sellerAccount.sellerProfile.businessName,
          contactEmail: sellerAccount.sellerProfile.contactEmail,
          contactPhone: sellerAccount.sellerProfile.contactPhone,
          address: sellerAccount.sellerProfile.address,
          fullName: sellerAccount.user.fullName,
          email: sellerAccount.user.email,
          phone: sellerAccount.user.phone
        }
        : null,
      assignedCompany,
      assignedRider: await buildAssignedRider(jobRecord.riderId, jobRecord.companyId)
    };
  }

  function resolveNextOrderStatus(orderId) {
    const items = store.orderItems.filter((entry) => entry.orderId === Number(orderId));
    const jobs = store.deliveryJobs.filter((entry) => entry.orderId === Number(orderId));
    const activeItems = items.filter((entry) => entry.itemStatus !== ORDER_ITEM_STATUSES.CANCELLED);

    if (activeItems.length > 0 && activeItems.every((entry) => entry.itemStatus === ORDER_ITEM_STATUSES.DELIVERED)) {
      return ORDER_STATUSES.DELIVERED;
    }

    if (jobs.some((entry) => entry.status === DELIVERY_JOB_STATUSES.IN_TRANSIT)) {
      return ORDER_STATUSES.IN_TRANSIT;
    }

    if (activeItems.some((entry) => (
      entry.itemStatus === ORDER_ITEM_STATUSES.PICKED_UP
      || entry.itemStatus === ORDER_ITEM_STATUSES.DELIVERED
    ))) {
      return ORDER_STATUSES.PICKED_UP;
    }

    return ORDER_STATUSES.CONFIRMED;
  }

  function recordOrderStatus(orderId, status, note) {
    const now = new Date().toISOString();

    store.orderStatusHistory.push({
      id: store.counters.orderStatusHistoryId,
      orderId: Number(orderId),
      status,
      note,
      createdAt: now,
      updatedAt: now
    });
    store.counters.orderStatusHistoryId += 1;
  }

  function resolveOrderStatusHistoryNote(status) {
    switch (status) {
      case ORDER_STATUSES.CONFIRMED:
        return 'Delivery is awaiting a new dispatch attempt.';
      case ORDER_STATUSES.PICKED_UP:
        return 'Logistics rider picked up at least one package for delivery.';
      case ORDER_STATUSES.IN_TRANSIT:
        return 'At least one package is currently in transit.';
      case ORDER_STATUSES.DELIVERED:
        return 'All delivery jobs for this order have been completed.';
      default:
        return 'Order delivery status updated.';
    }
  }

  function resolveJobStatusNote(currentStatus, nextStatus, note, failureReason = null) {
    const trimmedNote = typeof note === 'string' ? note.trim() : '';

    if (nextStatus === DELIVERY_JOB_STATUSES.FAILED) {
      const normalizedFailureReason = typeof failureReason === 'string'
        ? failureReason.trim()
        : '';

      if (trimmedNote && normalizedFailureReason) {
        return `${trimmedNote} Failure reason: ${normalizedFailureReason}`;
      }

      if (trimmedNote) {
        return trimmedNote;
      }

      if (normalizedFailureReason) {
        return `Delivery job failed: ${normalizedFailureReason}`;
      }
    }

    return trimmedNote || `Delivery job moved from ${currentStatus} to ${nextStatus}.`;
  }

  return {
    async createJobForOrderItem({ orderItemId, sellerId }) {
      const existing = store.deliveryJobs.find((entry) => entry.orderItemId === Number(orderItemId)) || null;

      if (existing) {
        return buildJob(existing);
      }

      const orderItem = store.orderItems.find((entry) => (
        entry.id === Number(orderItemId) && entry.sellerId === Number(sellerId)
      ));

      if (!orderItem) {
        return null;
      }

      const sellerAccount = sellersRepository
        ? await sellersRepository.findBySellerId(Number(sellerId))
        : null;
      const order = store.orders.find((entry) => entry.id === orderItem.orderId) || null;
      const zone = store.deliveryZones.find((entry) => (
        order
        && String(entry.city || '').toLowerCase() === String(order.deliveryCity || '').toLowerCase()
        && String(entry.state || '').toLowerCase() === String(order.deliveryState || '').toLowerCase()
      )) || null;
      const now = new Date().toISOString();
      const jobRecord = {
        id: store.counters.deliveryJobId,
        orderId: orderItem.orderId,
        orderItemId: orderItem.id,
        sellerId: Number(sellerId),
        zoneId: zone ? zone.id : null,
        companyId: null,
        riderId: null,
        status: DELIVERY_JOB_STATUSES.PENDING,
        failureReason: null,
        deliveryFeeKobo: Number(orderItem.deliveryFeeKobo || 0),
        platformMarginKobo: 0,
        companyShareKobo: 0,
        pickupAddress: sellerAccount ? sellerAccount.sellerProfile.address : '',
        assignedAt: null,
        pickedUpAt: null,
        inTransitAt: null,
        deliveredAt: null,
        settlementRecordedAt: null,
        createdAt: now,
        updatedAt: now
      };

      store.deliveryJobs.push(jobRecord);
      store.counters.deliveryJobId += 1;
      store.deliveryJobStatusHistory.push({
        id: store.counters.deliveryJobStatusHistoryId,
        deliveryJobId: jobRecord.id,
        status: DELIVERY_JOB_STATUSES.PENDING,
        note: 'Seller marked the order item ready for pickup and the delivery job is awaiting assignment.',
        createdAt: now,
        updatedAt: now
      });
      store.counters.deliveryJobStatusHistoryId += 1;

      return buildJob(jobRecord);
    },

    async listJobs({ companyId, limit, offset, riderId, search, status }) {
      const matchedJobs = [];

      for (const jobRecord of store.deliveryJobs) {
        if (companyId && jobRecord.companyId !== Number(companyId)) {
          continue;
        }

        if (riderId && jobRecord.riderId !== Number(riderId)) {
          continue;
        }

        const job = await buildJob(jobRecord);

        if (!job) {
          continue;
        }

        if (status && status !== 'all' && job.status !== status) {
          continue;
        }

        if (search) {
          const normalizedSearch = String(search).toLowerCase();
          const searchableValues = [
            String(job.id),
            String(job.orderId),
            String(job.orderItemId),
            job.item ? job.item.title : null,
            job.seller ? job.seller.businessName : null,
            job.buyer ? job.buyer.fullName : null,
            job.order ? job.order.deliveryAddress.city : null,
            job.order ? job.order.deliveryAddress.state : null
          ];

          if (!searchableValues.some((value) => String(value || '').toLowerCase().includes(normalizedSearch))) {
            continue;
          }
        }

        matchedJobs.push(job);
      }

      const statusRank = {
        pending: 1,
        assigned: 2,
        picked_up: 3,
        in_transit: 4,
        failed: 5,
        delivered: 6,
        cancelled: 7
      };

      matchedJobs.sort((left, right) => (
        (statusRank[left.status] || 99) - (statusRank[right.status] || 99)
        || new Date(right.createdAt) - new Date(left.createdAt)
        || right.id - left.id
      ));

      return {
        jobs: matchedJobs.slice(offset, offset + limit).map((job) => clone(job)),
        total: matchedJobs.length
      };
    },

    async summarizeJobs({ companyId, riderId, search }) {
      const matchedJobs = [];

      for (const jobRecord of store.deliveryJobs) {
        if (companyId && jobRecord.companyId !== Number(companyId)) {
          continue;
        }

        if (riderId && jobRecord.riderId !== Number(riderId)) {
          continue;
        }

        const job = await buildJob(jobRecord);

        if (!job) {
          continue;
        }

        if (search) {
          const normalizedSearch = String(search).toLowerCase();
          const searchableValues = [
            String(job.id),
            String(job.orderId),
            String(job.orderItemId),
            job.item ? job.item.title : null,
            job.seller ? job.seller.businessName : null,
            job.buyer ? job.buyer.fullName : null,
            job.order ? job.order.deliveryAddress.city : null,
            job.order ? job.order.deliveryAddress.state : null
          ];

          if (!searchableValues.some((value) => String(value || '').toLowerCase().includes(normalizedSearch))) {
            continue;
          }
        }

        matchedJobs.push(job);
      }

      const deliveredJobs = matchedJobs.filter((job) => job.status === DELIVERY_JOB_STATUSES.DELIVERED);

      return {
        totalJobsCount: matchedJobs.length,
        unassignedJobsCount: matchedJobs.filter((job) => !job.riderId).length,
        pendingCount: matchedJobs.filter((job) => job.status === DELIVERY_JOB_STATUSES.PENDING).length,
        assignedCount: matchedJobs.filter((job) => job.status === DELIVERY_JOB_STATUSES.ASSIGNED).length,
        pickedUpCount: matchedJobs.filter((job) => job.status === DELIVERY_JOB_STATUSES.PICKED_UP).length,
        inTransitCount: matchedJobs.filter((job) => job.status === DELIVERY_JOB_STATUSES.IN_TRANSIT).length,
        deliveredCount: deliveredJobs.length,
        failedCount: matchedJobs.filter((job) => job.status === DELIVERY_JOB_STATUSES.FAILED).length,
        cancelledCount: matchedJobs.filter((job) => job.status === DELIVERY_JOB_STATUSES.CANCELLED).length,
        activeJobsCount: matchedJobs.filter((job) => (
          job.status === DELIVERY_JOB_STATUSES.ASSIGNED
          || job.status === DELIVERY_JOB_STATUSES.PICKED_UP
          || job.status === DELIVERY_JOB_STATUSES.IN_TRANSIT
        )).length,
        deliveryFeesKobo: deliveredJobs.reduce((total, job) => total + Number(job.deliveryFeeKobo || 0), 0),
        platformMarginKobo: deliveredJobs.reduce((total, job) => total + Number(job.platformMarginKobo || 0), 0),
        companyShareKobo: deliveredJobs.reduce((total, job) => total + Number(job.companyShareKobo || 0), 0),
        averageDeliveryFeeKobo: deliveredJobs.length
          ? Math.round(
            deliveredJobs.reduce((total, job) => total + Number(job.deliveryFeeKobo || 0), 0)
              / deliveredJobs.length
          )
          : 0
      };
    },

    async listCompanyRiderPerformance({ companyId }) {
      const companyRiders = store.riders.filter((entry) => entry.companyId === Number(companyId));
      const rows = [];

      for (const riderRecord of companyRiders) {
        const riderJobs = store.deliveryJobs.filter((job) => (
          job.companyId === Number(companyId)
          && job.riderId === riderRecord.id
        ));
        const deliveredJobs = riderJobs.filter((job) => job.status === DELIVERY_JOB_STATUSES.DELIVERED);

        rows.push({
          rider: await buildAssignedRider(riderRecord.id, riderRecord.companyId),
          totalJobsCount: riderJobs.length,
          assignedJobsCount: riderJobs.filter((job) => job.status === DELIVERY_JOB_STATUSES.ASSIGNED).length,
          pickedUpJobsCount: riderJobs.filter((job) => job.status === DELIVERY_JOB_STATUSES.PICKED_UP).length,
          inTransitJobsCount: riderJobs.filter((job) => job.status === DELIVERY_JOB_STATUSES.IN_TRANSIT).length,
          activeJobsCount: riderJobs.filter((job) => (
            job.status === DELIVERY_JOB_STATUSES.ASSIGNED
            || job.status === DELIVERY_JOB_STATUSES.PICKED_UP
            || job.status === DELIVERY_JOB_STATUSES.IN_TRANSIT
          )).length,
          deliveredJobsCount: deliveredJobs.length,
          failedJobsCount: riderJobs.filter((job) => job.status === DELIVERY_JOB_STATUSES.FAILED).length,
          cancelledJobsCount: riderJobs.filter((job) => job.status === DELIVERY_JOB_STATUSES.CANCELLED).length,
          deliveryFeesKobo: deliveredJobs.reduce((total, job) => total + Number(job.deliveryFeeKobo || 0), 0),
          companyShareKobo: deliveredJobs.reduce((total, job) => total + Number(job.companyShareKobo || 0), 0)
        });
      }

      rows.sort((left, right) => (
        right.deliveredJobsCount - left.deliveredJobsCount
        || right.activeJobsCount - left.activeJobsCount
        || new Date((right.rider && right.rider.updatedAt) || 0) - new Date((left.rider && left.rider.updatedAt) || 0)
        || ((right.rider && right.rider.id) || 0) - ((left.rider && left.rider.id) || 0)
      ));

      return rows.map((row) => clone(row));
    },

    async findJobById(jobId) {
      const job = store.deliveryJobs.find((entry) => entry.id === Number(jobId)) || null;

      return buildJob(job);
    },

    async findStatusHistoryByJobId(jobId) {
      return buildStatusHistory(jobId);
    },

    async assignJob({ companyId, jobId, note, riderId }) {
      const jobRecord = store.deliveryJobs.find((entry) => entry.id === Number(jobId)) || null;
      const riderRecord = store.riders.find((entry) => entry.id === Number(riderId)) || null;

      if (!jobRecord || !riderRecord) {
        return null;
      }

      const now = new Date().toISOString();

      jobRecord.companyId = Number(companyId);
      jobRecord.riderId = Number(riderId);
      jobRecord.assignedAt = jobRecord.status === DELIVERY_JOB_STATUSES.FAILED
        ? now
        : (jobRecord.assignedAt || now);
      jobRecord.pickedUpAt = jobRecord.status === DELIVERY_JOB_STATUSES.FAILED
        ? null
        : jobRecord.pickedUpAt;
      jobRecord.inTransitAt = jobRecord.status === DELIVERY_JOB_STATUSES.FAILED
        ? null
        : jobRecord.inTransitAt;
      jobRecord.deliveredAt = null;
      jobRecord.status = DELIVERY_JOB_STATUSES.ASSIGNED;
      jobRecord.failureReason = null;
      jobRecord.updatedAt = now;
      riderRecord.status = 'on_delivery';
      riderRecord.updatedAt = now;

      store.deliveryJobStatusHistory.push({
        id: store.counters.deliveryJobStatusHistoryId,
        deliveryJobId: jobRecord.id,
        status: DELIVERY_JOB_STATUSES.ASSIGNED,
        note,
        createdAt: now,
        updatedAt: now
      });
      store.counters.deliveryJobStatusHistoryId += 1;

      return buildJob(jobRecord);
    },

    async updateJobStatus({
      companyId,
      companyShareKobo,
      failureReason,
      jobId,
      note,
      platformMarginKobo,
      riderId,
      status
    }) {
      const jobRecord = store.deliveryJobs.find((entry) => entry.id === Number(jobId)) || null;
      const riderRecord = store.riders.find((entry) => entry.id === Number(riderId)) || null;

      if (!jobRecord) {
        return null;
      }

      const order = store.orders.find((entry) => entry.id === jobRecord.orderId) || null;
      const orderItem = store.orderItems.find((entry) => entry.id === jobRecord.orderItemId) || null;
      const now = new Date().toISOString();
      const currentStatus = jobRecord.status;

      jobRecord.companyId = jobRecord.companyId || Number(companyId);
      jobRecord.riderId = jobRecord.riderId || Number(riderId);
      jobRecord.assignedAt = jobRecord.assignedAt || now;
      jobRecord.status = status;
      jobRecord.failureReason = status === DELIVERY_JOB_STATUSES.FAILED
        ? failureReason || null
        : null;
      jobRecord.updatedAt = now;

      if (riderRecord && (status === DELIVERY_JOB_STATUSES.PICKED_UP || status === DELIVERY_JOB_STATUSES.IN_TRANSIT)) {
        riderRecord.status = 'on_delivery';
        riderRecord.updatedAt = now;
      }

      if (status === DELIVERY_JOB_STATUSES.PICKED_UP) {
        jobRecord.pickedUpAt = now;

        if (orderItem) {
          orderItem.itemStatus = ORDER_ITEM_STATUSES.PICKED_UP;
          orderItem.updatedAt = now;
        }
      }

      if (status === DELIVERY_JOB_STATUSES.IN_TRANSIT) {
        jobRecord.inTransitAt = now;
      }

      if (status === DELIVERY_JOB_STATUSES.DELIVERED) {
        jobRecord.deliveredAt = now;
        jobRecord.platformMarginKobo = Number(platformMarginKobo || 0);
        jobRecord.companyShareKobo = Number(companyShareKobo || 0);
        jobRecord.settlementRecordedAt = now;

        if (riderRecord) {
          riderRecord.status = 'available';
          riderRecord.updatedAt = now;
        }

        if (orderItem) {
          orderItem.itemStatus = ORDER_ITEM_STATUSES.DELIVERED;
          orderItem.updatedAt = now;
        }
      }

      if (status === DELIVERY_JOB_STATUSES.FAILED) {
        if (riderRecord) {
          riderRecord.status = 'available';
          riderRecord.updatedAt = now;
        }

        if (orderItem) {
          orderItem.itemStatus = ORDER_ITEM_STATUSES.READY_FOR_PICKUP;
          orderItem.updatedAt = now;
        }
      }

      store.deliveryJobStatusHistory.push({
        id: store.counters.deliveryJobStatusHistoryId,
        deliveryJobId: jobRecord.id,
        status,
        note: resolveJobStatusNote(currentStatus, status, note, failureReason),
        createdAt: now,
        updatedAt: now
      });
      store.counters.deliveryJobStatusHistoryId += 1;

      if (order) {
        const nextOrderStatus = resolveNextOrderStatus(order.id);

        if (order.status !== nextOrderStatus) {
          order.status = nextOrderStatus;
          order.updatedAt = now;
          recordOrderStatus(order.id, nextOrderStatus, resolveOrderStatusHistoryNote(nextOrderStatus));
        }
      }

      return buildJob(jobRecord);
    }
  };
}

module.exports = {
  createInMemoryDeliveryJobsRepository
};
