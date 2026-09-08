# AGENTS.md — AutoParts Backend

## Project

Node.js + Express backend (CommonJS) for the AutoParts marketplace. MySQL.

Architecture is **repository → service → controller → route**, wired through
`createDependencies()` in `src/app.js`. Joi validation throughout. JWT auth,
with separate middleware for buyer, seller, admin, logistics and rider actors.
Migrations run through `scripts/migrate.js`.

Deployed to cPanel behind an Apache proxy, running under PM2 as `autopart-api`
on port 3000. Node 20 via `/opt/cpanel/ea-nodejs20/bin`.

---

## Standing conventions

These apply to every task. Follow them without restating them back to me.

**Structure**
- No logic in controllers. No SQL outside repositories. Services hold the rules.
- One concern per file, matching the existing naming pattern
  (`x.repository.js`, `x.service.js`, `x.controller.js`, `x.routes.js`).
- Everything wires through `createDependencies()` — no direct imports across
  layers.

**Validation and responses**
- Joi validation for every query param, path param and request body.
- Match the existing success/error envelope and error codes exactly.
- Match the existing pagination convention.

**Data**
- All money is stored and returned in **kobo, as integers**. Never format
  currency server-side.
- Date bucketing and reporting use **Africa/Lagos**, not UTC.
- Aggregate in SQL. Do not pull rows into Node and reduce.
- No N+1 queries in list endpoints. Use JOINs.

**Migrations**
- New schema goes in a new migration following the existing pattern.
- Never alter or drop existing tables destructively.
- `npm run migrate` must run clean on a fresh database.

**Uploads**
- Reuse the existing multer disk-storage pattern: random-hex filenames, MIME
  validation, magic-byte check, size caps.
- Store paths relative to `UPLOAD_DIR`; apply `BASE_URL` when serialising.
- Never trust a client-supplied filename.

**Boundaries**
- No new dependencies without asking first.
- Do not modify endpoints outside the scope of the task you were given.
- Do not wire refunds or payment movement to Paystack unless explicitly told.

**Before you build**
For any non-trivial task: read the relevant files, report the ACTUAL column
names and enum values you found, state your plan, and wait for approval.
Do not invent schema or enum values.

**When you finish**
List every file created or changed, every new endpoint, any migration
filename, and anything you could not complete or had to assume.

---

## Already built — do not rebuild

**Admin disputes.** Tables `disputes`, `dispute_events`, `dispute_rulings`,
`dispute_attachments`. Admin endpoints for stats, list, detail, request-info,
escalate, ruling and close, with status-transition validation and audit
logging. Refunds are deliberately not wired — there is a marked TODO where
that would fire.

**Platform analytics.** `GET /api/v1/admin/analytics/platform` with summary,
GMV series, orders by week, category breakdown, revenue by category and top
sellers, plus CSV export.

**Seller context on admin orders**, including `GET /api/v1/admin/orders/:id`.

---

## CURRENT TASK — Buyer and seller dispute flow

The admin half of disputes exists. The front half does not: nothing can
currently **create** a dispute, and sellers cannot respond to one.

### Before changing anything

Read and report back on:
- `src/repositories/disputes.repository.js` — every existing method
- The `disputes`, `dispute_events` and `dispute_attachments` table definitions:
  actual column names, enum values and foreign keys
- `src/routes/orders.routes.js` and `src/routes/seller-orders.routes.js`
- `src/middleware/auth.middleware.js` — how buyer vs seller identity resolves
- The multer upload config used for product images

Then report: the exact dispute status enum, which order status values should
permit a dispute, and how `dispute_attachments` distinguishes buyer evidence
from seller evidence. Wait for my approval before building.

### Task 1 — Buyer raises a dispute

**`POST /api/v1/orders/:orderId/disputes`** — buyer only, must own the order.

Body (multipart/form-data):
- `reason` — enum: `item_not_as_described`, `item_not_received`,
  `damaged_on_arrival`, `wrong_item_sent`, `counterfeit_suspected`, `other`
- `description` — required, 20–2000 chars
- `evidence` — up to 5 images (jpeg, png, webp), 5MB each

Rules, enforced in the **service** layer:
- Order must belong to the authenticated buyer, else 403.
- Order must be in a disputable state (from your report), else 409.
- Only one open dispute per order — else 409, naming the existing dispute id.
- A dispute window applies: N days after delivery, read from `platform_config`
  if supported, otherwise env var `DISPUTE_WINDOW_DAYS` default 7. Outside the
  window → 409.
- On success: create the dispute, store buyer evidence, write an `opened` event
  to `dispute_events`, and set the SLA deadline using the same logic the admin
  side already uses.

Returns 201 with the created dispute.

**`GET /api/v1/orders/:orderId/disputes`** — buyer only, must own the order.

**`GET /api/v1/disputes`** — buyer only. Paginated list of their own disputes.
Filters: status, dateFrom, dateTo.

**`GET /api/v1/disputes/:id`** — buyer only, must own the dispute. Returns the
dispute, their own evidence, status, timeline, and the ruling once one exists.

> The buyer must **not** see the seller's evidence, admin ruling notes, or
> internal escalation reasons.

**`POST /api/v1/disputes/:id/respond`** — buyer only, must own the dispute.
Body: `{ message, attachments[] optional }`. Allowed **only** when status is
`in_review` and the outstanding request was addressed to the buyer or to both;
otherwise 409. Writes an event.

### Task 2 — Seller responds to a dispute

**`GET /api/v1/seller/disputes`** — seller only. Paginated list of disputes
raised against that seller's orders. Filters: status, dateFrom, dateTo.

**`GET /api/v1/seller/disputes/:id`** — seller only, must be the seller on the
disputed order. Returns the dispute, the buyer's evidence and description, the
seller's own submitted evidence, status and timeline.

> The seller must **not** see admin ruling notes or internal escalation reasons.

**`POST /api/v1/seller/disputes/:id/respond`** — seller only, must be the seller
on the order.

Body (multipart/form-data):
- `message` — required, 20–2000 chars
- `evidence` — up to 5 images, same constraints as the buyer

Rules:
- Allowed while `open` or `in_review`. Once `resolved` or `closed` → 409.
- Where the admin requested info, it must have been addressed to the seller or
  to both.
- Stores evidence tagged as seller evidence, and writes an event.

### Task 3 — Notification hooks

Do **not** build a notification system. Leave a clearly marked TODO at each
point below and report the list back:
- dispute opened → notify seller and admin
- seller responds → notify buyer and admin
- admin requests info → notify the requested party
- dispute escalated → notify both parties
- ruling issued → notify both parties

### Evidence upload and access control

Store dispute evidence under a dispute subfolder, **not** alongside product
images.

Attachments must be access-controlled — a buyer must not be able to fetch the
seller's evidence by guessing the URL. Report how static file serving currently
works and whether it can enforce that. **If it cannot, tell me rather than
working around it.**

### Task constraints

- Do not modify the existing admin dispute endpoints or their behaviour.
- Do not wire any refund or payment logic.

### Acceptance

- A buyer can raise a dispute on their own delivered order with evidence.
- A buyer cannot raise a dispute on someone else's order → 403.
- A second open dispute on the same order → 409.
- A dispute outside the window → 409.
- A seller can see and respond only to disputes on their own orders.
- Neither party can see admin ruling notes, nor the other side's evidence where
  the rules above forbid it.
- Every create and respond action writes to `dispute_events`.
- The admin endpoints continue to work unchanged against the new data.
- `npm run migrate` runs clean on a fresh database.