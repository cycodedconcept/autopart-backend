# AGENTS.md — AutoParts Marketplace (Backend)

This file tells Codex how to work in this repository. Read it fully before generating or changing code. Follow it for every task.

---

## 0. Current Status & Next Task  ← READ THIS FIRST

**Build order:** Buyer flow (done) -> Seller flow (done) -> **Admin panel (current)** -> Logistics.

**Completed**
- [x] Project skeleton (Section 3 layout)
- [x] Milestone A — Auth & accounts: buyer signup, login (JWT), forgot/reset password, `GET /me`, auth middleware
- [x] Milestone B — Catalogue browsing: products list (search/filter/pagination), product detail
- [x] Milestone C — Cart & checkout
- [x] Milestone D — Payment (Paystack)
- [x] Milestone E — Order tracking & history
- [x] Milestone S-A — Seller registration & verification
- [x] Milestone S-B — Product listing management
- [x] Milestone S-C — Order management
- [x] Milestone S-D — Inventory dashboard
- [x] Milestone S-E — Sales & revenue + payouts
- [x] Admin Milestone 1 — Seller verification review queue + approve/reject action
- [x] **Buyer flow complete**
- [x] **Seller flow complete**

**NEXT TASK → Admin panel foundation, Milestone 2 — payout request review queue plus approve/reject action.**
Build, in this order:
1. Payout request review queue plus approve/reject action.
2. Keep the existing seller-side `// ADMIN-STUB` payout hooks and replace them with real admin-owned transitions.
3. Stop before Logistics.

Follow the build recipe in Section 13: migration -> repository -> service -> validator -> controller -> route -> tests, then confirm tests pass. **Stop after the payout-review milestone for review.**

**After this:** Finish Admin, then Logistics.

**Important dependency note:** Some seller actions need Admin (verification approval, payout approval) and Logistics (pickup/delivery status). Where seller code depends on those, build the minimum stub and mark it `// ADMIN-STUB` or `// LOGISTICS-STUB`. Do not build the full Admin or Logistics modules yet.

---

## 1. Project Summary

AutoParts Marketplace is a Nigerian B2B & B2C ecommerce platform for auto spare parts. It connects buyers (car owners, mechanics, fleet operators) with sellers (dealers, distributors, vendors), with an integrated logistics layer.

This repository is the **backend API only** (no frontend). It is consumed by a responsive web client.

Where a module you are not currently building is unavoidable (e.g. a seller feature that needs admin approval), build only the minimum surface needed and mark it `// ADMIN-STUB` / `// LOGISTICS-STUB` / `// SELLER-STUB` as appropriate.

---

## 2. Tech Stack (do not substitute without being asked)

- **Runtime:** Node.js (LTS, v20+)
- **Language:** JavaScript (CommonJS `require`, not ESM) unless told otherwise
- **Framework:** Express.js
- **Database:** MySQL 8 via the `mysql2` driver (promise API + connection pool). Local dev runs on **XAMPP** (user `root`, empty password, port 3306).
- **Query layer:** `mysql2` with **parameterised queries**, or Knex query builder if a builder is needed. Do NOT introduce a heavy ORM (no Sequelize/TypeORM) unless explicitly requested.
- **Auth:** JWT (`jsonwebtoken`); password hashing with `bcrypt`
- **Validation:** `joi` (stay consistent)
- **File upload:** `multer` for document/image upload (CAC docs, product images). Store files locally under `/uploads` in dev; keep the storage layer swappable for S3 later.
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
  /middleware    -> auth, role guard, validation, error handler, rate limiter, upload
  /validators    -> joi schemas per resource
  /utils         -> helpers (jwt, password, money, responses, pagination)
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
- **Reusable components:** factor shared logic into `/utils`, `/middleware`, `/services`. No copy-paste across controllers. Centralise: the response envelope, JWT sign/verify, password hashing, money conversion (naira<->kobo), pagination, file upload handling.
- ONE consistent response envelope:
  ```json
  { "success": true, "data": { }, "message": "..." }
  { "success": false, "error": { "code": "STRING_CODE", "message": "..." } }
  ```
- `async/await` everywhere; wrap async handlers so errors reach the central error middleware (`asyncHandler`).
- One central error-handling middleware. Controllers throw typed errors; middleware maps them to status + envelope. Never leak stack traces or SQL errors to the client.
- Validate every body, query, and param with a joi schema before the controller runs.
- No secrets in code — everything sensitive from `.env`. Keep `.env.example` in sync (no real values).
- Parameterised queries for ALL database access. String-concatenated SQL is forbidden.
- Comments explain *why*, not *what*.

---

## 5. Database Conventions

- MySQL 8, InnoDB, `utf8mb4`.
- Table names: plural snake_case (`products`, `order_items`).
- Primary keys: `id` BIGINT UNSIGNED AUTO_INCREMENT.
- Every table has `created_at` and `updated_at` (TIMESTAMP, default CURRENT_TIMESTAMP).
- Money columns: BIGINT (kobo), clearly named (`price_kobo`, `total_kobo`).
- Foreign keys explicit, with sensible `ON DELETE`.
- All schema changes via ordered SQL migrations in `/src/db/migrations`. Never edit an applied migration — add a new one.

---

## 6. Buyer Flow Milestones  [ALL DONE]

Delivered per PRD 4.1 and 5.1:
- A. Auth & accounts (signup, login, forgot/reset password, `GET /me`)
- B. Catalogue browsing (products list with search/filter/pagination, product detail)
- C. Cart & checkout
- D. Payment (Paystack; no card data stored)
- E. Order tracking & history

The buyer flow currently reads product/seller data that was seeded as `// SELLER-STUB`. The seller flow (Section 6B) replaces those stubs with real seller-owned data. Keep buyer endpoints working as you do this.

---

## 6B. Seller Flow Milestones (build in this order, P0 first)

Ground every endpoint in PRD section 4.2 (Seller Features) and 5.2 (Seller Listing & Fulfilment Flow).

### Milestone S-A — Seller registration & verification  [DONE]
- Seller role + seller profile (business name, contact, address).
- Document upload: CAC document + proof of address (multer).
- Verification states: `pending -> verified` / `rejected (reason)`. Real approval is an Admin action -> `// ADMIN-STUB`; provide a dev-only auto-verify env flag.
- Seller login + read own profile and verification status.

### Milestone S-B — Product listing management  [DONE]
- Seller CRUD on their own listings: create, edit, delete, with photos (multer), price_kobo, stock_qty, part_number, category, condition, compatibility.
- This REPLACES the `// SELLER-STUB` product tables with real seller-owned records. Update the buyer catalogue endpoints to read the real data (a seller only manages their own listings; buyers still read all active listings).
- Enforce ownership: a seller can only edit/delete their own products (role guard + ownership check).

### Milestone S-C — Order management  [DONE]
- Seller views incoming orders for their products, confirms availability, marks order item as `ready_for_pickup`, handles cancellations.
- Connects to the `orders`/`order_items` buyers already create. Where fulfilment needs pickup/delivery, mark `// LOGISTICS-STUB`.

### Milestone S-D — Inventory dashboard  [DONE]
- Stock levels per listing; decrement stock on confirmed orders; low-stock alerts; CSV bulk upload of listings.

### Milestone S-E — Sales & revenue + payouts  [DONE]
- Sales/revenue summary by period; pending payouts (sale total minus platform commission — commission rate is config, `// ADMIN-STUB` for now).
- Payout request to bank account + payout history. Actual payout approval is an Admin action -> `// ADMIN-STUB`.

**Out of scope until seller flow is done:** full Admin panel, full Logistics module, promotions/discounts (P1), seller storefront page (P1), returns management (P1), subscription tiers (P2), buyer-behaviour analytics (P2).

---

## 7. Data Model

Money in kobo. Buyer-flow tables already exist. Seller flow adds/updates the following.

**Existing (buyer flow):** `users`, `buyer_addresses`, `categories`, `vehicles_taxonomy`, `products`, `product_images`, `product_compatibility`, `carts`, `cart_items`, `orders`, `order_items`, `payments`, `order_status_history`.

**Seller flow additions / changes:**
- `users` — ensure `role` supports `seller` and `admin`; sellers and admins authenticate through the same users table.
- `seller_profiles` — id, user_id (FK, unique), business_name, contact_phone, contact_email, address, cac_number, verification_status (`pending`/`verified`/`rejected`), rejection_reason, timestamps
- `seller_documents` — id, seller_id (FK), type (`cac`/`proof_of_address`), file_path, uploaded_at
- `products` — now owned by a real seller: `seller_id` FK -> `seller_profiles` (remove SELLER-STUB); keep title, description, category_id, part_number, condition, price_kobo, stock_qty, location, status, timestamps
- `payouts` — id, seller_id (FK), gross_amount_kobo, commission_amount_kobo, amount_kobo, status (`requested`/`approved`/`paid`/`rejected`), bank_account_ref, requested_at, settled_at
- `seller_order_items` view/queries — seller reads their slice of `order_items` (filter by seller_id); add an `item_status` column to `order_items` (`pending`/`ready_for_pickup`/`picked_up`/`delivered`/`cancelled`) if not already present.

---

## 8. API Conventions

- Base path: `/api/v1`.
- Buyer routes (built): `auth/*`, `me`, `products`, `products/:id`, `cart/*`, `orders`, `orders/:id`, `payments/*`.
- Seller routes (this phase), all under seller auth + `seller` role guard:
  - `POST /api/v1/seller/register` . `POST /api/v1/seller/documents`
  - `GET  /api/v1/seller/me` (profile + verification status)
  - `POST /api/v1/seller/products` . `PATCH /api/v1/seller/products/:id` . `DELETE /api/v1/seller/products/:id` . `GET /api/v1/seller/products`
  - `GET  /api/v1/seller/orders` . `PATCH /api/v1/seller/orders/:id/status`
  - `GET  /api/v1/seller/inventory` . `POST /api/v1/seller/inventory/bulk` (CSV)
  - `GET  /api/v1/seller/sales` . `POST /api/v1/seller/payouts` . `GET /api/v1/seller/payouts`
- Admin routes (current phase), all under admin auth + `admin` role guard:
  - `GET /api/v1/admin/sellers`
  - `PATCH /api/v1/admin/sellers/:id/verification`
- Protected routes require `Authorization: Bearer <token>`; role-restricted routes also pass a role guard middleware.
- Correct HTTP status codes (200, 201, 400, 401, 403, 404, 409, 422, 500).
- Paginate all list endpoints; never return unbounded result sets.

---

## 9. Testing (required)

- **jest** unit tests: services, utils. Mock the repository layer.
- **mocha + chai + supertest** integration tests against a test database. Grow the happy path: buyer path already covered; add the seller path (register -> upload docs -> verify (dev flag) -> create listing -> receive order -> mark ready).
- Every new service function gets a unit test; every new endpoint gets at least one integration test.
- No external network calls in tests — mock Paystack and any file storage.
- npm scripts: `test`, `test:unit`, `test:integration`.
- A feature is not "done" until its tests pass.

---

## 10. Commands

```
npm run dev               # nodemon
npm start                 # start server
npm run migrate           # run pending SQL migrations
npm run seed              # seed dev data
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
SELLER_AUTO_VERIFY=true   # dev only: auto-verify sellers until Admin approval is built
PLATFORM_COMMISSION_RATE_PERCENT=10
```

(XAMPP default MySQL: user `root`, empty password, port 3306 — adjust port to 3307 if XAMPP reports that.)

---

## 12. Security & Non-Functional Rules (PRD section 6)

- HTTPS only in production; JWT auth on all protected routes; role guard on seller/admin routes.
- **No card data stored** — Paystack handles payments; store only references/status.
- Hash passwords with bcrypt; never log passwords, tokens, or full payment payloads.
- Validate uploaded files: restrict type (pdf/jpg/png), cap size, never trust the original filename.
- Rate-limit auth endpoints.
- Validate and sanitise all input.
- Currency NGN; money in kobo (integers).
- Enforce ownership on all seller resources (a seller only touches their own products/orders/payouts).
- Index columns used in search/filter and in seller queries (seller_id, category_id, make/model/year, price).
- Keep services stateless; use a DB connection pool.

---

## 13. How Codex Should Work Here

- Before building, restate the task and which milestone (Section 0 / 6B) it belongs to.
- Build one milestone at a time, in order. Do not jump ahead to Admin or Logistics.
- Build recipe per unit of work: migration (if needed) -> repository -> service -> validator -> controller -> route -> tests. Then confirm tests pass.
- Reuse existing utils/middleware before writing new ones (esp. auth, response envelope, pagination, upload).
- When replacing a `// SELLER-STUB`, update the buyer endpoints that read that data and re-run buyer tests to confirm nothing broke.
- After each milestone: update the README with new endpoints, run all tests, and update Section 0 (move the item to Completed, set the next task). Then stop for review.
- If a requirement is ambiguous, make the smallest reasonable assumption, state it in your output, and continue — do not block.
- Never add a new dependency without noting why; prefer the stack already listed here.
