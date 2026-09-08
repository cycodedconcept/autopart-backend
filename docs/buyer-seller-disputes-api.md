# Buyer and seller disputes

Disputes can now be opened by the buyer of a delivered order and answered by the targeted seller. Buyer replies require an outstanding admin information request addressed to the buyer or both parties. All new writes use transactions; every successful opening or response records an event.

## Endpoints

All paths below start with `/api/v1`. Send `Authorization: Bearer <token>`.

| Method | Path | Actor | Purpose |
| --- | --- | --- | --- |
| POST | `/orders/:orderId/disputes` | Buyer | Open a dispute; returns 201 |
| GET | `/orders/:orderId/disputes` | Owning buyer | Paginated disputes for the order |
| GET | `/disputes` | Buyer | Paginated own disputes |
| GET | `/disputes/:id` | Owning buyer | Detail, own evidence, public timeline and ruling |
| POST | `/disputes/:id/respond` | Owning buyer | Answer an outstanding information request |
| GET | `/seller/disputes` | Seller | Paginated disputes targeting this seller |
| GET | `/seller/disputes/:id` | Targeted seller | Detail, buyer evidence and own seller evidence |
| POST | `/seller/disputes/:id/respond` | Targeted seller | Respond while open or in review |
| GET | `/dispute-evidence/:filename` | Authorized buyer, seller or admin | Authenticated image bytes |

The existing admin dispute routes retain their handlers, response contracts, transitions, audit logging and payment behaviour. Only notification TODO comments were added to the admin service.

## Opening a dispute

Use multipart/form-data:

- `reason`: `item_not_as_described`, `item_not_received`, `damaged_on_arrival`, `wrong_item_sent`, `counterfeit_suspected`, or `other`.
- `description`: trimmed text, 20–2000 characters.
- `sellerId`: required for an order containing multiple sellers; optional for a single-seller order. It must match a seller on the order.
- `evidence`: zero to five image files, each at most 5 × 1024 × 1024 bytes. Repeat the field name for multiple files.

Only `orders.status = 'delivered'` permits creation. `item_not_received` applies when delivery was recorded but the buyer disputes receiving the item. Creation does not change order or payment status.

Delivery time is the earliest `order_status_history.created_at` entry with `status = 'delivered'`. A missing or future timestamp returns 409. Updating the order later cannot restart the window. Eligibility lasts through the exact delivery timestamp plus N × 24 hours, inclusive.

N comes from `platform_config`, row `key = 'platform_settings'`, property `disputeWindowDays`. Missing or invalid values fall back to `DISPUTE_WINDOW_DAYS`, then 7. Supported values are positive integers up to 36500. The existing admin config endpoint accepts, for example, `{ "platformSettings": { "disputeWindowDays": 7, "disputeReviewSlaHours": 24 } }`; preserve other settings when updating that object.

`open`, `in_review` and `escalated` disputes prevent another opening for the same order, including against another seller on that order. The 409 message identifies the active dispute ID. A terminal `resolved`, `rejected` or `closed` dispute does not prevent a new dispute within the original delivery window.

The order row is locked before checking active disputes and inserting the dispute, attachments and opening event. Concurrent opening attempts therefore produce one success. Failed transactions remove newly uploaded files through route-local cleanup.

SLA uses the existing `disputeSlaHours` and `disputeSla` helpers: creation time plus `disputeReviewSlaHours`, default 24 hours. The deadline is calculated, as on the admin side; it is not persisted or frozen when settings change.

## Responses and information requests

Seller response: multipart `message` (20–2000 characters) and optional repeated `evidence` files. Message-only JSON is also accepted.

Buyer response: message-only JSON `{ "message": "..." }` (an empty `attachments` array is allowed), or multipart `message` with optional repeated `attachments` files. Arbitrary attachment URLs, IDs and disk paths are not accepted in JSON. Image constraints match opening evidence.

Buyer responses are permitted only in `in_review`, against the latest `info_requested` event targeted to `buyer` or `both`. Each request can receive one buyer response. A seller response does not consume the buyer's request when both were requested.

Seller responses are permitted in `open` or `in_review`. If an information request exists, its recipient must be `seller` or `both`. Further seller evidence can be supplied while these conditions hold. Other statuses reject responses. A legacy `in_review` dispute without an information-request event permits seller submissions but has no outstanding request a buyer can answer.

Responses keep the dispute status and update the corresponding evidence summary. Events use `buyer_responded` or `seller_responded`; JSON details contain `message`, `attachmentIds` and `requestEventId` (null for unsolicited seller responses). Dispute locking serializes responses with the existing admin workflow. The existing admin rule permitting request-info only from `open` is unchanged.

## Responses, filters and privacy

Success envelope: `{ "success": true, "data": ..., "message": "..." }`.

Error envelope: `{ "success": false, "error": { "code": "...", "message": "..." } }`.

Detail/create/respond data: `{ dispute, evidence, sla, timeline, ruling }`. The buyer's `evidence` contains only `buyer`; the seller receives both `buyer` and `seller`. Ruling fields are `id`, `decision`, `partialAmountKobo`, `requireReverseLogistics` and `createdAt`. Monetary amounts remain integer kobo.

List data: `{ disputes, pagination: { page, limit, total, totalPages }, filters }`. Filters are `status`, `dateFrom`, `dateTo`, `page` and `limit`. Status accepts the six existing statuses or `all`. Page defaults to 1; limit defaults to 10 and is capped at 50. Empty results have zero total pages. Dates are valid `YYYY-MM-DD`, inclusive Africa/Lagos calendar dates. List count and page queries are fixed in number; sellers are not fetched per result.

Neither party receives admin ruling notes, resolution notes, internal escalation/closure reasons, or unfiltered event detail. Buyer timelines show that a seller responded but omit the seller's message and attachment references. Information-request messages are visible only to their requested recipients. Seller detail access requires both the targeted seller ID and membership on the order.

Ownership violations return 403/`FORBIDDEN`; missing resources return 404/`NOT_FOUND`; invalid input returns 422/`VALIDATION_ERROR`; state, window and duplicate conflicts return 409/`CONFLICT`.

## Protected evidence and Apache deployment

Images are written beneath `UPLOAD_DIR/disputes` using 32-character random hexadecimal filenames and MIME-derived extensions. MIME allowlisting, magic-byte validation and EXIF stripping reuse existing image utilities. Product thumbnail generation is not used for private evidence.

`dispute_attachments.file_path` holds the relative disk path, for example `disputes/<random>.png`. `url` holds `/api/v1/dispute-evidence/<random>.png`, keeping the existing admin attachment URL field usable. Buyer/seller serializers prepend `BASE_URL`. File paths and client-provided filenames are not returned as filesystem locations.

The image endpoint checks the current authenticated account on each request. A buyer can fetch only buyer evidence on their own order's dispute. The targeted seller can fetch buyer and seller evidence. Admins require `disputes.resolve`. Responses set `Cache-Control: private, no-store` and `X-Content-Type-Options: nosniff`. Frontends must fetch with a Bearer token and display the resulting blob; an unauthenticated image URL cannot retrieve evidence.

Express blocks `/uploads/disputes`, including normalized encoded/dot-path variants, before public static serving. Public product images keep their existing URLs and caching.

Startup writes this file at `UPLOAD_DIR/disputes/.htaccess`:

```apache
Require all denied
```

**Apache must honor this rule before accepting production evidence.** The cPanel deployment must allow `AuthConfig` overrides for this directory, or enforce an equivalent virtual-host rule using the actual absolute upload path:

```apache
<Directory "/absolute/path/to/public_html/uploads/disputes">
    Require all denied
</Directory>
```

Keep `/api/v1/dispute-evidence/*` proxied to Node. Apache only denies direct disk-file serving; authorized Node reads still work. Confirm a known file at `/uploads/disputes/<filename>` returns 403 or 404 without credentials, and its API URL returns 401 unauthenticated and image bytes only to permitted actors. Express protection cannot prevent Apache from serving files directly when Apache ignores access rules. The deployed cPanel configuration was not changed or verified by this implementation.

Historical external attachment URLs are not fetched or migrated automatically. Their metadata remains visible to the permitted party with `url: null`; existing admin responses retain the original URLs. Legacy disputes with a null seller are seller-accessible only when exactly one seller can be identified on the order. Ambiguous legacy disputes remain accessible to their buyer/admin until seller attribution is resolved.

## Migration and notification hooks

Migration: `src/db/migrations/041_add_buyer_seller_dispute_flow.sql`.

It appends the two response event types, adds nullable `dispute_attachments.file_path`, and adds a unique index for managed private paths. Existing statuses, event values and attachment rows are preserved. No refund or payment integration was added.

The five notification hooks are TODO comments only:

1. Dispute opened → selected seller and admin, after commit.
2. Seller responds → buyer and admin, after commit.
3. Admin requests information → requested party or both, after commit.
4. Dispute escalated → both parties, after commit.
5. Ruling issued → both parties, after commit.

## Verification

Verified locally on Node 22.15.0 and disposable MySQL 8.4:

- `npm run lint`: passed.
- `npm test`: 257 unit tests and 90 integration tests passed.
- `npm run test:mysql`: 48 passed (16 existing admin tests and 32 buyer/seller dispute tests).
- `npm run migrate`: the complete migration chain through 041 passed on two fresh databases.
- Installed Apache 2.4 with `AllowOverride AuthConfig`: the generated `.htaccess` returned 403 for direct and encoded dispute-file requests, while a public product file returned 200. The temporary server was stopped and its files removed after verification.

The unit suite includes party-field allowlisting and outstanding-request ownership. The new MySQL suite uses real JWT authentication, multipart HTTP requests and repositories, testing opening/response races, rollback and file cleanup, time-window boundaries/configuration, Lagos dates, seller scoping, evidence access, and compatibility with admin requests, escalation, ruling and closure.

Both MySQL suites use disposable local databases on port 33316, with no application credentials. Start the existing compose service, create `autoparts_disputes_test`, then apply all migrations to both `autoparts_admin_test` and `autoparts_disputes_test` with explicit test configuration:

```sh
docker compose -f tests/mysql/compose.yaml up -d
docker compose -f tests/mysql/compose.yaml exec -T mysql mysql -uroot -e 'CREATE DATABASE IF NOT EXISTS autoparts_disputes_test'
DB_HOST=127.0.0.1 DB_PORT=33316 DB_USER=root DB_PASSWORD='' DB_NAME=autoparts_admin_test NODE_OPTIONS='--require ./tests/setup/env.js' npm run migrate
DB_HOST=127.0.0.1 DB_PORT=33316 DB_USER=root DB_PASSWORD='' DB_NAME=autoparts_disputes_test NODE_OPTIONS='--require ./tests/setup/env.js' npm run migrate
npm run lint
npm test
npm run test:mysql
```

## File inventory

Created:

- `src/db/migrations/041_add_buyer_seller_dispute_flow.sql`
- `src/repositories/party-disputes.repository.js`
- `src/services/disputes.service.js`
- `src/controllers/disputes.controller.js`
- `src/controllers/dispute-evidence.controller.js`
- `src/routes/order-disputes.routes.js`
- `src/routes/disputes.routes.js`
- `src/routes/seller-disputes.routes.js`
- `src/routes/dispute-evidence.routes.js`
- `src/validators/disputes.validator.js`
- `src/middleware/dispute-upload.middleware.js`
- `src/middleware/dispute-evidence-auth.middleware.js`
- `src/utils/dispute-files.js`
- `tests/unit/services/disputes.service.test.js`
- `tests/mysql/buyer-seller-disputes.mysql.test.js`
- `tests/mysql/disputes-fixtures.repository.js`
- `docs/buyer-seller-disputes-api.md`

Changed:

- `.env.example`: window fallback example.
- `.gitignore`: exclude private dispute upload directories.
- `src/config/env.js`: validate `DISPUTE_WINDOW_DAYS`.
- `src/app.js`: dependency wiring, routes and private static-file guard.
- `src/services/admin-disputes.service.js`: three notification TODO comments only.

Runtime initialization also creates `UPLOAD_DIR/disputes/.htaccess`. Pre-existing changes to `AGENTS.md` and the admin-platform Postman files were not edited as part of this task.
