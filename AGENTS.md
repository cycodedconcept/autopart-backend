# AGENTS.md — AutoParts Marketplace (Backend)

---

## 0. Current Status & Next Task  ← READ THIS FIRST

**Build order:** Buyer flow first, end to end. Do not build seller, logistics, or admin modules yet.

**Completed**
- [x] Project skeleton (Section 3 layout)
- [x] Milestone A — Auth & accounts: buyer signup, login (JWT), forgot password, reset password, `GET /me`, auth middleware
- [x] Milestone B — Catalogue browsing: catalogue schema + seeds, `GET /api/v1/products` with filtering and pagination, `GET /api/v1/products/:id`

**NEXT TASK → Milestone C — Cart & checkout (Section 6).**
Build, in this order:
1. Cart: `GET /api/v1/cart`, `POST /api/v1/cart/items`, `PATCH /api/v1/cart/items/:id`, `DELETE /api/v1/cart/items/:id`.
2. Checkout: review order, select delivery address, choose payment method, create an order.
3. Order creation persists `orders` + `order_items`, captures delivery address, computes totals in kobo. Initial status = `pending_payment`.

For each unit of work follow the build recipe in Section 13: migration -> repository -> service -> validator -> controller -> route -> tests, then confirm tests pass. **Stop after Milestone C so I can review before payment work.**

**After this:** Milestone C (cart & checkout) -> D (payment) -> E (order tracking & history).

---

## 1. Project Summary

AutoParts Marketplace is a Nigerian B2B & B2C ecommerce platform for auto spare parts. It connects buyers (car owners, mechanics, fleet operators) with sellers (dealers, distributors, vendors), with an integrated logistics layer.

This repository is the **backend API only** (no frontend). It is consumed by a responsive web client.

When seller/logistics/admin code is unavoidable for a buyer feature (e.g. reading a seller's public listing), build only the minimum read-only surface needed and mark it clearly with `// SELLER-STUB`.

---

## 2. Tech Stack (do not substitute without being asked)

- **Runtime:** Node.js (LTS, v20+)
- **Language:** JavaScript (CommonJS `require`, not ESM) unless told otherwise
- **Framework:** Express.js
- **Database:** MySQL 8 via the `mysql2` driver (promise API + connection pool). Local dev runs on **XAMPP** (user `root`, empty password, port 3306).
- **Query layer:** `mysql2` with **parameterised queries**, or Knex query builder if a builder is needed. Do NOT introduce a heavy ORM (no Sequelize/TypeORM) unless explicitly requested.
- **Auth:** JWT (`jsonwebtoken`); password hashing with `bcrypt`
- **Validation:** `joi` (stay consistent)
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
  /middleware    -> auth, validation, error handler, rate limiter
  /validators    -> joi schemas per resource
  /utils         -> helpers (jwt, password, money, responses)
  /db
    /migrations  -> ordered SQL migrations (001_xxx.sql, 002_xxx.sql)
    /seeds       -> seed data for local dev/testing
  app.js         -> express app (no listen)
  server.js      -> starts the server (listen)
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
- **Reusable components:** factor shared logic into `/utils`, `/middleware`, `/services`. No copy-paste across controllers. Centralise: the response envelope, JWT sign/verify, password hashing, money conversion (naira<->kobo), pagination.
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

## 6. Buyer Flow Milestones (build in this order, P0 first)

Ground every endpoint in PRD section 4.1 (Buyer Features) and 5.1 (Buyer Purchase Flow).

### Milestone A — Auth & accounts  [DONE]
Buyer registration (email or NG phone + password), login (JWT), forgot/reset password, `GET /me`, auth middleware.

### Milestone B — Catalogue browsing  [NEXT]
1. List products with filtering: part name, vehicle make/model/year, category, part number; filter by price range, location, seller rating, seller business name.
2. Pagination on all list endpoints (page + limit, return total count).
3. View a single product's full detail: photos, condition (new/used/refurbished), compatibility, seller info, price, stock.
   - Product/seller data is read-only here. Mark seller references `// SELLER-STUB`. Seed sample products.

### Milestone C — Cart & checkout
4. Cart: add item, update quantity, remove item, view cart. Cart is per authenticated buyer.
5. Checkout: review order, select delivery address, choose payment method, create an order.
6. Order creation persists `orders` + `order_items`, captures delivery address, computes totals in kobo. Initial status = `pending_payment`.

### Milestone D — Payment
7. Integrate Paystack (primary): initialise transaction + verify via webhook/callback; support bank transfer / USSD channels.
8. **Never store card data.** Store only Paystack references and status. On verification, move order status to `confirmed`. Use TEST keys from `.env`.

### Milestone E — Order tracking & history
9. Order status lifecycle: `pending_payment -> confirmed -> picked_up -> in_transit -> delivered` (+ `cancelled`, `disputed`). Buyer endpoint to read current status and history.
10. Order history: list past orders, view one order, download receipt (JSON/HTML now; PDF later).

**Out of scope until buyer flow is done:** seller dashboard/listings, logistics apps, admin/super-admin panel, returns/disputes logic beyond keeping the `disputed` status available, ratings/reviews, wishlist, BNPL, vehicle profiles.

---

## 7. Suggested Data Model (buyer-flow tables)

Money in kobo. Add fields as needed.

- `users` — id, role (`buyer`; column exists for future roles), full_name, email (unique, nullable if phone used), phone (unique, nullable if email used), password_hash, is_verified, reset_token, reset_token_expires, timestamps
- `buyer_addresses` — id, user_id (FK), label, street, city, state, phone, is_default, timestamps
- `categories` — id, name, slug, parent_id (nullable)
- `vehicles_taxonomy` — id, make, model, year_from, year_to
- `products` — id, seller_id (FK, SELLER-STUB), title, description, category_id (FK), part_number, condition (`new`/`used`/`refurbished`), price_kobo, stock_qty, location, seller_business_name (SELLER-STUB), seller_rating (SELLER-STUB), status (`active`/`inactive`), timestamps
- `product_images` — id, product_id (FK), url, position
- `product_compatibility` — id, product_id (FK), make, model, year_from, year_to
- `carts` — id, user_id (FK, unique)
- `cart_items` — id, cart_id (FK), product_id (FK), quantity, unit_price_kobo
- `orders` — id, buyer_id (FK), status, subtotal_kobo, delivery_fee_kobo, total_kobo, delivery_address_id (FK), payment_reference, payment_status, timestamps
- `order_items` — id, order_id (FK), product_id (FK), seller_id (SELLER-STUB), quantity, unit_price_kobo, line_total_kobo
- `payments` — id, order_id (FK), provider (`paystack`), reference, amount_kobo, status, raw_response (JSON), timestamps
- `order_status_history` — id, order_id (FK), status, note, created_at

---

## 8. API Conventions

- Base path: `/api/v1`.
- RESTful routes. Buyer-flow examples:
  - `POST /api/v1/auth/register` . `POST /api/v1/auth/login` . `POST /api/v1/auth/forgot-password` . `POST /api/v1/auth/reset-password`
  - `GET  /api/v1/me`
  - `GET  /api/v1/products` (filters via query string) . `GET /api/v1/products/:id`
  - `GET  /api/v1/cart` . `POST /api/v1/cart/items` . `PATCH /api/v1/cart/items/:id` . `DELETE /api/v1/cart/items/:id`
  - `POST /api/v1/orders` . `GET /api/v1/orders` . `GET /api/v1/orders/:id`
  - `POST /api/v1/payments/initialize` . `POST /api/v1/payments/webhook`
- Protected routes require `Authorization: Bearer <token>`.
- Correct HTTP status codes (200, 201, 400, 401, 403, 404, 409, 422, 500).
- Paginate all list endpoints; never return unbounded result sets.

---

## 9. Testing (required)

- **jest** unit tests: services, utils (money conversion, jwt, validators). Mock the repository layer.
- **mocha + chai + supertest** integration tests against a test database; cover the buyer happy path as it grows (currently: register -> login -> forgot/reset; next: browse products).
- Every new service function gets a unit test; every new endpoint gets at least one integration test.
- No external network calls in tests — mock Paystack.
- npm scripts: `test`, `test:unit`, `test:integration`.
- A feature is not "done" until its tests pass.

---

## 10. Commands

```
npm run dev               # nodemon
npm start                 # start server
npm run migrate           # run pending SQL migrations
npm run seed              # seed dev data (incl. sample products)
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
```

(XAMPP default MySQL: user `root`, empty password, port 3306 — adjust port to 3307 if XAMPP reports that.)

---

## 12. Security & Non-Functional Rules (PRD section 6)

- HTTPS only in production; JWT auth on all protected routes.
- **No card data stored** — Paystack handles payments; store only references/status.
- Hash passwords with bcrypt; never log passwords, tokens, or full payment payloads.
- Rate-limit auth endpoints.
- Validate and sanitise all input.
- Currency NGN; money in kobo (integers).
- Index columns used in search/filter (part name, category_id, make/model/year, price); target page loads < 3s on slow networks.
- Keep services stateless; use a DB connection pool (scale to 10x traffic).

---

## 13. How Codex Should Work Here

- Before building, restate the task and which milestone (Section 0 / 6) it belongs to.
- Build one milestone at a time, in order. Do not jump ahead to seller/admin code.
- Build recipe per unit of work: migration (if needed) -> repository -> service -> validator -> controller -> route -> tests. Then confirm tests pass.
- Reuse existing utils/middleware before writing new ones.
- After each milestone: update the README with new endpoints, run all tests, and update Section 0 (move the item to Completed, set the next task). Then stop for review.
- If a requirement is ambiguous, make the smallest reasonable assumption, state it in your output, and continue — do not block.
- Never add a new dependency without noting why; prefer the stack already listed here.
