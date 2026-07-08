# AGENTS.md — AutoParts Marketplace (Backend)

This file tells Codex how to work in this repository. Read it fully before generating or changing code. Follow it for every task.

---

## 0. Current Status & Next Task  ← READ THIS FIRST

**Build order:** Buyer (done) -> Seller (done) -> **Admin (current)** -> Logistics.

**Completed**
- [x] Project skeleton (Section 3 layout)
- [x] **Buyer flow** — auth, catalogue browsing, cart & checkout, Paystack payment, order tracking & history
- [x] **Seller flow** — registration & CAC verification (Dojah), listing management, order management, inventory, sales & payouts
- [x] **Admin Milestone A-A** — dedicated admin auth, RBAC, seeded `super_admin`, scoped `verification_admin`, `GET /api/v1/admin/me`

**NEXT TASK → Admin Panel, Milestone A-B — Seller verification management (Section 6C).**
Build, in this order:
1. List pending sellers; view a seller's profile + uploaded CAC/documents + the stored Dojah response.
2. Approve or reject with a reason; on approve, set the seller `verified`.
3. Replace the `SELLER_AUTO_VERIFY` flag and the current seller-verification admin stub path.
4. Re-run the affected seller and admin tests.

Follow the build recipe in Section 13: migration -> repository -> service -> validator -> controller -> route -> tests, then confirm tests pass. **Stop after A-B so I can run migrations and review.**

**After this:** A-C (category & catalogue management) -> A-D (user & order oversight) -> A-E (payout approval + platform config) -> A-F (disputes + audit log). Then Logistics.

**This module resolves earlier stubs.** As you build, replace the matching markers and re-run the affected tests:
- `SELLER_AUTO_VERIFY` dev flag + `// ADMIN-STUB` on seller verification -> replaced in A-B.
- Seeded categories / `// ADMIN-STUB` on category ownership -> replaced in A-C.
- `// ADMIN-STUB` on payout approval and commission config -> replaced in A-E.

---

## 1. Project Summary

AutoParts Marketplace is a Nigerian B2B & B2C ecommerce platform for auto spare parts. It connects buyers (car owners, mechanics, fleet operators) with sellers (dealers, distributors, vendors), with an integrated logistics layer.

This repository is the **backend API only** (no frontend). It is consumed by a responsive web client.

Where a module you are not currently building is unavoidable, build only the minimum surface needed and mark it `// LOGISTICS-STUB`. Do not build the full Logistics module yet.

---

## 2. Tech Stack (do not substitute without being asked)

- **Runtime:** Node.js (LTS, v20+)
- **Language:** JavaScript (CommonJS `require`, not ESM) unless told otherwise
- **Framework:** Express.js
- **Database:** MySQL 8 via the `mysql2` driver (promise API + connection pool). Local dev runs on **XAMPP** (user `root`, empty password, port 3306).
- **Query layer:** `mysql2` with **parameterised queries**, or Knex query builder if a builder is needed. Do NOT introduce a heavy ORM (no Sequelize/TypeORM) unless explicitly requested.
- **Auth:** JWT (`jsonwebtoken`); password hashing with `bcrypt`
- **Validation:** `joi` (stay consistent)
- **File upload:** `multer` (CAC docs, product images). Local `/uploads` in dev; keep storage swappable for S3.
- **External verification:** Dojah CAC lookup (`https://api.dojah.io/api/v1/kyc/cac/basic`, headers `AppId` + `Authorization`) behind a swappable `cacVerificationService`.
- **Config:** `dotenv`
- **Testing:** `jest` (unit) and `mocha` + `chai` + `supertest` (integration)
- **Logging:** `morgan` for HTTP; a small app logger wrapper otherwise
- **Currency:** NGN. Store money as **integers in kobo** (1 NGN = 100 kobo). Never store money as a float.

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
  /utils         -> helpers (jwt, password, money, responses, pagination, audit)
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
- **Reusable components:** factor shared logic into `/utils`, `/middleware`, `/services`. No copy-paste across controllers. Centralise: the response envelope, JWT sign/verify, password hashing, money conversion (naira<->kobo), pagination, file upload, and the audit-log writer.
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
- Table names: plural snake_case (`admins`, `audit_logs`).
- Primary keys: `id` BIGINT UNSIGNED AUTO_INCREMENT.
- Every table has `created_at` and `updated_at` (TIMESTAMP, default CURRENT_TIMESTAMP).
- Money columns: BIGINT (kobo), clearly named (`price_kobo`, `total_kobo`).
- Foreign keys explicit, with sensible `ON DELETE`.
- All schema changes via ordered SQL migrations in `/src/db/migrations`. Never edit an applied migration — add a new one.

---

## 6. Buyer & Seller Flows  [ALL DONE]

- **Buyer** (PRD 4.1 / 5.1): auth, catalogue browsing, cart & checkout, Paystack payment, order tracking & history.
- **Seller** (PRD 4.2 / 5.2): registration & CAC verification, listing management, order management, inventory, sales & payouts.

These flows currently depend on stubbed admin behaviour (auto-verify flag, seeded categories, stubbed payout/commission approval). The Admin flow (Section 6C) replaces those stubs. Keep buyer and seller endpoints working and their tests green as you do so.

---

## 6C. Admin Flow Milestones (build in this order, P0 first)

Ground every endpoint in PRD section 4.4 (Admin Panel Features), 4.5 (Super Admin Features), and the RBAC note. Goal for this phase: **operational control of the platform that's already built.**

### Milestone A-A — Admin auth & RBAC  [NEXT]
- `admins` table, admin login (JWT), `GET /admin/me`.
- RBAC: `roles`, `permissions`, `role_permissions`, `admin_roles`; a permission-guard middleware.
- Seed a `super_admin` (all permissions) and a scoped role. Every admin route is permission-gated.

### Milestone A-B — Seller verification management
- List pending sellers; view a seller's profile + uploaded CAC/documents + the stored Dojah response.
- Approve or reject with a reason; on approve, set the seller `verified`.
- REPLACES the `SELLER_AUTO_VERIFY` flag and the `// ADMIN-STUB` on seller verification. Re-run seller tests.

### Milestone A-C — Category & catalogue management
- Admin CRUD on the category tree (`categories`, parent/child) and the vehicle taxonomy.
- Sellers still only SELECT categories; admin owns creation. Optional: a "seller category request -> admin approves" queue (P1).
- REPLACES seeded-category ownership / `// ADMIN-STUB`. Confirm seller listing + buyer catalogue still pass.

### Milestone A-D — User & order oversight
- List/search all buyers, sellers, and orders (paginated). Suspend or ban any user; override where needed.
- Read-only order oversight across the whole platform, with the ability to intervene on status.

### Milestone A-E — Payout approval + platform config
- Review seller payout requests; approve / reject / mark paid. Move `payouts` through its states.
- Manage global config: commission rate(s) per category/tier, and any platform settings.
- REPLACES the `// ADMIN-STUB` on payout approval and commission config.

### Milestone A-F — Disputes + audit log
- Dispute queue: view buyer/seller disputes, take a decision, resolve. Where a refund is needed, connect to the existing payment records (Paystack refund reference).
- Audit log: every sensitive admin action (approvals, rejections, bans, payout decisions, config/commission changes) writes an `audit_logs` row with actor, action, target, and timestamp. Expose a read endpoint.

**Out of scope until Admin is done:** the full Logistics module (delivery jobs, rider apps, live tracking), promotions/subscription tiers (P1/P2), advanced analytics (P2). Keep logistics touchpoints as `// LOGISTICS-STUB`.

---

## 7. Data Model

Money in kobo. Buyer + seller tables already exist. Admin flow adds the following.

**Existing:** `users`, `buyer_addresses`, `categories`, `vehicles_taxonomy`, `products`, `product_images`, `product_compatibility`, `carts`, `cart_items`, `orders`, `order_items`, `payments`, `order_status_history`, `seller_profiles`, `seller_documents`, `payouts`.

**Admin flow additions:**
- `admins` — id, full_name, email (unique), password_hash, is_active, timestamps
- `roles` — id, name (unique, e.g. `super_admin`, `verification_admin`), description
- `permissions` — id, key (unique, e.g. `sellers.verify`, `payouts.approve`, `categories.manage`, `users.ban`, `config.manage`, `disputes.resolve`), description
- `role_permissions` — role_id (FK), permission_id (FK)
- `admin_roles` — admin_id (FK), role_id (FK)
- `audit_logs` — id, admin_id (FK), action (string key), target_type, target_id, detail (JSON), created_at
- `platform_config` — id, key (unique, e.g. `commission_rate_default`), value (JSON or string), updated_at
- `disputes` — id, order_id (FK), raised_by (`buyer`/`seller`), reason, status (`open`/`resolved`/`rejected`), resolution_note, resolved_by (admin FK), timestamps
- Extend `seller_profiles`: ensure `verification_status`, `rejection_reason`, `verified_by` (admin FK), `verified_at`.
- Extend `payouts`: ensure `approved_by` (admin FK), `approved_at`, and status flow `requested -> approved -> paid` / `rejected`.

---

## 8. API Conventions

- Base path: `/api/v1`.
- Buyer routes (built): `auth/*`, `me`, `products`, `products/:id`, `cart/*`, `orders`, `orders/:id`, `payments/*`.
- Seller routes (built): `seller/*`.
- Admin routes (this phase), all under admin auth + permission guard:
  - `POST /api/v1/admin/login` . `GET /api/v1/admin/me`
  - `GET  /api/v1/admin/sellers?status=pending` . `GET /api/v1/admin/sellers/:id` . `PATCH /api/v1/admin/sellers/:id/verification`
  - `GET/POST/PATCH/DELETE /api/v1/admin/categories` (+ `/categories/:id`) . `GET /api/v1/admin/category-requests` (P1)
  - `GET /api/v1/admin/users` . `PATCH /api/v1/admin/users/:id/status` . `GET /api/v1/admin/orders` . `PATCH /api/v1/admin/orders/:id/status`
  - `GET /api/v1/admin/payouts` . `PATCH /api/v1/admin/payouts/:id` . `GET/PATCH /api/v1/admin/config`
  - `GET /api/v1/admin/disputes` . `PATCH /api/v1/admin/disputes/:id` . `GET /api/v1/admin/audit-logs`
- Protected routes require `Authorization: Bearer <token>`; admin routes also pass the permission-guard middleware for the specific permission key.
- Correct HTTP status codes (200, 201, 400, 401, 403, 404, 409, 422, 500). Use 403 when an admin lacks the required permission.
- Paginate all list endpoints; never return unbounded result sets.

---

## 9. Testing (required)

- **jest** unit tests: services, utils, the permission-guard logic. Mock the repository layer.
- **mocha + chai + supertest** integration tests against a test database. Grow the happy path: add the admin path (super_admin login -> approve a pending seller -> create a category -> approve a payout), and add negative tests (an admin WITHOUT a permission gets 403).
- Every new service function gets a unit test; every new endpoint gets at least one integration test.
- No external network calls in tests — mock Paystack, Dojah, and file storage.
- npm scripts: `test`, `test:unit`, `test:integration`.
- A feature is not "done" until its tests pass, including the buyer/seller tests affected when a stub is replaced.

---

## 10. Commands

```
npm run dev               # nodemon
npm start                 # start server
npm run migrate           # run pending SQL migrations
npm run seed              # seed dev data (incl. super_admin + roles/permissions)
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
SELLER_AUTO_VERIFY=false   # now that Admin verification exists, default OFF; remove once A-B is confirmed
SUPER_ADMIN_EMAIL=         # seeded super admin (dev)
SUPER_ADMIN_PASSWORD=      # seeded super admin (dev)
```

(XAMPP default MySQL: user `root`, empty password, port 3306 — adjust port to 3307 if XAMPP reports that.)

---

## 12. Security & Non-Functional Rules (PRD section 6)

- HTTPS only in production; JWT auth on all protected routes; permission guard on every admin route.
- **Least privilege:** admins only get the permissions their role needs; `super_admin` is the only all-access role.
- **No card data stored** — Paystack handles payments; store only references/status.
- Hash passwords with bcrypt; never log passwords, tokens, or full payment/verification payloads.
- **Audit everything sensitive:** approvals, rejections, bans, payout decisions, and config/commission changes must write an `audit_logs` row.
- Validate uploaded files: restrict type, cap size, never trust the original filename.
- Rate-limit auth (including admin login) endpoints.
- Validate and sanitise all input.
- Currency NGN; money in kobo (integers).
- Index columns used in admin queries (verification_status, order status, payout status, audit target).
- Keep services stateless; use a DB connection pool.

---

## 13. How Codex Should Work Here

- Before building, restate the task and which milestone (Section 0 / 6C) it belongs to.
- Build one milestone at a time, in order. Do not jump ahead to Logistics.
- Build recipe per unit of work: migration (if needed) -> repository -> service -> validator -> controller -> route -> tests. Then confirm tests pass.
- Reuse existing utils/middleware before writing new ones (esp. auth, response envelope, pagination, upload, and the audit writer once it exists).
- When replacing a stub (`SELLER_AUTO_VERIFY`, seeded categories, payout/commission `// ADMIN-STUB`), update the dependent buyer/seller code and re-run their tests to confirm nothing broke.
- After each milestone: update the README with new endpoints, run all tests, and update Section 0 (move the item to Completed, set the next task). Then stop for review.
- If a requirement is ambiguous, make the smallest reasonable assumption, state it in your output, and continue — do not block.
- Never add a new dependency without noting why; prefer the stack already listed here.
