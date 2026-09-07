CONTEXT
Node.js + Express backend (CommonJS) for the AutoParts marketplace, MySQL.
Architecture is repository → service → controller → route, wired through
createDependencies() in src/app.js. Joi validation, admin auth via
adminAuthMiddleware. Migrations run through scripts/migrate.js.

Adding three areas to the super-admin API: platform analytics, dispute
management, and seller context on orders.

BEFORE CHANGING ANYTHING
Read and report back on:
- src/repositories/admin-dashboard.repository.js, disputes.repository.js,
  orders.repository.js, sellers.repository.js, audit-log.repository.js
- src/services/admin.service.js and admin-dashboard.service.js
- src/routes/admin.routes.js and src/controllers/admin.controller.js
- the MySQL schema for orders, order_items, disputes, sellers, products,
  categories, payments — list the ACTUAL column names and enum values
- scripts/migrate.js and how existing migrations are structured
- the existing success/error response envelope and pagination convention

Then report: which order status values represent a completed/revenue-counting
sale, and the current dispute status enum. Do NOT invent either — I will
confirm before you build. Wait for approval after this report.

--------------------------------------------------------------------
TASK 1 — PLATFORM ANALYTICS
--------------------------------------------------------------------
GET /api/v1/admin/analytics/platform?period=7d|30d|90d|1y

Single endpoint returning everything the analytics screen needs:

summary: four metrics, each with current value and percentage change against
the immediately preceding window of equal length
  - totalGmvKobo
  - totalOrders
  - activeSellers   (sellers with at least one order in the window)
  - avgOrderValueKobo

gmvSeries: time series over the selected period
  - daily buckets for 7d/30d, weekly for 90d, monthly for 1y
  - each point: { bucket, gmvKobo }

ordersByWeek: last 8 weeks, each { weekLabel, orderCount }

categoryBreakdown: array of { categoryId, name, orderCount, percentage }
  ordered desc, top 5 with the remainder grouped as "Other"

revenueByCategory: array of { categoryId, name, revenueKobo, percentage }

topSellers: array of { rank, sellerId, businessName, location, gmvKobo,
  orderCount, rating } — limit configurable via ?topSellersLimit, default 5,
  max 20

GET /api/v1/admin/analytics/platform/export?period=30d
  Returns CSV of the same data. Set Content-Disposition attachment.

Rules:
- All money in kobo as integers. Never format currency server-side.
- Bucket dates in Africa/Lagos, not UTC, or daily totals will be wrong.
- Only count orders whose status represents a completed sale (from your report).
- Empty buckets must appear with zero, not be omitted — the chart needs a
  continuous axis.
- Percentage change when the previous period is zero: return null, not
  Infinity or 0.
- Aggregate in SQL. Do not pull rows into Node and reduce.
- Add indexes for the date-range and seller grouping queries if missing.
- avgOrderValueKobo MUST be derived as totalGmvKobo / totalOrders over the
  identical filtered order set — not computed from a separate query. The three
  figures must reconcile exactly.
- Where totalOrders is zero, return null for avgOrderValueKobo, not zero.

--------------------------------------------------------------------
TASK 2 — DISPUTES
--------------------------------------------------------------------
GET /api/v1/admin/disputes/stats
  { open, inReview, escalated, resolved, total }
  Drives the cards at the top of the disputes page.

GET /api/v1/admin/disputes
  Paginated list. Filters: status, sellerId, dateFrom, dateTo.
  Each row: disputeId, orderId, buyer name, seller business name, reason,
  status, openedAt, slaRemainingMinutes.

GET /api/v1/admin/disputes/:id
  Full detail:
  - dispute: id, orderId, buyer {id,name}, seller {id,businessName}, reason,
    status, openedAt, description
  - evidence: { buyer: { summary, attachments[] },
                seller: { summary, attachments[] } }
    attachments are { id, url, filename, uploadedAt }
  - order: { partName, orderValueKobo, placedAt }
  - sla: { deadlineAt, remainingMinutes, breached }
  - timeline: chronological events (opened, info requested, escalated, ruled,
    closed) with actor and timestamp

ACTIONS — all admin-only, all recorded to the audit log AND the dispute
timeline with the acting admin id:

POST /api/v1/admin/disputes/:id/request-info
  body: { message, requestedFrom: "buyer"|"seller"|"both" }
  Sets status to in_review.

POST /api/v1/admin/disputes/:id/escalate
  body: { reason }
  Sets status to escalated.

POST /api/v1/admin/disputes/:id/ruling
  body: {
    notes            (required, min 10 chars),
    decision         ("refund_buyer_full" | "refund_seller" |
                      "partial_refund" | "no_action"),
    partialAmountKobo (required only when decision is partial_refund; must be
                       > 0 and <= order value),
    requireReverseLogistics (boolean, default false)
  }
  Records the ruling and sets status to resolved.

POST /api/v1/admin/disputes/:id/close
  body: { reason }
  Sets status to closed. Only allowed from resolved or escalated.

Status transitions must be validated in the service layer. Reject invalid
moves with 409 and a clear message — do not silently allow them.

IMPORTANT — do NOT wire refunds to Paystack. Record the ruling and leave a
clearly marked TODO where the refund would be triggered. Report what the
payments service currently supports so I can decide separately. Likewise for
reverse logistics: set the flag, do not auto-create a delivery job.

Schema: add whatever tables are needed (dispute_events, dispute_rulings,
dispute_attachments) as a new migration following the existing pattern. Do not
alter existing tables destructively. SLA duration should read from
platform_config if that table supports it, otherwise an env var with a
sensible default — tell me which you chose.

--------------------------------------------------------------------
TASK 3 — SELLER CONTEXT ON ADMIN ORDERS
--------------------------------------------------------------------
Extend the existing admin orders list so each order includes:
  seller: { id, businessName, location }

Add GET /api/v1/admin/orders/:id returning full detail: buyer, seller,
line items with part names and quantities, amounts, payment status, delivery
status, current status, timestamps, and any linked dispute id.

Use a JOIN. Do not introduce an N+1 query per order in the list endpoint.

--------------------------------------------------------------------
CONSTRAINTS
--------------------------------------------------------------------
- Follow the existing repository/service/controller/route structure exactly.
  No logic in controllers, no SQL outside repositories.
- Joi validation for every query param and body, matching existing schemas.
- Match the existing response envelope and error codes.
- Admin auth on every new route.
- No new dependencies without asking.
- Do not modify seller-facing or buyer-facing endpoints.

ACCEPTANCE
- Every endpoint returns correctly shaped data against seeded test data.
- Analytics numbers reconcile: summary totals equal the sum of their series.
- Invalid dispute status transitions return 409.
- partial_refund without partialAmountKobo returns 422.
- Ruling, escalation, info request and close all appear in the audit log.
- The orders list issues one query regardless of result count.
- npm run migrate runs clean on a fresh database.
- avgOrderValueKobo × totalOrders equals totalGmvKobo (within rounding).
- categoryBreakdown percentages sum to 100.
- The sum of topSellers gmvKobo does not exceed totalGmvKobo.

When done, list every file created or changed, every new endpoint, the
migration filename, and anything you could not complete or had to assume.