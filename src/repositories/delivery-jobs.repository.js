const {
  DELIVERY_JOB_STATUSES,
  ORDER_ITEM_STATUSES,
  ORDER_STATUSES,
  RIDER_STATUSES
} = require('../config/constants');
const { sanitizeLimitOffset } = require('./pagination.repository');

function toNumber(value) {
  return value === null || value === undefined ? null : Number(value);
}

function mapAssignedCompany(row) {
  if (!row || row.assigned_company_id === null || row.assigned_company_id === undefined) {
    return null;
  }

  return {
    id: Number(row.assigned_company_id),
    name: row.assigned_company_name,
    email: row.assigned_company_email,
    phone: row.assigned_company_phone,
    address: row.assigned_company_address,
    status: row.assigned_company_status,
    approvedBy: toNumber(row.assigned_company_approved_by),
    createdAt: row.assigned_company_created_at,
    updatedAt: row.assigned_company_updated_at
  };
}

function mapAssignedRider(row, assignedCompany) {
  if (!row || row.assigned_rider_id === null || row.assigned_rider_id === undefined) {
    return null;
  }

  return {
    id: Number(row.assigned_rider_id),
    companyId: Number(row.assigned_rider_company_id),
    zoneId: Number(row.assigned_rider_zone_id),
    fullName: row.assigned_rider_full_name,
    phone: row.assigned_rider_phone,
    email: row.assigned_rider_email,
    vehicleType: row.assigned_rider_vehicle_type,
    status: row.assigned_rider_status,
    accountStatus: row.assigned_rider_account_status || 'active',
    createdAt: row.assigned_rider_created_at,
    updatedAt: row.assigned_rider_updated_at,
    company: assignedCompany
  };
}

function mapDeliveryZone(row) {
  if (!row || row.zone_ref_id === null || row.zone_ref_id === undefined) {
    return null;
  }

  return {
    id: Number(row.zone_ref_id),
    name: row.zone_name,
    state: row.zone_state,
    city: row.zone_city,
    createdAt: row.zone_created_at,
    updatedAt: row.zone_updated_at
  };
}

function mapDeliveryJobRow(row) {
  if (!row) {
    return null;
  }

  const assignedCompany = mapAssignedCompany(row);
  const zone = mapDeliveryZone(row);

  return {
    id: Number(row.id),
    orderId: Number(row.order_id),
    orderItemId: Number(row.order_item_id),
    sellerId: Number(row.seller_id),
    zoneId: toNumber(row.delivery_zone_id),
    companyId: toNumber(row.company_id),
    riderId: toNumber(row.rider_id),
    status: row.status,
    failureReason: row.failure_reason,
    deliveryFeeKobo: toNumber(row.delivery_fee_kobo),
    platformMarginKobo: toNumber(row.platform_margin_kobo),
    companyShareKobo: toNumber(row.company_share_kobo),
    pickupAddress: row.pickup_address,
    assignedAt: row.assigned_at,
    pickedUpAt: row.picked_up_at,
    inTransitAt: row.in_transit_at,
    deliveredAt: row.delivered_at,
    settlementRecordedAt: row.settlement_recorded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    zone,
    order: {
      id: Number(row.order_id),
      status: row.order_status,
      paymentMethod: row.payment_method,
      paymentReference: row.payment_reference,
      paymentStatus: row.payment_status,
      totalKobo: Number(row.total_kobo),
      deliveryAddress: {
        id: toNumber(row.delivery_address_id),
        label: row.delivery_label,
        street: row.delivery_street,
        city: row.delivery_city,
        state: row.delivery_state,
        phone: row.delivery_phone
      }
    },
    item: {
      id: Number(row.order_item_id),
      productId: Number(row.product_id),
      title: row.title,
      partNumber: row.part_number,
      quantity: Number(row.quantity),
      lineTotalKobo: Number(row.line_total_kobo),
      itemStatus: row.item_status
    },
    buyer: {
      id: Number(row.buyer_id),
      fullName: row.buyer_full_name,
      email: row.buyer_email,
      phone: row.buyer_phone
    },
    seller: {
      id: Number(row.seller_id),
      userId: Number(row.seller_user_id),
      businessName: row.business_name,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      address: row.seller_address,
      fullName: row.seller_full_name,
      email: row.seller_email,
      phone: row.seller_phone
    },
    assignedCompany,
    assignedRider: mapAssignedRider(row, assignedCompany)
  };
}

function mapStatusHistoryRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    deliveryJobId: Number(row.delivery_job_id),
    status: row.status,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPerformanceCompany(row) {
  if (!row || row.company_id === null || row.company_id === undefined) {
    return null;
  }

  return {
    id: Number(row.company_id),
    name: row.company_name,
    email: row.company_email,
    phone: row.company_phone,
    address: row.company_address,
    status: row.company_status,
    approvedBy: toNumber(row.company_approved_by),
    createdAt: row.company_created_at,
    updatedAt: row.company_updated_at
  };
}

function mapPerformanceZone(row) {
  if (!row || row.zone_id === null || row.zone_id === undefined) {
    return null;
  }

  return {
    id: Number(row.zone_id),
    name: row.zone_name,
    state: row.zone_state,
    city: row.zone_city,
    createdAt: row.zone_created_at,
    updatedAt: row.zone_updated_at
  };
}

async function insertDeliveryJobStatusHistoryWithConnection(connection, payload) {
  await connection.execute(
    `
      INSERT INTO delivery_job_status_history (
        delivery_job_id,
        status,
        note
      )
      VALUES (?, ?, ?)
    `,
    [payload.deliveryJobId, payload.status, payload.note || null]
  );
}

async function insertOrderStatusHistoryWithConnection(connection, payload) {
  await connection.execute(
    `
      INSERT INTO order_status_history (
        order_id,
        status,
        note
      )
      VALUES (?, ?, ?)
    `,
    [payload.orderId, payload.status, payload.note || null]
  );
}

function buildJobFilters(filters = {}, options = {}) {
  const clauses = [];
  const params = [];

  if (filters.companyId) {
    clauses.push('dj.company_id = ?');
    params.push(filters.companyId);
  }

  if (filters.riderId) {
    clauses.push('dj.rider_id = ?');
    params.push(filters.riderId);
  }

  if (!options.ignoreStatus && filters.status && filters.status !== 'all') {
    clauses.push('dj.status = ?');
    params.push(filters.status);
  }

  if (filters.search) {
    const searchPattern = `%${String(filters.search).trim().toLowerCase()}%`;

    clauses.push(`
      (
        CAST(dj.id AS CHAR) LIKE ?
        OR CAST(dj.order_id AS CHAR) LIKE ?
        OR CAST(dj.order_item_id AS CHAR) LIKE ?
        OR LOWER(COALESCE(p.title, '')) LIKE ?
        OR LOWER(COALESCE(seller.business_name, '')) LIKE ?
        OR LOWER(COALESCE(buyer.full_name, '')) LIKE ?
        OR LOWER(COALESCE(o.delivery_city, '')) LIKE ?
        OR LOWER(COALESCE(o.delivery_state, '')) LIKE ?
      )
    `);
    params.push(
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern
    );
  }

  return {
    clause: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params
  };
}

function mapJobSummaryRow(row) {
  return {
    totalJobsCount: toNumber(row && row.total_jobs_count),
    unassignedJobsCount: toNumber(row && row.unassigned_jobs_count),
    pendingCount: toNumber(row && row.pending_count),
    assignedCount: toNumber(row && row.assigned_count),
    pickedUpCount: toNumber(row && row.picked_up_count),
    inTransitCount: toNumber(row && row.in_transit_count),
    deliveredCount: toNumber(row && row.delivered_count),
    failedCount: toNumber(row && row.failed_count),
    cancelledCount: toNumber(row && row.cancelled_count),
    activeJobsCount: toNumber(row && row.active_jobs_count),
    deliveryFeesKobo: toNumber(row && row.delivery_fees_kobo),
    platformMarginKobo: toNumber(row && row.platform_margin_kobo),
    companyShareKobo: toNumber(row && row.company_share_kobo),
    averageDeliveryFeeKobo: toNumber(row && row.average_delivery_fee_kobo)
  };
}

function mapPerformanceRiderRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: Number(row.rider_id),
    companyId: Number(row.rider_company_id),
    zoneId: Number(row.rider_zone_id),
    fullName: row.rider_full_name,
    phone: row.rider_phone,
    email: row.rider_email,
    vehicleType: row.rider_vehicle_type,
    status: row.rider_status,
    accountStatus: row.rider_account_status || 'active',
    createdAt: row.rider_created_at,
    updatedAt: row.rider_updated_at,
    zone: mapPerformanceZone(row),
    company: mapPerformanceCompany(row)
  };
}

function mapRiderPerformanceRow(row) {
  if (!row) {
    return null;
  }

  return {
    rider: mapPerformanceRiderRow(row),
    totalJobsCount: toNumber(row.total_jobs_count),
    assignedJobsCount: toNumber(row.assigned_jobs_count),
    pickedUpJobsCount: toNumber(row.picked_up_jobs_count),
    inTransitJobsCount: toNumber(row.in_transit_jobs_count),
    activeJobsCount: toNumber(row.active_jobs_count),
    deliveredJobsCount: toNumber(row.delivered_jobs_count),
    failedJobsCount: toNumber(row.failed_jobs_count),
    cancelledJobsCount: toNumber(row.cancelled_jobs_count),
    deliveryFeesKobo: toNumber(row.delivery_fees_kobo),
    companyShareKobo: toNumber(row.company_share_kobo)
  };
}

const riderPerformanceSelectSql = `
  r.id AS rider_id,
  r.company_id AS rider_company_id,
  r.zone_id AS rider_zone_id,
  r.full_name AS rider_full_name,
  r.phone AS rider_phone,
  r.email AS rider_email,
  r.vehicle_type AS rider_vehicle_type,
  r.availability_status AS rider_status,
  r.status AS rider_account_status,
  r.created_at AS rider_created_at,
  r.updated_at AS rider_updated_at,
  dz.id AS zone_id,
  dz.name AS zone_name,
  dz.state AS zone_state,
  dz.city AS zone_city,
  dz.created_at AS zone_created_at,
  dz.updated_at AS zone_updated_at,
  lc.id AS company_id,
  lc.name AS company_name,
  lc.email AS company_email,
  lc.phone AS company_phone,
  lc.address AS company_address,
  lc.status AS company_status,
  lc.approved_by AS company_approved_by,
  lc.created_at AS company_created_at,
  lc.updated_at AS company_updated_at
`;

const jobSelectSql = `
  dj.id,
  dj.order_id,
  dj.order_item_id,
  dj.seller_id,
  dj.zone_id AS delivery_zone_id,
  dj.company_id,
  dj.rider_id,
  dj.status,
  dj.failure_reason,
  dj.delivery_fee_kobo,
  dj.platform_margin_kobo,
  dj.company_share_kobo,
  dj.pickup_address,
  dj.assigned_at,
  dj.picked_up_at,
  dj.in_transit_at,
  dj.delivered_at,
  dj.settlement_recorded_at,
  dj.created_at,
  dj.updated_at,
  o.buyer_id,
  o.status AS order_status,
  o.payment_method,
  o.payment_reference,
  o.payment_status,
  o.total_kobo,
  o.delivery_address_id,
  o.delivery_label,
  o.delivery_street,
  o.delivery_city,
  o.delivery_state,
  o.delivery_phone,
  oi.product_id,
  oi.quantity,
  oi.line_total_kobo,
  oi.item_status,
  p.title,
  p.part_number,
  buyer.full_name AS buyer_full_name,
  buyer.email AS buyer_email,
  buyer.phone AS buyer_phone,
  seller.user_id AS seller_user_id,
  seller.business_name,
  seller.contact_email,
  seller.contact_phone,
  seller.address AS seller_address,
  seller_user.full_name AS seller_full_name,
  seller_user.email AS seller_email,
  seller_user.phone AS seller_phone,
  zone.id AS zone_ref_id,
  zone.name AS zone_name,
  zone.state AS zone_state,
  zone.city AS zone_city,
  zone.created_at AS zone_created_at,
  zone.updated_at AS zone_updated_at,
  assigned.id AS assigned_rider_id,
  assigned.company_id AS assigned_rider_company_id,
  assigned.zone_id AS assigned_rider_zone_id,
  assigned.full_name AS assigned_rider_full_name,
  assigned.phone AS assigned_rider_phone,
  assigned.email AS assigned_rider_email,
  assigned.vehicle_type AS assigned_rider_vehicle_type,
  assigned.availability_status AS assigned_rider_status,
  assigned.status AS assigned_rider_account_status,
  assigned.created_at AS assigned_rider_created_at,
  assigned.updated_at AS assigned_rider_updated_at,
  assigned_company.id AS assigned_company_id,
  assigned_company.name AS assigned_company_name,
  assigned_company.email AS assigned_company_email,
  assigned_company.phone AS assigned_company_phone,
  assigned_company.address AS assigned_company_address,
  assigned_company.status AS assigned_company_status,
  assigned_company.approved_by AS assigned_company_approved_by,
  assigned_company.created_at AS assigned_company_created_at,
  assigned_company.updated_at AS assigned_company_updated_at
`;

const jobJoinsSql = `
  FROM delivery_jobs dj
  INNER JOIN orders o ON o.id = dj.order_id
  INNER JOIN order_items oi ON oi.id = dj.order_item_id
  INNER JOIN products p ON p.id = oi.product_id
  INNER JOIN users buyer ON buyer.id = o.buyer_id
  INNER JOIN seller_profiles seller ON seller.id = dj.seller_id
  INNER JOIN users seller_user ON seller_user.id = seller.user_id
  LEFT JOIN delivery_zones zone ON zone.id = dj.zone_id
  LEFT JOIN riders assigned ON assigned.id = dj.rider_id
  LEFT JOIN logistics_companies assigned_company ON assigned_company.id = dj.company_id
`;

async function findJobByIdWithExecutor(executor, jobId) {
  const [rows] = await executor.execute(
    `
      SELECT
        ${jobSelectSql}
      ${jobJoinsSql}
      WHERE dj.id = ?
      LIMIT 1
    `,
    [jobId]
  );

  return mapDeliveryJobRow(rows[0]);
}

async function findJobByOrderItemIdWithExecutor(executor, orderItemId) {
  const [rows] = await executor.execute(
    `
      SELECT id
      FROM delivery_jobs
      WHERE order_item_id = ?
      LIMIT 1
    `,
    [orderItemId]
  );

  if (!rows[0]) {
    return null;
  }

  return findJobByIdWithExecutor(executor, rows[0].id);
}

async function resolveNextOrderStatusWithConnection(connection, orderId) {
  const [rows] = await connection.execute(
    `
      SELECT
        COALESCE(
          SUM(CASE WHEN oi.item_status <> ? THEN 1 ELSE 0 END),
          0
        ) AS active_items,
        COALESCE(
          SUM(CASE WHEN oi.item_status = ? THEN 1 ELSE 0 END),
          0
        ) AS delivered_items,
        COALESCE(
          SUM(CASE WHEN oi.item_status = ? THEN 1 ELSE 0 END),
          0
        ) AS picked_up_items,
        COALESCE(
          SUM(CASE WHEN dj.status = ? THEN 1 ELSE 0 END),
          0
        ) AS in_transit_jobs
      FROM order_items oi
      LEFT JOIN delivery_jobs dj ON dj.order_item_id = oi.id
      WHERE oi.order_id = ?
    `,
    [
      ORDER_ITEM_STATUSES.CANCELLED,
      ORDER_ITEM_STATUSES.DELIVERED,
      ORDER_ITEM_STATUSES.PICKED_UP,
      DELIVERY_JOB_STATUSES.IN_TRANSIT,
      orderId
    ]
  );
  const summary = rows[0] || {};
  const activeItems = Number(summary.active_items || 0);
  const deliveredItems = Number(summary.delivered_items || 0);
  const pickedUpItems = Number(summary.picked_up_items || 0);
  const inTransitJobs = Number(summary.in_transit_jobs || 0);

  if (activeItems > 0 && deliveredItems === activeItems) {
    return ORDER_STATUSES.DELIVERED;
  }

  if (inTransitJobs > 0) {
    return ORDER_STATUSES.IN_TRANSIT;
  }

  if (pickedUpItems > 0 || deliveredItems > 0) {
    return ORDER_STATUSES.PICKED_UP;
  }

  return ORDER_STATUSES.CONFIRMED;
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

  if (trimmedNote) {
    return trimmedNote;
  }

  return `Delivery job moved from ${currentStatus} to ${nextStatus}.`;
}

function createDeliveryJobsRepository({ db }) {
  return {
    async createJobForOrderItem({ orderItemId, sellerId }) {
      const connection = await db.getConnection();

      try {
        await connection.beginTransaction();

        const existingJob = await findJobByOrderItemIdWithExecutor(connection, orderItemId);

        if (existingJob) {
          await connection.commit();

          return existingJob;
        }

        const [rows] = await connection.execute(
          `
            SELECT
              oi.order_id,
              oi.id AS order_item_id,
              oi.seller_id,
              oi.delivery_fee_kobo,
              sp.address AS pickup_address,
              dz.id AS zone_id
            FROM order_items oi
            INNER JOIN orders o ON o.id = oi.order_id
            INNER JOIN seller_profiles sp ON sp.id = oi.seller_id
            LEFT JOIN delivery_zones dz
              ON LOWER(dz.city) = LOWER(o.delivery_city)
              AND LOWER(dz.state) = LOWER(o.delivery_state)
            WHERE oi.id = ? AND oi.seller_id = ?
            LIMIT 1
          `,
          [orderItemId, sellerId]
        );
        const sourceRow = rows[0];

        if (!sourceRow) {
          await connection.rollback();

          return null;
        }

        const [insertResult] = await connection.execute(
          `
            INSERT INTO delivery_jobs (
              order_id,
              order_item_id,
              seller_id,
              zone_id,
              status,
              delivery_fee_kobo,
              pickup_address
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            sourceRow.order_id,
            sourceRow.order_item_id,
            sourceRow.seller_id,
            toNumber(sourceRow.zone_id),
            DELIVERY_JOB_STATUSES.PENDING,
            toNumber(sourceRow.delivery_fee_kobo),
            sourceRow.pickup_address
          ]
        );

        await insertDeliveryJobStatusHistoryWithConnection(connection, {
          deliveryJobId: insertResult.insertId,
          status: DELIVERY_JOB_STATUSES.PENDING,
          note: 'Seller marked the order item ready for pickup and the delivery job is awaiting assignment.'
        });

        const job = await findJobByIdWithExecutor(connection, insertResult.insertId);
        await connection.commit();

        return job;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async listJobs(filters) {
      const pagination = sanitizeLimitOffset(filters);
      const builtFilters = buildJobFilters(filters);
      const [countRows] = await db.execute(
        `
          SELECT COUNT(*) AS total
          ${jobJoinsSql}
          ${builtFilters.clause}
        `,
        builtFilters.params
      );
      const [rows] = await db.execute(
        `
          SELECT
            ${jobSelectSql}
          ${jobJoinsSql}
          ${builtFilters.clause}
          ORDER BY
            CASE dj.status
              WHEN 'pending' THEN 1
              WHEN 'assigned' THEN 2
              WHEN 'picked_up' THEN 3
              WHEN 'in_transit' THEN 4
              WHEN 'failed' THEN 5
              WHEN 'delivered' THEN 6
              WHEN 'cancelled' THEN 7
              ELSE 8
            END ASC,
            dj.created_at DESC,
            dj.id DESC
          LIMIT ${pagination.limit} OFFSET ${pagination.offset}
        `,
        builtFilters.params
      );

      return {
        jobs: rows.map(mapDeliveryJobRow),
        total: Number((countRows[0] && countRows[0].total) || 0)
      };
    },

    async summarizeJobs(filters = {}) {
      const builtFilters = buildJobFilters(filters, {
        ignoreStatus: true
      });
      const [rows] = await db.execute(
        `
          SELECT
            COUNT(*) AS total_jobs_count,
            COALESCE(SUM(CASE WHEN dj.rider_id IS NULL THEN 1 ELSE 0 END), 0) AS unassigned_jobs_count,
            COALESCE(SUM(CASE WHEN dj.status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_count,
            COALESCE(SUM(CASE WHEN dj.status = 'assigned' THEN 1 ELSE 0 END), 0) AS assigned_count,
            COALESCE(SUM(CASE WHEN dj.status = 'picked_up' THEN 1 ELSE 0 END), 0) AS picked_up_count,
            COALESCE(SUM(CASE WHEN dj.status = 'in_transit' THEN 1 ELSE 0 END), 0) AS in_transit_count,
            COALESCE(SUM(CASE WHEN dj.status = 'delivered' THEN 1 ELSE 0 END), 0) AS delivered_count,
            COALESCE(SUM(CASE WHEN dj.status = 'failed' THEN 1 ELSE 0 END), 0) AS failed_count,
            COALESCE(SUM(CASE WHEN dj.status = 'cancelled' THEN 1 ELSE 0 END), 0) AS cancelled_count,
            COALESCE(
              SUM(
                CASE
                  WHEN dj.status IN ('assigned', 'picked_up', 'in_transit') THEN 1
                  ELSE 0
                END
              ),
              0
            ) AS active_jobs_count,
            COALESCE(
              SUM(
                CASE
                  WHEN dj.status = 'delivered' THEN dj.delivery_fee_kobo
                  ELSE 0
                END
              ),
              0
            ) AS delivery_fees_kobo,
            COALESCE(
              SUM(
                CASE
                  WHEN dj.status = 'delivered' THEN dj.platform_margin_kobo
                  ELSE 0
                END
              ),
              0
            ) AS platform_margin_kobo,
            COALESCE(
              SUM(
                CASE
                  WHEN dj.status = 'delivered' THEN dj.company_share_kobo
                  ELSE 0
                END
              ),
              0
            ) AS company_share_kobo,
            COALESCE(
              ROUND(
                AVG(
                  CASE
                    WHEN dj.status = 'delivered' THEN dj.delivery_fee_kobo
                    ELSE NULL
                  END
                ),
                0
              ),
              0
            ) AS average_delivery_fee_kobo
          ${jobJoinsSql}
          ${builtFilters.clause}
        `,
        builtFilters.params
      );

      return mapJobSummaryRow(rows[0]);
    },

    async listCompanyRiderPerformance({ companyId }) {
      const [rows] = await db.execute(
        `
          SELECT
            ${riderPerformanceSelectSql},
            COALESCE(metrics.total_jobs_count, 0) AS total_jobs_count,
            COALESCE(metrics.assigned_jobs_count, 0) AS assigned_jobs_count,
            COALESCE(metrics.picked_up_jobs_count, 0) AS picked_up_jobs_count,
            COALESCE(metrics.in_transit_jobs_count, 0) AS in_transit_jobs_count,
            COALESCE(metrics.active_jobs_count, 0) AS active_jobs_count,
            COALESCE(metrics.delivered_jobs_count, 0) AS delivered_jobs_count,
            COALESCE(metrics.failed_jobs_count, 0) AS failed_jobs_count,
            COALESCE(metrics.cancelled_jobs_count, 0) AS cancelled_jobs_count,
            COALESCE(metrics.delivery_fees_kobo, 0) AS delivery_fees_kobo,
            COALESCE(metrics.company_share_kobo, 0) AS company_share_kobo
          FROM riders r
          INNER JOIN logistics_companies lc ON lc.id = r.company_id
          INNER JOIN delivery_zones dz ON dz.id = r.zone_id
          LEFT JOIN (
            SELECT
              dj.rider_id,
              COUNT(*) AS total_jobs_count,
              SUM(CASE WHEN dj.status = 'assigned' THEN 1 ELSE 0 END) AS assigned_jobs_count,
              SUM(CASE WHEN dj.status = 'picked_up' THEN 1 ELSE 0 END) AS picked_up_jobs_count,
              SUM(CASE WHEN dj.status = 'in_transit' THEN 1 ELSE 0 END) AS in_transit_jobs_count,
              SUM(
                CASE
                  WHEN dj.status IN ('assigned', 'picked_up', 'in_transit') THEN 1
                  ELSE 0
                END
              ) AS active_jobs_count,
              SUM(CASE WHEN dj.status = 'delivered' THEN 1 ELSE 0 END) AS delivered_jobs_count,
              SUM(CASE WHEN dj.status = 'failed' THEN 1 ELSE 0 END) AS failed_jobs_count,
              SUM(CASE WHEN dj.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_jobs_count,
              SUM(CASE WHEN dj.status = 'delivered' THEN dj.delivery_fee_kobo ELSE 0 END) AS delivery_fees_kobo,
              SUM(CASE WHEN dj.status = 'delivered' THEN dj.company_share_kobo ELSE 0 END) AS company_share_kobo
            FROM delivery_jobs dj
            WHERE dj.company_id = ?
              AND dj.rider_id IS NOT NULL
            GROUP BY dj.rider_id
          ) metrics ON metrics.rider_id = r.id
          WHERE r.company_id = ?
          ORDER BY
            COALESCE(metrics.delivered_jobs_count, 0) DESC,
            COALESCE(metrics.active_jobs_count, 0) DESC,
            r.updated_at DESC,
            r.id DESC
        `,
        [companyId, companyId]
      );

      return rows.map(mapRiderPerformanceRow);
    },

    async listActiveJobsForRider({ riderId }) {
      const [rows] = await db.execute(
        `
          SELECT
            ${jobSelectSql}
          ${jobJoinsSql}
          WHERE dj.rider_id = ?
            AND dj.status IN (?, ?, ?)
          ORDER BY
            CASE dj.status
              WHEN 'assigned' THEN 1
              WHEN 'picked_up' THEN 2
              WHEN 'in_transit' THEN 3
              ELSE 4
            END ASC,
            dj.created_at ASC,
            dj.id ASC
        `,
        [
          riderId,
          DELIVERY_JOB_STATUSES.ASSIGNED,
          DELIVERY_JOB_STATUSES.PICKED_UP,
          DELIVERY_JOB_STATUSES.IN_TRANSIT
        ]
      );

      return rows.map(mapDeliveryJobRow);
    },

    async findJobById(jobId) {
      return findJobByIdWithExecutor(db, jobId);
    },

    async findStatusHistoryByJobId(jobId) {
      const [rows] = await db.execute(
        `
          SELECT
            id,
            delivery_job_id,
            status,
            note,
            created_at,
            updated_at
          FROM delivery_job_status_history
          WHERE delivery_job_id = ?
          ORDER BY created_at ASC, id ASC
        `,
        [jobId]
      );

      return rows.map(mapStatusHistoryRow);
    },

    async unassignJob({ jobId, note }) {
      const connection = await db.getConnection();

      try {
        await connection.beginTransaction();

        const existingJob = await findJobByIdWithExecutor(connection, jobId);

        if (!existingJob) {
          await connection.rollback();

          return null;
        }

        await connection.execute(
          `
            UPDATE delivery_jobs
            SET
              company_id = NULL,
              rider_id = NULL,
              status = ?,
              failure_reason = NULL,
              assigned_at = NULL,
              picked_up_at = NULL,
              in_transit_at = NULL,
              delivered_at = NULL,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          [DELIVERY_JOB_STATUSES.PENDING, jobId]
        );

        await insertDeliveryJobStatusHistoryWithConnection(connection, {
          deliveryJobId: jobId,
          status: DELIVERY_JOB_STATUSES.PENDING,
          note
        });

        const nextOrderStatus = await resolveNextOrderStatusWithConnection(
          connection,
          existingJob.orderId
        );

        if (existingJob.order.status !== nextOrderStatus) {
          await connection.execute(
            `
              UPDATE orders
              SET status = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `,
            [nextOrderStatus, existingJob.orderId]
          );

          await insertOrderStatusHistoryWithConnection(connection, {
            orderId: existingJob.orderId,
            status: nextOrderStatus,
            note: resolveOrderStatusHistoryNote(nextOrderStatus)
          });
        }

        const updatedJob = await findJobByIdWithExecutor(connection, jobId);
        await connection.commit();

        return updatedJob;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async flagJobForManualHandling({ jobId, note }) {
      const connection = await db.getConnection();

      try {
        await connection.beginTransaction();

        const existingJob = await findJobByIdWithExecutor(connection, jobId);

        if (!existingJob) {
          await connection.rollback();

          return null;
        }

        await insertDeliveryJobStatusHistoryWithConnection(connection, {
          deliveryJobId: jobId,
          status: existingJob.status,
          note
        });

        const updatedJob = await findJobByIdWithExecutor(connection, jobId);
        await connection.commit();

        return updatedJob;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },

    async assignJob({ jobId, riderId, companyId, note }) {
      const connection = await db.getConnection();

      try {
        await connection.beginTransaction();

        const existingJob = await findJobByIdWithExecutor(connection, jobId);

        if (!existingJob) {
          await connection.rollback();

          return null;
        }

        const now = new Date();

        await connection.execute(
          `
            UPDATE delivery_jobs
            SET
              zone_id = COALESCE(zone_id, ?),
              company_id = ?,
              rider_id = ?,
              status = ?,
              failure_reason = NULL,
              assigned_at = ?,
              picked_up_at = ?,
              in_transit_at = ?,
              delivered_at = NULL,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          [
            existingJob.zoneId,
            companyId,
            riderId,
            DELIVERY_JOB_STATUSES.ASSIGNED,
            existingJob.status === DELIVERY_JOB_STATUSES.FAILED
              ? now
              : (existingJob.assignedAt || now),
            existingJob.status === DELIVERY_JOB_STATUSES.FAILED
              ? null
              : existingJob.pickedUpAt,
            existingJob.status === DELIVERY_JOB_STATUSES.FAILED
              ? null
              : existingJob.inTransitAt,
            jobId
          ]
        );

        await connection.execute(
          `
            UPDATE riders
            SET
              availability_status = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          [RIDER_STATUSES.ON_DELIVERY, riderId]
        );

        await insertDeliveryJobStatusHistoryWithConnection(connection, {
          deliveryJobId: jobId,
          status: DELIVERY_JOB_STATUSES.ASSIGNED,
          note
        });

        const assignedJob = await findJobByIdWithExecutor(connection, jobId);
        await connection.commit();

        return assignedJob;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
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
      const connection = await db.getConnection();

      try {
        await connection.beginTransaction();

        const existingJob = await findJobByIdWithExecutor(connection, jobId);

        if (!existingJob) {
          await connection.rollback();

          return null;
        }

        const now = new Date();
        const nextAssignedAt = existingJob.assignedAt || now;
        const nextPickedUpAt = status === DELIVERY_JOB_STATUSES.PICKED_UP
          ? now
          : existingJob.pickedUpAt;
        const nextInTransitAt = status === DELIVERY_JOB_STATUSES.IN_TRANSIT
          ? now
          : existingJob.inTransitAt;
        const nextDeliveredAt = status === DELIVERY_JOB_STATUSES.DELIVERED
          ? now
          : existingJob.deliveredAt;
        const nextFailureReason = status === DELIVERY_JOB_STATUSES.FAILED
          ? failureReason
          : null;
        const nextPlatformMarginKobo = status === DELIVERY_JOB_STATUSES.DELIVERED
          ? toNumber(platformMarginKobo)
          : existingJob.platformMarginKobo;
        const nextCompanyShareKobo = status === DELIVERY_JOB_STATUSES.DELIVERED
          ? toNumber(companyShareKobo)
          : existingJob.companyShareKobo;
        const nextSettlementRecordedAt = status === DELIVERY_JOB_STATUSES.DELIVERED
          ? now
          : existingJob.settlementRecordedAt;
        const nextRiderId = existingJob.assignedRider
          ? existingJob.assignedRider.id
          : Number(riderId);
        const nextCompanyId = existingJob.assignedCompany
          ? existingJob.assignedCompany.id
          : Number(companyId);

        await connection.execute(
          `
            UPDATE delivery_jobs
            SET
              company_id = ?,
              rider_id = ?,
              status = ?,
              failure_reason = ?,
              platform_margin_kobo = ?,
              company_share_kobo = ?,
              assigned_at = ?,
              picked_up_at = ?,
              in_transit_at = ?,
              delivered_at = ?,
              settlement_recorded_at = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          [
            nextCompanyId,
            nextRiderId,
            status,
            nextFailureReason,
            nextPlatformMarginKobo,
            nextCompanyShareKobo,
            nextAssignedAt,
            nextPickedUpAt,
            nextInTransitAt,
            nextDeliveredAt,
            nextSettlementRecordedAt,
            jobId
          ]
        );

        await insertDeliveryJobStatusHistoryWithConnection(connection, {
          deliveryJobId: jobId,
          status,
          note: resolveJobStatusNote(existingJob.status, status, note, failureReason)
        });

        if (
          status === DELIVERY_JOB_STATUSES.PICKED_UP
          || status === DELIVERY_JOB_STATUSES.IN_TRANSIT
        ) {
          await connection.execute(
            `
              UPDATE riders
              SET
                availability_status = ?,
                updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `,
            [RIDER_STATUSES.ON_DELIVERY, nextRiderId]
          );
        }

        if (status === DELIVERY_JOB_STATUSES.PICKED_UP) {
          await connection.execute(
            `
              UPDATE order_items
              SET item_status = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `,
            [ORDER_ITEM_STATUSES.PICKED_UP, existingJob.orderItemId]
          );
        }

        if (status === DELIVERY_JOB_STATUSES.DELIVERED) {
          await connection.execute(
            `
              UPDATE riders
              SET
                availability_status = ?,
                updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `,
            [RIDER_STATUSES.AVAILABLE, nextRiderId]
          );

          await connection.execute(
            `
              UPDATE order_items
              SET item_status = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `,
            [ORDER_ITEM_STATUSES.DELIVERED, existingJob.orderItemId]
          );
        }

        if (status === DELIVERY_JOB_STATUSES.FAILED) {
          await connection.execute(
            `
              UPDATE riders
              SET
                availability_status = ?,
                updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `,
            [RIDER_STATUSES.AVAILABLE, nextRiderId]
          );

          await connection.execute(
            `
              UPDATE order_items
              SET item_status = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `,
            [ORDER_ITEM_STATUSES.READY_FOR_PICKUP, existingJob.orderItemId]
          );
        }

        const nextOrderStatus = await resolveNextOrderStatusWithConnection(
          connection,
          existingJob.orderId
        );

        if (existingJob.order.status !== nextOrderStatus) {
          await connection.execute(
            `
              UPDATE orders
              SET status = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `,
            [nextOrderStatus, existingJob.orderId]
          );

          await insertOrderStatusHistoryWithConnection(connection, {
            orderId: existingJob.orderId,
            status: nextOrderStatus,
            note: resolveOrderStatusHistoryNote(nextOrderStatus)
          });
        }

        const updatedJob = await findJobByIdWithExecutor(connection, jobId);
        await connection.commit();

        return updatedJob;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }
  };
}

module.exports = {
  createDeliveryJobsRepository
};
