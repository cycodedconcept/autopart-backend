# Admin platform API handoff

Implementation and verification completed on 2026-09-07. The revenue rule confirmed in this conversation is `orders.status = 'delivered'` AND `orders.payment_status = 'paid'`.

## Endpoints

All paths below start with `/api/v1/admin`. All routes require admin authentication and the indicated existing permission.

| Method | Path | Permission | Change |
| --- | --- | --- | --- |
| GET | `/analytics/platform` | `dashboard.read` | New analytics response |
| GET | `/analytics/platform/export` | `dashboard.read` | New CSV attachment |
| GET | `/disputes/stats` | `disputes.resolve` | New cards |
| GET | `/disputes` | `disputes.resolve` | Extended list and filters |
| GET | `/disputes/:id` | `disputes.resolve` | New detail, evidence, SLA and timeline |
| POST | `/disputes/:id/request-info` | `disputes.resolve` | New information request |
| POST | `/disputes/:id/escalate` | `disputes.resolve` | New escalation |
| POST | `/disputes/:id/ruling` | `disputes.resolve` | New recorded ruling |
| POST | `/disputes/:id/close` | `disputes.resolve` | New closure |
| GET | `/orders` | `orders.manage` | Extended seller context, one repository query including total count |
| GET | `/orders/:id` | `orders.manage` | New full detail |

Analytics accepts `period=7d|30d|90d|1y` (default `30d`) and `topSellersLimit=1..20` (default 5), including for CSV export. Summary entries have `{ value, changePercent }`. CSV contains the same summary and all five data sections, plus period metadata, with `Content-Disposition: attachment`.

Dispute list accepts `status`, `sellerId`, `dateFrom`, `dateTo`, `page`, `limit` and the existing `raisedBy`/`search` filters. Dates must be real `YYYY-MM-DD` dates. Both dates are inclusive Lagos calendar dates.

## Response conventions and architecture review

JSON success envelope: `{ success: true, data, message }`.
JSON error envelope: `{ success: false, error: { code, message } }`.
Paginated data keeps `orders` or `disputes`, `pagination: { page, limit, total, totalPages }`, and `filters`. Defaults are page 1, limit 10, maximum limit 50. Empty results have `totalPages: 0`.

Joi validation returns 422/`VALIDATION_ERROR`; missing records return 404/`NOT_FOUND`; invalid transitions return 409/`CONFLICT`. Authentication/permission errors retain the existing 401/403 envelopes. CSV intentionally uses a file response.

The implementation follows repository → service → controller → route, with wiring in `createDependencies()` in `src/app.js`. Controllers delegate and set response headers/envelopes. SQL stays in repositories and SQL migration files; test SQL stays in the fixture repository.

The reviewed existing components establish these conventions:

- `admin-dashboard.repository.js` calculates dashboard aggregates in SQL. Its existing platform GMV counts paid orders; commission revenue excludes cancelled orders/items. Those older dashboard definitions differ from the newly confirmed delivered-and-paid analytics rule.
- `admin-dashboard.service.js` builds the existing dashboard sections, trends and SLA previews. The existing dashboard remains intact.
- `disputes.repository.js` joins orders, buyers, sellers and resolving admins and supports the original dispute list/decision route. New workflow writes use a locked dispute row and one transaction for status, ruling, events and audit.
- `orders.repository.js` supports buyer/seller/admin queries. Only admin query methods and mapping were extended. The admin list uses joined SQL aggregates and returns its page and total in one statement, including empty pages.
- `sellers.repository.js` uses `seller_profiles` joined to `users`, with verification metadata and seller documents. There is no `sellers` table; seller location comes from `seller_profiles.address`.
- `audit-log.repository.js` stores JSON event details and joins admins for display. Its create method now accepts a transaction executor.
- `admin.service.js` keeps pagination, mapping and service rules for admin operations. Dedicated analytics/dispute services handle the new work. `admin.controller.js` and `admin.routes.js` retain existing auth, permissions, validation and response handling.

## Analytics definitions and assumptions

- Windows use `orders.created_at`, with the confirmed current order/payment statuses. They do not use a delivery completion timestamp.
- Periods cover the selected number of Lagos calendar days including today, through the next midnight exclusively. `1y` means 365 days. The preceding comparison window has exactly the same length.
- `7d`/`30d` buckets are daily; `90d` buckets start on Mondays; `1y` buckets start on the first of each month. Partial edge weeks/months contain only in-window orders. Missing buckets are zero-filled.
- `ordersByWeek` covers the current Lagos week and the seven preceding weeks.
- Summary GMV and series sum `orders.total_kobo`, including delivery fees. Average order value is that same total divided by the same order count, rounded to the nearest integer kobo. The reconstruction error is at most half a kobo per order. Empty order sets return a null average.
- Previous zero/null values produce a null percentage change.
- Seller GMV and category revenue sum merchandise `order_items.line_total_kobo`, excluding delivery fees. Seller totals therefore do not exceed overall GMV for consistent order data.
- Category counts mean distinct order appearances per category. An order containing several categories contributes once to each of those categories. Percentages use the sum of those counts as denominator and allocate hundredths so they total 100 for nonempty data. Top five categories are followed by an `Other` row when needed; `Other.categoryId` is null. An empty breakdown is an empty array.
- SQL performs order/item aggregation; Node maps SQL aggregates, fills the calendar axis and allocates percentage rounding. Analytics queries share a consistent read snapshot.

For orders containing multiple sellers, the single `seller` field uses the seller of the first line item (lowest `order_items.id`), and `sellers[]` preserves all sellers ordered by seller ID. This is the documented default chosen to fill the requested singular field without losing the remaining seller context. List/detail use the same rule. Orders without any seller-backed items return `seller: null`. A dispute without an explicit seller on a multiple-seller order retains null seller context and exposes all sellers rather than attributing a complaint to an arbitrary seller.

## Dispute workflow and deferred side effects

The pre-040 dispute status enum is `open, resolved, rejected` (migration 028). Migration 040 preserves all three and appends `in_review, escalated, closed`.

| Action | Allowed starting statuses | Result | Timeline/audit event |
| --- | --- | --- | --- |
| Request info | open | in_review | info_requested / dispute.info_requested |
| Escalate | open, in_review | escalated | escalated / dispute.escalated |
| Ruling | open, in_review, escalated | resolved | ruled / dispute.ruled |
| Close | resolved, escalated | closed | closed / dispute.closed |

Repeated requests that would remain in the same status return 409. Rejected and closed disputes are terminal. Every new action records the acting admin ID. Concurrent actions lock the dispute row; failure to persist the audit rolls back the status, ruling and timeline.

Ruling decisions are `refund_buyer_full`, `refund_seller`, `partial_refund`, `no_action`. Notes require at least 10 characters. Partial refunds require a positive integer `partialAmountKobo` no greater than the order total. That field is forbidden for other decisions. Reverse logistics defaults to false.

SLA uses `platform_config` row `key = 'platform_settings'`, JSON property `disputeReviewSlaHours`. Positive integers up to 8760 are honored; missing/invalid values fall back to 24 hours. Migration 040 seeds 24 only when the property is absent. Set it through the existing admin config endpoint, for example `{ "platformSettings": { "disputeReviewSlaHours": 48 } }`. Terminal disputes stop the SLA clock at resolution/closure; negative remaining minutes indicate a breach.

Payments currently support initialization, buyer verification/callback verification, signed and deduplicated Paystack webhooks, amount/currency mismatch flagging and pending-payment reconciliation/expiry. The Paystack client exposes transaction initialize/verify and webhook signature verification, with no refund operation.

The new ruling workflow records decisions only. Explicit `TODO(refunds)` and `TODO(reverse-logistics)` comments mark later integrations. It makes no refund call, does not mutate payment status, and does not create a delivery job. Evidence summaries and attachment metadata can be read; uploading/submitting new evidence was not part of the requested endpoints. The request-info action records the message/requested parties; no email or other notification is sent.

## Migration

`src/db/migrations/040_add_admin_platform_analytics_and_dispute_workflow.sql`

Adds `dispute_events`, `dispute_rulings`, `dispute_attachments`; adds dispute description/evidence summaries/closure timestamp; extends the enum without removing values; backfills known opening and legacy resolution events; seeds the SLA setting.

Indexes added:

- `orders(status, payment_status, created_at)`
- `order_items(seller_id, order_id)`
- `disputes(created_at)`
- `disputes(seller_id, created_at)`
- Dispute event/attachment lookup indexes and one ruling per dispute.

`scripts/migrate.js` sorts the numbered SQL filenames lexicographically, runs unapplied files with MySQL multiple statements enabled, then inserts the filename into `schema_migrations`. Existing migrations use InnoDB, utf8mb4 and incremental ALTER/CREATE statements. The runner was not changed. MySQL DDL auto-commits; the migration files do not provide an all-or-nothing DDL transaction.

All existing migrations plus 040 ran successfully against a fresh disposable MySQL 8.4 database. No application/production database migration was run.

## Actual schema

The following column names and enum types were read from `information_schema.COLUMNS` in the isolated MySQL database after applying the repository migrations through 040. The order, payment, product, category and seller enums were not changed by 040. The four newly added dispute columns are `description`, `buyer_evidence_summary`, `seller_evidence_summary`, `closed_at`; the earlier dispute enum is documented above.

### `categories`

Columns: `id`, `name`, `slug`, `parent_id`, `status`, `created_at`, `updated_at`.

- `status`: `enum('active','archived')`.

### `disputes`

Columns: `id`, `order_id`, `seller_id`, `raised_by`, `reason`, `status`, `resolution_note`, `refund_reference`, `refund_amount_kobo`, `resolved_by`, `resolved_at`, `created_at`, `updated_at`, `description`, `buyer_evidence_summary`, `seller_evidence_summary`, `closed_at`.

- `raised_by`: `enum('buyer','seller')`.
- `status`: `enum('open','resolved','rejected','in_review','escalated','closed')`.

### `order_items`

Columns: `id`, `order_id`, `product_id`, `seller_id`, `quantity`, `unit_price_kobo`, `line_total_kobo`, `delivery_fee_kobo`, `item_status`, `created_at`, `updated_at`.

- `item_status`: `enum('pending','ready_for_pickup','picked_up','delivered','cancelled')`.

### `orders`

Columns: `id`, `buyer_id`, `status`, `payment_method`, `subtotal_kobo`, `delivery_fee_kobo`, `total_kobo`, `delivery_address_id`, `delivery_label`, `delivery_street`, `delivery_city`, `delivery_state`, `delivery_phone`, `payment_reference`, `payment_status`, `created_at`, `updated_at`.

- `status`: `enum('pending_payment','confirmed','picked_up','in_transit','delivered','cancelled','disputed')`.
- `payment_method`: `enum('paystack','bank_transfer','ussd')`.
- `payment_status`: `enum('pending','paid','failed','cancelled','expired','flagged')`.

### `payments`

Columns: `id`, `order_id`, `provider`, `reference`, `amount_kobo`, `status`, `raw_response`, `created_at`, `updated_at`.

- `status`: `enum('pending','paid','failed','cancelled','expired','flagged')`.

### `products`

Columns: `id`, `seller_id`, `title`, `description`, `category_id`, `part_number`, `condition`, `price_kobo`, `stock_qty`, `location`, `status`, `created_at`, `updated_at`.

- `condition`: `enum('new','used','OEM')`.
- `status`: `enum('active','inactive')`.

### `seller_profiles`

Columns: `id`, `user_id`, `business_name`, `rating`, `contact_phone`, `contact_email`, `address`, `cac_number`, `verification_status`, `rejection_reason`, `cac_verification_status`, `cac_verification_response`, `cac_verification_checked_at`, `verified_by`, `verified_at`, `created_at`, `updated_at`.

- `verification_status`: `enum('pending','verified','rejected')`.

New table enums: `dispute_events.event_type = opened, info_requested, escalated, ruled, closed`; `dispute_rulings.decision = refund_buyer_full, refund_seller, partial_refund, no_action`; `dispute_attachments.submitted_by = buyer, seller`.

## Verification

- `npm test`: 39 unit suites / 251 unit tests and 90 integration tests passed.
- `npm run test:mysql`: 16 MySQL API/repository acceptance tests passed.
- `npm run lint`: passed.
- `git diff --check`: passed.
- Fresh-database `npm run migrate`: all migrations through 040 passed.

The MySQL suite exercises every requested endpoint, all four periods, empty buckets, Lagos midnight and a changed SQL session timezone, summary/series reconciliation, average rounding, category percentages, seller totals, CSV sections/headers, one-query list pagination (including empty pages), first-seller consistency, admin auth/permissions, invalid query/body validation, 409 transitions, 422 partial refunds, audit/timeline actors, concurrent rulings and rollback on audit failure.

The 15 previous integration failures came from photo fixtures containing text bytes. Those fixtures now use a valid PNG. The 13 lint errors were unused test imports, now removed. No buyer-facing or seller-facing endpoint code was changed; no dependencies were added.

To reproduce with Docker Desktop running:

```sh
docker compose -f tests/mysql/compose.yaml up -d --wait
env NODE_ENV=test DB_HOST=127.0.0.1 DB_PORT=33316 DB_USER=root DB_PASSWORD= DB_NAME=autoparts_admin_test npm run migrate
npm run test:mysql
npm test
npm run lint
docker compose -f tests/mysql/compose.yaml down
```

The MySQL test fixture repository intentionally targets only the disposable `autoparts_admin_test` database on port 33316. The container uses tmpfs storage.

## Files created or changed

This inventory includes the implementation already present when the confirmation was received, and the completion changes made afterward.

| File | Change |
| --- | --- |
| `package.json` | Added MySQL test script; no dependency changes |
| `src/app.js` | Wire analytics and dispute services |
| `src/config/constants.js` | Extended dispute status constants |
| `src/controllers/admin.controller.js` | New delegating handlers |
| `src/routes/admin.routes.js` | Authenticated, permission-checked, validated routes |
| `src/repositories/audit-log.repository.js` | Transaction executor support |
| `src/repositories/disputes.repository.js` | Filters, details, evidence, timeline, locking and workflow writes |
| `src/repositories/orders.repository.js` | One-query seller context and admin detail queries |
| `src/services/admin.service.js` | Admin list/detail mapping and dispute list additions |
| `src/validators/admin.validator.js` | Extended dispute list validation |
| `src/db/migrations/040_add_admin_platform_analytics_and_dispute_workflow.sql` | New migration |
| `src/repositories/admin-analytics.repository.js` | New SQL analytics repository |
| `src/services/admin-analytics.service.js` | New analytics mapping and CSV export |
| `src/services/admin-disputes.service.js` | New dispute service and transitions |
| `src/utils/admin-reporting.js` | New Lagos date windows, JSON/timestamp mapping and SLA helpers |
| `src/validators/admin-platform.validator.js` | New endpoint query/body/parameter validation |
| `tests/mysql/admin-platform.mysql.test.js` | New MySQL acceptance suite |
| `tests/mysql/fixtures.repository.js` | New SQL fixture repository |
| `tests/mysql/compose.yaml` | New isolated MySQL test service |
| `tests/integration/support/image-fixtures.js` | New valid PNG fixture |
| `tests/integration/admin.integration.test.js` | Corrected photo fixtures |
| `tests/integration/logistics.integration.test.js` | Corrected photo fixture |
| `tests/integration/seller-dashboard.integration.test.js` | Corrected photo fixture |
| `tests/integration/seller-finance.integration.test.js` | Corrected photo fixture |
| `tests/integration/seller-inventory.integration.test.js` | Corrected photo fixture |
| `tests/integration/seller-orders.integration.test.js` | Corrected photo fixture |
| `tests/unit/services/admin.service.test.js` | Updated expectations for added seller/filter fields |
| `tests/unit/validators/admin.validator.test.js` | Removed unused imports |
| `docs/admin-platform-api.md` | This schema, behavior, validation and handoff report |

`AGENTS.md` was already modified in the workspace; its existing user-authored changes were preserved. The implementation is uncommitted. Deployment and the application database migration remain operational steps outside the isolated verification performed here.

