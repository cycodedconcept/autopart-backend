# AGENTS.md — AutoParts Marketplace (Backend)

This file tells Codex how to work in this repository. Read it fully before generating or changing code. Follow it for every task.

---

## 0. Current Status & Next Task  ← READ THIS FIRST

**Build order:** Buyer (done) -> Seller (done) -> Admin (done) -> **Logistics (current — FINAL MODULE)**.

**Completed**
- [x] Project skeleton (Section 3 layout)
- [x] **Buyer flow** — auth, catalogue browsing, cart & checkout, Paystack payment, order tracking & history
- [x] **Seller flow** — registration & CAC verification (Dojah), listing management, order management, inventory, sales & payouts
- [x] **Admin flow** — admin auth & RBAC, seller verification, category management, user/order oversight, payout approval, disputes & audit log
- [x] **Logistics Milestone L-A** — `logistics_companies`, `riders`, and `delivery_zones`; company and rider JWT auth; company-owned rider management; admin logistics approval and rider oversight
- [x] **Logistics Milestone L-B** — delivery jobs now move through `pending -> assigned`; nearest-available rider auto-assignment uses zone matching; admins can review pending jobs and manually assign a rider; delivered-only seller payout eligibility remains enforced
- [x] **Logistics Milestone L-C** — rider-owned job access stays aligned with `assigned`; riders can move `assigned -> picked_up -> in_transit -> delivered` or `failed` with a reason; order history, payout eligibility, and rider availability now stay in sync with delivery completion or failure
- [x] **Logistics Milestone L-D** — delivery fees now use the shared distance/zone-and-weight calculator; completed jobs record platform margin plus company share; logistics companies can review earnings and request payouts through the shared payouts flow
- [x] **Logistics Milestone L-E** — company job views now expose dashboard status totals plus rider performance summaries; admin logistics oversight now includes cross-company company/rider summary counts, the unassigned-job queue, manual assignment controls, and delivery metrics

**NEXT TASK → Full-project cleanup, final regression pass, and handoff.**
Build, in this order:
1. Sweep the codebase for remaining cleanup after the final logistics module.
2. Run the final regression pass across buyer, seller, admin, and logistics flows.
3. Prepare the final handoff notes.

Follow the build recipe in Section 13 for any remaining code changes, then confirm tests pass. **Stop here so I can run migrations and review the completed L-E milestone.**

**After this review:** full-project cleanup, final regression pass, and handoff.

**This module resolves the remaining logistics gaps.** As you build, replace every `// LOGISTICS-STUB` marker and re-run the affected buyer/seller/admin tests:
- Delivery pricing and logistics-company earnings now run through the shared settlement flow from L-D.
- Company dashboard breadth and broader delivery oversight are completed in L-E.

---

## 1. Project Summary

AutoParts Marketplace is a Nigerian B2B & B2C ecommerce platform for auto spare parts. It connects buyers (car owners, mechanics, fleet operators) with sellers (dealers, distributors, vendors), with an integrated logistics layer.

This repository is the **backend API only** (no frontend). It is consumed by a responsive web client.

Logistics is the final module. After it, every `// SELLER-STUB`, `// ADMIN-STUB`, and `// LOGISTICS-STUB` in the codebase must be gone.

---

## 2. Tech Stack (do not substitute without being asked)

- **Runtime:** Node.js (LTS, v20+)
- **Language:** JavaScript (CommonJS `require`, not ESM) unless told otherwise
- **Framework:** Express.js
- **Database:** MySQL 8 via the `mysql2` driver (promise API + connection pool). Local dev runs on **XAMPP** (user `root`, empty password, port 3306).
- **Query layer:** `mysql2` with **parameterised queries**, or Knex query builder if a builder is needed. Do NOT introduce a heavy ORM (no Sequelize/TypeORM) unless explicitly requested.
- **Auth:** JWT (`jsonwebtoken`); password hashing with `bcrypt`
- **Validation:** `joi` (stay consistent)
- **File upload:** `multer` (CAC docs, product images, rider documents). Local `/uploads` in dev; storage swappable for S3.
- **External verification:** Dojah CAC lookup behind the swappable `cacVerificationService`.
- **Config:** `dotenv`
- **Testing:** `jest` (unit) and `mocha` + `chai` + `supertest` (integration)
- **Logging:** `morgan` for HTTP; a small app logger wrapper otherwise
- **Currency:** NGN. Store money as **integers in kobo** (1 NGN = 100 kobo). Never store money as a float.
- **No GPS/live tracking this phase.** Status updates only. Do not add map/geolocation SDKs.

---

## 3. Project Structure

```
/src
  /config        -> db connection pool, env loading, constants
  /routes        -> Express routers, one file per resource
  /controllers   -> request handlers; thin, call services
  /services      -> business logic; no req/res here
  /repositories  -> all SQL lives here (parameterised queries only)
  /middleware    -> auth, role guard, RBAC/permission guard, validation, error handler, rate limiter, upload
  /validators    -> joi schemas per resource
  /utils         -> helpers (jwt, password, money, responses, pagination, audit, distance)
  /db
    /migrations  -> ordered SQL migrations (001_xxx.sql, 002_xxx.sql)
    /seeds       -> seed data for local dev/testing
  app.js         -> express app (no listen)
  server.js      -> starts the server (listen)
/uploads         -> dev file storage (gitignored)
/tests
  /unit
  /integration
.env.example
AGENTS.md
package.json
README.md
```

**Layering rule (strict):** routes -> controllers -> services -> repositories. Controllers never write SQL. Services never touch `req`/`res`. All SQL lives in repositories and uses parameterised queries.

---

## 4. Coding Standards

- Clean, efficient, readable code. Small single-purpose functions, clear names, no dead code.
- **Reusable components:** factor shared logic into `/utils`, `/middleware`, `/services`. No copy-paste across controllers. Centralise: the response envelope, JWT sign/verify, password hashing, money conversion (naira<->kobo), pagination, file upload, the audit-log writer, and the delivery-fee calculator.
- ONE consistent response envelope:
  ```json
  { "success": true, "data": { }, "message": "..." }
  { "success": false, "error": { "code": "STRING_CODE", "message": "..." } }
  ```
- `async/await` everywhere; wrap async handlers so errors reach the central error middleware (`asyncHandler`).
- One central error-handling middleware. Controllers throw typed errors; middleware maps them to status + envelope. Never leak stack traces, SQL, or third-party errors to the client.
- Validate every body, query, and param with a joi schema before the controller runs.
- No secrets in code — everything sensitive from `.env`. Keep `.env.example` in sync (no real values).
- Parameterised queries for ALL database access. String-concatenated SQL is forbidden.
- Comments explain *why*, not *what*.

---

## 5. Database Conventions

- MySQL 8, InnoDB, `utf8mb4`.
- Table names: plural snake_case (`riders`, `delivery_jobs`).
- Primary keys: `id` BIGINT UNSIGNED AUTO_INCREMENT.
- Every table has `created_at` and `updated_at` (TIMESTAMP, default CURRENT_TIMESTAMP).
- Money columns: BIGINT (kobo), clearly named (`delivery_fee_kobo`).
- Foreign keys explicit, with sensible `ON DELETE`.
- All schema changes via ordered SQL migrations in `/src/db/migrations`. Never edit an applied migration — add a new one.

---

## 6. Buyer, Seller & Admin Flows  [ALL DONE]

- **Buyer** (PRD 4.1 / 5.1): auth, catalogue, cart & checkout, Paystack payment, order tracking & history.
- **Seller** (PRD 4.2 / 5.2): registration & CAC verification, listings, order management, inventory, sales & payouts.
- **Admin** (PRD 4.4 / 4.5): admin auth & RBAC, seller verification, categories, user/order oversight, payout approval, disputes & audit log.

These flows now depend on the logistics company and rider module for delivered-order progression and seller payout eligibility. Keep all existing endpoints working and their tests green as Section 6D expands the assignment, pricing, and settlement logic.

---

## 6D. Logistics Flow Milestones (build in this order, P0 first)

Ground every endpoint in PRD section 4.3 (Logistics Features) and the buyer/seller fulfilment flows.

**Scope decisions (locked — do not deviate):**
- **Two actors:** logistics **companies** (manage a fleet) and **riders** (perform deliveries). A rider belongs to one company.
- **Assignment:** auto-assign to the nearest available rider, with an **admin manual-assignment fallback** when auto-assign finds no one.
- **No live GPS tracking.** Status updates only: `pending -> assigned -> picked_up -> in_transit -> delivered` (plus `failed`, `cancelled`).

### Milestone L-A — Logistics companies & riders  [DONE]
- `logistics_companies`: registration, login (JWT), company profile. Admin approves/suspends a company (reuse the existing admin permission guard).
- `riders`: a company onboards/lists/activates/deactivates its OWN riders. Enforce ownership.
- Rider login (JWT), `GET /rider/me`, and an availability toggle (`available` / `unavailable` / `on_delivery`).
- `delivery_zones`: simple zone records (name, state/city) used later for fee and matching.

### Milestone L-B — Delivery jobs & auto-assignment  [DONE]
- When a seller marks an order item `ready_for_pickup`, the existing delivery job should enter the explicit assignment lifecycle `pending -> assigned` instead of waiting for a rider to claim it.
- **Auto-assignment service:** find the nearest **available** rider (match on zone/location; use a simple distance util — no map SDK). Assign the job, set rider to `on_delivery`, job to `assigned`.
- **Manual fallback:** if no rider is found, leave the job `pending` and expose it in an admin queue for manual assignment. Admin assignment writes an `audit_logs` row.
- Keep the matching logic in one `assignmentService` so it can be swapped later.

### Milestone L-C — Rider delivery flow & status updates  [DONE]
- Rider endpoints: keep view-assigned-jobs and job detail in sync with the new `assigned` state, and extend the status path to `assigned -> picked_up -> in_transit -> delivered` (plus `failed` with a reason).
- Every status change continues to write to `order_status_history` and update the parent order; L-C tightens this around assigned jobs and failure handling.
- On `delivered`, free the rider (`available`) and mark the job complete. Delivery confirmation is what releases the seller's payout eligibility.
- On `failed`, require a failure reason, free the rider back to `available`, return the item to `ready_for_pickup`, and allow admin review for reassignment.

### Milestone L-D — Delivery fees & settlement
- **Delivery fee calculator** (a reusable util): compute `delivery_fee_kobo` from distance/zone and weight, per the PRD formula. REPLACES the placeholder fee used at checkout.
- Record the platform's logistics margin and the company's share on each completed job.
- Company earnings summary + payout request (reuse the existing `payouts` pattern; admin approves).

### Milestone L-E — Company dashboard & admin oversight
- Company: list its jobs (by status), rider performance summary, earnings.
- Admin: list all logistics companies and riders, approve/suspend, view the unassigned-job queue, manually assign, and see delivery metrics.

**Definition of done for the whole project:** no `// SELLER-STUB`, `// ADMIN-STUB`, or `// LOGISTICS-STUB` remains; a full order can flow buyer -> seller -> rider -> `delivered`; all tests pass.

---

## 7. Data Model

Money in kobo. Buyer, seller, and admin tables already exist. Logistics adds the following.

**Existing:** `users`, `buyer_addresses`, `categories`, `vehicles_taxonomy`, `products`, `product_images`, `product_compatibility`, `carts`, `cart_items`, `orders`, `order_items`, `payments`, `order_status_history`, `seller_profiles`, `seller_documents`, `payouts`, `admins`, `roles`, `permissions`, `role_permissions`, `admin_roles`, `audit_logs`, `platform_config`, `disputes`.

**Logistics additions:**
- `logistics_companies` — id, name, email (unique), phone, password_hash, address, status (`pending`/`approved`/`suspended`), approved_by (admin FK), timestamps
- `riders` — id, company_id (FK), full_name, phone (unique), email, password_hash, vehicle_type, zone_id (FK), status (`available`/`on_delivery`/`unavailable`/`inactive`), timestamps
- `delivery_zones` — id, name, state, city, timestamps
- `delivery_jobs` — id, order_id (FK), order_item_id (FK, nullable), seller_id (FK), buyer_id (FK), rider_id (FK, nullable), company_id (FK, nullable), pickup_address, dropoff_address, zone_id (FK), status (`pending`/`assigned`/`picked_up`/`in_transit`/`delivered`/`failed`/`cancelled`), failure_reason, delivery_fee_kobo, assigned_at, delivered_at, assigned_by (`auto`/admin FK), timestamps
- `delivery_status_history` — id, delivery_job_id (FK), status, note, actor_type (`rider`/`admin`/`system`), actor_id, created_at
- Extend `orders`: ensure `delivery_fee_kobo` is populated by the real calculator (L-D).
- Extend `payouts`: allow `payee_type` (`seller`/`logistics_company`) so companies reuse the payout flow.

---

## 8. API Conventions

- Base path: `/api/v1`.
- Existing: `auth/*`, `me`, `products*`, `cart/*`, `orders*`, `payments/*`, `seller/*`, `admin/*`.
- Logistics routes (this phase):
  - Company (auth + `logistics_company` role): `POST /logistics/register` . `POST /logistics/login` . `GET /logistics/me`
    . `POST/GET/PATCH /logistics/riders` (+ `/riders/:id`) . `GET /logistics/jobs` . `GET /logistics/earnings` . `POST /logistics/payouts`
  - Rider (auth + `rider` role): `POST /rider/login` . `GET /rider/me` . `PATCH /rider/availability`
    . `GET /rider/jobs` . `GET /rider/jobs/:id` . `PATCH /rider/jobs/:id/status`
  - Admin (existing permission guard): `GET /admin/logistics/companies` . `PATCH /admin/logistics/companies/:id/status`
    . `GET /admin/logistics/riders` . `GET /admin/delivery-jobs?status=pending` . `PATCH /admin/delivery-jobs/:id/assign`
- Protected routes require `Authorization: Bearer <token>`; role-restricted routes pass the role guard; admin routes pass the permission guard.
- Correct HTTP status codes. Use 403 for wrong role / missing permission, 409 for an invalid status transition.
- Paginate all list endpoints.

---

## 9. Testing (required)

- **jest** unit tests: the assignment service (nearest-available-rider logic, and the no-rider-found fallback path), the delivery-fee calculator, and status-transition validation. Mock the repository layer.
- **mocha + chai + supertest** integration tests: the **full end-to-end path** — buyer orders & pays -> seller marks ready -> job auto-created & assigned -> rider picks up -> in transit -> delivered -> order shows `delivered`.
- Add negative tests: an invalid status transition returns 409; a rider cannot touch another rider's job; a company cannot manage another company's riders.
- Every new service function gets a unit test; every new endpoint gets at least one integration test.
- No external network calls in tests — mock Paystack, Dojah, and file storage.
- A feature is not "done" until its tests pass, INCLUDING the existing buyer/seller/admin tests affected when a `// LOGISTICS-STUB` is replaced.

---

## 10. Commands

```
npm run dev               # nodemon
npm start                 # start server
npm run migrate           # run pending SQL migrations
npm run seed              # seed dev data (incl. zones, a test company + riders)
npm test                  # all tests
npm run test:unit         # jest
npm run test:integration  # mocha
npm run lint              # eslint
```

---

## 11. Environment Variables (keep .env.example in sync)

```
NODE_ENV=development
PORT=4000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=autoparts
JWT_SECRET=
JWT_EXPIRES_IN=1d
BCRYPT_SALT_ROUNDS=10
PAYSTACK_SECRET_KEY=
PAYSTACK_PUBLIC_KEY=
UPLOAD_DIR=./uploads
DOJAH_BASE_URL=https://api.dojah.io
DOJAH_APP_ID=
DOJAH_API_KEY=
SUPER_ADMIN_EMAIL=
SUPER_ADMIN_PASSWORD=
DELIVERY_BASE_FEE_KOBO=100000      # base fee before distance/weight
DELIVERY_PER_KM_KOBO=5000          # per-km component
LOGISTICS_PLATFORM_MARGIN_PCT=10   # platform's cut of the delivery fee
```

(XAMPP default MySQL: user `root`, empty password, port 3306 — adjust to 3307 if XAMPP reports that.)

---

## 12. Security & Non-Functional Rules (PRD section 6)

- HTTPS only in production; JWT on all protected routes; role guard on company/rider routes; permission guard on admin routes.
- **Enforce ownership everywhere:** a rider only sees/updates their OWN assigned jobs; a company only manages its OWN riders and jobs.
- **Validate status transitions** — never allow an illegal jump (e.g. `pending -> delivered`). Return 409 on an invalid transition.
- **Audit sensitive logistics actions:** company approval/suspension, manual job assignment, and payout decisions all write `audit_logs` rows.
- **No card data stored** — Paystack handles payments.
- Hash all passwords (riders and companies included) with bcrypt; never log passwords or tokens.
- Rate-limit all login endpoints (rider and company login included).
- Validate and sanitise all input; validate uploaded rider documents (type, size).
- Currency NGN; money in kobo (integers).
- Index columns used in assignment and lookup (rider status, zone_id, delivery_job status, order_id).
- Keep services stateless; use a DB connection pool.

---

## 13. How Codex Should Work Here

- Before building, restate the task and which milestone (Section 0 / 6D) it belongs to.
- Build one milestone at a time, in order.
- Build recipe per unit of work: migration (if needed) -> repository -> service -> validator -> controller -> route -> tests. Then confirm tests pass.
- Reuse existing utils/middleware before writing new ones (auth, response envelope, pagination, upload, audit writer, payout pattern, permission guard).
- When replacing a `// LOGISTICS-STUB`, update the dependent buyer/seller/admin code and re-run their tests to confirm nothing broke.
- Keep the assignment logic isolated in `assignmentService` — it is the piece most likely to change later.
- After each milestone: update the README with new endpoints, run ALL tests, and update Section 0 (move the item to Completed, set the next task). Then stop for review.
- If a requirement is ambiguous, make the smallest reasonable assumption, state it in your output, and continue — do not block.
- Never add a new dependency without noting why. Do NOT add map/geolocation SDKs — this phase is status-updates only.
