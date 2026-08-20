# AutoParts Marketplace Backend

Backend API for the AutoParts Marketplace buyer flow, Seller Flow Milestones `S-A` through `S-E`, Admin Milestones `A-A` through `A-F`, and Logistics Milestones `L-A` through `L-E`. This repository currently implements the buyer flow, seller flow, the full admin operations slice, and the full logistics slice: buyer authentication, catalogue browsing, cart management, checkout order creation with calculated delivery fees, Paystack-backed payment initialization and verification, buyer order tracking/history, seller registration plus CAC verification onboarding, seller-owned listing management, seller-side order management, the seller inventory dashboard, seller sales plus payout request workflows, dedicated admin auth with dashboard overview, seller verification, catalogue management, user and order oversight, payout review, platform configuration RBAC, disputes review, audit-log access, plus logistics company registration, delivery zones, company-managed riders, rider authentication, nearest-rider delivery-job auto-assignment, admin manual assignment fallback, rider-driven delivery progression, failed-delivery recovery, delivery-fee settlement, logistics-company payout reuse, company dashboard summaries, and admin logistics delivery metrics.

## Implemented Milestone

- Buyer registration with email or Nigerian phone number and password
- Buyer login with JWT access token
- Forgot-password, reset-password, and authenticated change-password flows
- Auth-protected `GET /api/v1/me`
- Product catalogue schema and seed data for categories, products, images, compatibility, and vehicle taxonomy
- Public catalogue browsing with filtering, pagination, and single-product detail
- Authenticated buyer cart management with quantity updates and removal
- Buyer checkout order creation with saved-or-inline delivery address support plus calculated delivery fees
- Paystack payment initialization for paystack, bank transfer, and USSD checkout methods
- Paystack payment verification with webhook-first confirmation, authenticated redirect fallback verification, and duplicate-safe order confirmation
- Buyer order history listing, single-order detail, current status/history, and receipt responses
- Order status-history persistence for `pending_payment` and `confirmed`, with buyer-readable lifecycle tracking
- Seller registration with shared auth credentials plus seller business profile fields
- Seller document upload for CAC and proof of address with `multer` local storage
- Seller registration-time CAC lookup through Dojah with the provider response stored for later admin review
- Seller-triggered CAC verification retry to refresh stored Dojah metadata after fixing provider credentials or transient errors
- Seller document upload for CAC and proof of address with pending admin review after upload
- Seller-protected `GET /api/v1/seller/me` profile and verification-status response
- Seller CRUD for owned product listings with multipart photo upload and compatibility records
- Seller-scoped incoming order views with pagination and order-item ownership enforcement
- Seller order-item updates to `ready_for_pickup` or `cancelled`, with automatic delivery-job creation when the seller hands an item over for dispatch
- Seller inventory dashboard with seller-scoped stock levels, low-stock flags, and summary counts
- Automatic stock decrement when a buyer payment confirms an order for the first time
- Seller CSV bulk upload for creating multiple listings in one request
- Seller sales and revenue summary by date range with platform commission deduction
- Seller pending payout calculation plus payout request history
- Dedicated admin authentication via `admins` plus `/api/v1/admin/login`
- Admin RBAC with `roles`, `permissions`, `role_permissions`, and `admin_roles`
- Seeded `super_admin` access plus a scoped `verification_admin` role
- Permission-gated `GET /api/v1/admin/me`
- Admin-protected super admin dashboard overview with KPI cards, alerts, queue previews, leaderboard widgets, and recent activity behind `dashboard.read`
- Admin-protected seller verification review queue, seller detail view, and approve or reject actions behind `sellers.verify`
- Admin-protected category tree create/update plus archive-and-restore management behind `categories.manage`
- Admin-protected vehicle taxonomy CRUD behind `categories.manage`
- Admin-protected buyer and seller oversight listing with search, pagination, and seller-profile summaries behind `users.manage`
- Admin-controlled buyer/seller account statuses (`active`, `suspended`, `banned`) enforced at login and on protected routes
- Admin-protected platform-wide order oversight list with search, payment filters, and controlled order-status intervention behind `orders.manage`
- Admin-triggered reconciliation for stale pending Paystack payments behind `orders.manage`
- Admin-protected payout review queue with seller or logistics-company detail plus approve, reject, and mark-paid transitions behind `payouts.approve`
- Admin-owned platform config reads and updates for default commission, category overrides, seller-tier overrides, and platform settings behind `config.manage`
- Admin-protected disputes queue with buyer/order/seller context plus resolve-or-reject actions behind `disputes.resolve`
- Admin-protected audit-log list endpoint behind `audit_logs.read`
- Audit-log writes for seller verification, user status changes, order interventions, payout decisions, dispute decisions, and platform config changes
- Logistics company registration and login with dedicated company-scoped JWT access
- Delivery-zone records for rider onboarding and later assignment/fee matching
- Company-owned rider creation, listing, update, and ownership enforcement
- Rider login, rider profile access, and availability updates
- Company and rider delivery-job views with explicit `pending -> assigned -> picked_up -> in_transit -> delivered` progression plus rider-side `failed` handling that advances buyer-visible order tracking
- Failed delivery jobs now capture a required reason, release the rider back to `available`, return the item to `ready_for_pickup`, and stay visible for manual reassignment
- Delivery-fee calculation now uses a shared base-plus-distance-plus-weight calculator that persists per-order and per-job fees in kobo
- Delivered jobs now record the platform logistics margin and the logistics-company share for settlement
- Logistics companies now have earnings summaries plus payout-request creation through the shared payouts workflow
- Logistics company job views now include dashboard-ready job-status totals plus rider performance summaries
- Admin logistics company approval or suspension plus rider oversight behind `logistics.manage`
- Admin delivery-job queue review plus manual rider assignment behind `logistics.manage`
- Admin logistics oversight now includes cross-company company or rider summary counts, unassigned-job visibility, filterable delivery-job reviews, and delivery metrics
- Seller payout eligibility now unlocks only after delivered logistics jobs, not just paid orders
- Seller compatibility payloads now validate against admin-managed vehicle taxonomy entries
- Seller commission reads now resolve from admin-owned platform config with `PLATFORM_COMMISSION_RATE_PERCENT` retained as a bootstrap fallback in development and test
- Buyer order detail now includes per-item `itemStatus` alongside the existing order-level status history
- Buyer catalogue, cart, and order reads now project seller business metadata from real seller profiles instead of the old product-level seller stub
- Joi request validation, auth rate limiting, central error handling
- MySQL migration and seed scaffolding for buyer-flow tables plus seller onboarding, payout, admin-role, logistics company or rider tables, and delivery settlement fields
- Unit and integration test suites for auth, catalogue browsing, cart, checkout, payments, buyer order history, seller onboarding, seller listing management, seller order management, seller inventory, seller finance, logistics company and rider delivery flows, admin seller verification, admin catalogue management, admin user or order oversight, admin logistics oversight, delivery-fee settlement, and the super admin dashboard

## Project Structure

```text
src/
  config/
  controllers/
  db/
    migrations/
    seeds/
  middleware/
  repositories/
  routes/
  services/
  utils/
  validators/
  app.js
  server.js
tests/
  integration/
  setup/
  unit/
scripts/
```

## Environment Setup

Copy `.env.example` to `.env` and fill in the required values.

Seller onboarding uses:

- `UPLOAD_DIR` for local seller-document storage in development
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` for persistent product image uploads
- `CORS_ALLOWED_ORIGINS` as an optional comma-separated frontend allowlist for browser requests; leave it blank to allow any origin during local development
- `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY`, `PAYSTACK_BASE_URL`, and `APP_URL` for checkout initialization, transaction verification, and webhook-safe redirect fallbacks
- `DOJAH_BASE_URL`, `DOJAH_APP_ID`, and `DOJAH_API_KEY` for CAC lookups during seller registration
- `PLATFORM_COMMISSION_RATE_PERCENT` as the bootstrap fallback commission rate before admin-managed config is changed in development and test
- `DELIVERY_BASE_FEE_KOBO`, `DELIVERY_PER_KM_KOBO`, and `LOGISTICS_PLATFORM_MARGIN_PCT` for shared delivery-fee and settlement calculations

Product image note:

- New product image uploads now persist to Cloudinary.
- Existing `product_images` rows that still point to old local or placeholder URLs need manual re-upload or backfill.

Local admin review uses:

- `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` for `npm run seed`
- `npm run seed` to provision the seeded `super_admin` plus the scoped `verification_admin` role definitions

Paystack deployment notes:

- Configure the Paystack dashboard webhook URL separately in both test mode and live mode as `https://<railway-domain>/webhooks/paystack`.
- `localhost` cannot receive Paystack webhooks directly; use the deployed Railway URL or a tunnel such as ngrok during local testing.
- `PAYSTACK_BASE_URL` defaults to `https://api.paystack.co` and is mainly useful when switching between provider environments or test doubles.
- `APP_URL` should point at the buyer-facing application origin used for Paystack redirect UX, for example `https://app.example.com`.
- Railway deployments already set `app.set('trust proxy', 1)` in the Express app for proxy-aware request metadata.

## Commands

```bash
npm run dev
npm start
npm run migrate
npm run seed
npm test
npm run test:unit
npm run test:integration
npm run lint
```

## API Endpoints

### Auth

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `PATCH /api/v1/auth/password`
- `GET /api/v1/me`

### Products

- `GET /api/v1/products`
- `GET /api/v1/products/:id`

### Cart

- `GET /api/v1/cart`
- `POST /api/v1/cart/items`
- `PATCH /api/v1/cart/items/:id`
- `DELETE /api/v1/cart/items/:id`

### Orders

- `POST /api/v1/orders`
- `GET /api/v1/orders`
- `GET /api/v1/orders/:id`
- `GET /api/v1/orders/:id/status`
- `GET /api/v1/orders/:id/receipt`

### Payments

- `POST /api/v1/payments/initialize`
- `GET /api/v1/payments/verify/:reference`
- `GET /api/v1/payments/callback`

### Webhooks

- `POST /webhooks/paystack`

### Seller

- `POST /api/v1/seller/register`
- `POST /api/v1/seller/documents`
- `POST /api/v1/seller/cac-verification/retry`
- `GET /api/v1/seller/me`
- `POST /api/v1/seller/products`
- `GET /api/v1/seller/products`
- `PATCH /api/v1/seller/products/:id`
- `DELETE /api/v1/seller/products/:id`
- `GET /api/v1/seller/inventory`
- `POST /api/v1/seller/inventory/bulk`
- `GET /api/v1/seller/orders`
- `PATCH /api/v1/seller/orders/:id/status`
- `GET /api/v1/seller/dashboard`
- `GET /api/v1/seller/sales`
- `POST /api/v1/seller/payouts`
- `GET /api/v1/seller/payouts`

### Logistics

- `POST /api/v1/logistics/register`
- `POST /api/v1/logistics/login`
- `GET /api/v1/logistics/me`
- `GET /api/v1/logistics/zones`
- `POST /api/v1/logistics/riders`
- `GET /api/v1/logistics/riders`
- `GET /api/v1/logistics/riders/:id`
- `PATCH /api/v1/logistics/riders/:id`
- `PATCH /api/v1/logistics/riders/:id/suspend`
- `PATCH /api/v1/logistics/riders/:id/reactivate`
- `GET /api/v1/logistics/jobs`
- `GET /api/v1/logistics/earnings`
- `POST /api/v1/logistics/payouts`

### Rider

- `POST /api/v1/rider/login`
- `GET /api/v1/rider/me`
- `PATCH /api/v1/rider/availability`
- `GET /api/v1/rider/jobs`
- `GET /api/v1/rider/jobs/:id`
- `PATCH /api/v1/rider/jobs/:id/status`

### Admin

- `POST /api/v1/admin/login`
- `GET /api/v1/admin/dashboard`
- `GET /api/v1/admin/me`
- `GET /api/v1/admin/sellers`
- `GET /api/v1/admin/sellers/:id`
- `PATCH /api/v1/admin/sellers/:id/verification`
- `GET /api/v1/admin/users`
- `PATCH /api/v1/admin/users/:id/status`
- `GET /api/v1/admin/logistics/companies`
- `PATCH /api/v1/admin/logistics/companies/:id/status`
- `GET /api/v1/admin/logistics/riders`
- `GET /api/v1/admin/delivery-jobs`
- `PATCH /api/v1/admin/delivery-jobs/:id/assign`
- `GET /api/v1/admin/categories`
- `POST /api/v1/admin/categories`
- `GET /api/v1/admin/categories/:id`
- `PATCH /api/v1/admin/categories/:id`
- `DELETE /api/v1/admin/categories/:id`
- `GET /api/v1/admin/orders`
- `PATCH /api/v1/admin/orders/:id/status`
- `GET /api/v1/admin/payouts`
- `PATCH /api/v1/admin/payouts/:id`
- `GET /api/v1/admin/config`
- `PATCH /api/v1/admin/config`
- `GET /api/v1/admin/disputes`
- `PATCH /api/v1/admin/disputes/:id`
- `GET /api/v1/admin/audit-logs`
- `GET /api/v1/admin/vehicle-taxonomy`
- `POST /api/v1/admin/vehicle-taxonomy`
- `GET /api/v1/admin/vehicle-taxonomy/:id`
- `PATCH /api/v1/admin/vehicle-taxonomy/:id`
- `DELETE /api/v1/admin/vehicle-taxonomy/:id`

### Sample Requests

Register with email:

```json
{
  "fullName": "Amaka Nwosu",
  "email": "amaka@example.com",
  "password": "Password123!"
}
```

Register with Nigerian phone number:

```json
{
  "fullName": "Tunde Adebayo",
  "phone": "08012345678",
  "password": "Password123!"
}
```

Login:

```json
{
  "identifier": "amaka@example.com",
  "password": "Password123!"
}
```

Login as the seeded dev admin:

```json
{
  "email": "superadmin@autoparts.local",
  "password": "Password123"
}
```

Suspend a seller or buyer account:

```json
{
  "status": "suspended"
}
```

Move an order forward from the admin panel:

```json
{
  "status": "picked_up",
  "note": "Collected from seller by operations team."
}
```

Forgot password:

```json
{
  "identifier": "amaka@example.com"
}
```

Reset password:

```json
{
  "token": "64-char-reset-token",
  "newPassword": "NewPassword123!"
}
```

Browse products:

```text
GET /api/v1/products?partName=brake%20pad&vehicleMake=Toyota&vehicleModel=Camry&vehicleYear=2010&category=brake-system&condition=new&minPriceKobo=1000000&maxPriceKobo=3000000&location=Lagos&sellerRating=4.5&sellerBusinessName=Prime&page=1&limit=10
```

Fetch a single product:

```text
GET /api/v1/products/4001
```

Add a cart item:

```json
{
  "productId": 4001,
  "quantity": 2
}
```

Update a cart item:

```json
{
  "quantity": 3
}
```

Create an order with a new delivery address:

```json
{
  "paymentMethod": "paystack",
  "deliveryAddress": {
    "label": "Workshop",
    "street": "12 Adeola Odeku Street",
    "city": "Ikeja",
    "state": "Lagos",
    "phone": "08012345678"
  }
}
```

Create an order with an existing saved address:

```json
{
  "paymentMethod": "bank_transfer",
  "deliveryAddressId": 3
}
```

Initialize a payment:

```json
{
  "orderId": 1,
  "callbackUrl": "https://example.com/payments/callback"
}
```

Initialize a payment for a phone-only buyer:

```json
{
  "orderId": 1,
  "email": "buyer@example.com"
}
```

Register a seller:

```json
{
  "fullName": "Uche Okafor",
  "email": "uche@example.com",
  "phone": "08012345678",
  "password": "Password123!",
  "businessName": "Prime Auto Hub",
  "contactEmail": "sales@primeautohub.ng",
  "contactPhone": "08012345678",
  "address": "12 Sapara Williams Close, Victoria Island, Lagos",
  "cacNumber": "RC-123456"
}
```

Upload seller documents as multipart form-data:

```text
POST /api/v1/seller/documents
Authorization: Bearer <token>

cacDocument=<pdf/jpg/png file>
proofOfAddressDocument=<pdf/jpg/png file>
```

Create a seller product as multipart form-data:

```text
POST /api/v1/seller/products
Authorization: Bearer <token>

title=Front Brake Disc
description=Premium brake disc for Toyota Camry sedans.
categoryId=1002
partNumber=DISC-001
condition=new
priceKobo=4500000
stockQty=12
location=Lagos
compatibility=[{"make":"Toyota","model":"Camry","yearFrom":2007,"yearTo":2011}]
photos=<jpg/png file>
photos=<jpg/png file>
```

Update a seller product:

```text
PATCH /api/v1/seller/products/:id
Authorization: Bearer <token>

priceKobo=5200000
stockQty=9
compatibility=[{"make":"Toyota","model":"Camry","yearFrom":2008,"yearTo":2012}]
photos=<jpg/png file>
```

List seller orders:

```text
GET /api/v1/seller/orders?itemStatus=pending&page=1&limit=10
Authorization: Bearer <token>
```

List seller inventory:

```text
GET /api/v1/seller/inventory?status=all&lowStockOnly=false&page=1&limit=10
Authorization: Bearer <token>
```

Get seller dashboard summary:

```text
GET /api/v1/seller/dashboard?dateFrom=2026-07-01&dateTo=2026-07-07
Authorization: Bearer <token>
```

Bulk upload seller inventory as multipart form-data:

```text
POST /api/v1/seller/inventory/bulk
Authorization: Bearer <token>

file=<inventory.csv>
```

List seller sales for a period:

```text
GET /api/v1/seller/sales?dateFrom=2026-07-01&dateTo=2026-07-07
Authorization: Bearer <token>
```

Create a seller payout request:

```text
POST /api/v1/seller/payouts
Authorization: Bearer <token>

{"bankAccountRef":"BANK-0012345678"}
```

List seller payout history:

```text
GET /api/v1/seller/payouts?status=requested&page=1&limit=10
Authorization: Bearer <token>
```

List the admin seller verification queue:

```text
GET /api/v1/admin/sellers?status=pending&page=1&limit=10
Authorization: Bearer <admin-token>
```

Fetch one seller verification profile, including documents and the stored Dojah response:

```text
GET /api/v1/admin/sellers/:id
Authorization: Bearer <admin-token>
```

Approve a seller verification:

```text
PATCH /api/v1/admin/sellers/:id/verification
Authorization: Bearer <admin-token>

{"verificationStatus":"verified"}
```

Create an admin category:

```json
{
  "name": "Cooling System",
  "slug": "cooling-system"
}
```

Create an admin vehicle taxonomy entry:

```json
{
  "make": "Mazda",
  "model": "CX-5",
  "trim": "Signature",
  "yearFrom": 2018,
  "yearTo": 2021
}
```

Archive a category without permanently deleting it:

```text
DELETE /api/v1/admin/categories/:id
Authorization: Bearer <admin-token>
```

Restore an archived category:

```json
{
  "status": "active"
}
```

Reject a seller verification:

```text
PATCH /api/v1/admin/sellers/:id/verification
Authorization: Bearer <admin-token>

{"verificationStatus":"rejected","rejectionReason":"CAC document details could not be matched."}
```

Inventory CSV header:

```text
title,description,categoryId,partNumber,condition,priceKobo,stockQty,location,status,compatibleMake,compatibleModel,compatibleYearFrom,compatibleYearTo,imageUrls
```

Inventory CSV sample row:

```text
Front Brake Disc,"Premium brake disc for Toyota Camry sedans.",1002,BULK-DISC-001,new,4500000,12,Lagos,active,Toyota,Camry,2007,2011,https://example.com/disc-1.png|https://example.com/disc-2.png
```

Mark a seller order item as ready for pickup:

```text
PATCH /api/v1/seller/orders/:id/status
Authorization: Bearer <token>

{"itemStatus":"ready_for_pickup"}
```

Cancel a seller order item:

```text
PATCH /api/v1/seller/orders/:id/status
Authorization: Bearer <token>

{"itemStatus":"cancelled"}
```

Verify a payment callback:

```text
GET /api/v1/payments/verify/APT-1-1234567890-ABCDEF12
Authorization: Bearer <token>
```

List buyer orders:

```text
GET /api/v1/orders?status=confirmed&page=1&limit=10
```

Fetch a single buyer order:

```text
GET /api/v1/orders/1
```

Fetch current order status and history:

```text
GET /api/v1/orders/1/status
```

Fetch a receipt as JSON:

```text
GET /api/v1/orders/1/receipt
```

Fetch a receipt as HTML:

```text
GET /api/v1/orders/1/receipt?format=html
```

## Auth Notes

- Login accepts `identifier` and `password`. `identifier` may be an email address or a Nigerian phone number.
- Registration accepts either `email`, `phone`, or both.
- In `development` and `test`, forgot-password returns the reset token in the response until email/SMS delivery is added.
- Protected routes require `Authorization: Bearer <token>`.
- Admin users are provisioned outside the public registration flow; local development gets a seeded admin account after `npm run seed`.
- Catalogue list responses return `{ products, pagination }`.
- Product price fields and price filters use kobo integers, for example `minPriceKobo=1000000`.
- The `sellerRating` catalogue filter is treated as a minimum public seller rating threshold.
- Cart responses return `{ id, items, summary }`.
- Checkout currently supports `paystack`, `bank_transfer`, and `ussd` as payment-method selections.
- Delivery fees are now calculated in kobo from the shared base-fee, inferred-distance, and shipment-weight rules used by the logistics settlement flow.
- `POST /api/v1/orders` accepts either a saved `deliveryAddressId` or an inline `deliveryAddress` object, stores an address snapshot on the order, and persists the computed delivery fee on both the order and each order item.
- `GET /api/v1/orders` returns `{ orders, pagination }` and supports optional filtering by buyer order `status`.
- `GET /api/v1/orders/:id` returns the order detail, item lines with per-item `itemStatus`, the delivery snapshot, and status history for the authenticated buyer.
- `GET /api/v1/orders/:id/status` returns the current buyer-visible order status plus the status history timeline.
- `GET /api/v1/orders/:id/receipt` returns JSON by default and supports `?format=html` for a printable HTML receipt.
- `POST /api/v1/payments/initialize` uses the authenticated buyer email by default. If the buyer registered without an email, the request can include an `email` field for Paystack initialization.
- `POST /api/v1/payments/initialize` sends the Paystack amount in kobo, persists the generated reference on the order, and includes `order_id` plus `user_id` metadata for later verification.
- `POST /webhooks/paystack` is the payment source of truth. The callback redirect is UX-only and the buyer-facing fallback should call `GET /api/v1/payments/verify/:reference` after the user lands back in the app.
- Successful Paystack verification moves the order from `pending_payment` to `confirmed`.
- The first successful payment confirmation decrements product stock for the matching order items.
- Order creation records an initial `pending_payment` status-history entry, and successful payment verification records `confirmed`.
- Webhook signatures are verified against the raw request body with `x-paystack-signature` and `PAYSTACK_SECRET_KEY`; duplicate webhook deliveries are deduplicated in `payment_webhook_events`.
- Verification never trusts webhook amounts directly: the backend re-checks the reference against Paystack and flags mismatched `amount` or `currency` responses instead of fulfilling the order.
- `POST /api/v1/admin/payments/reconcile-pending` lets an admin re-check stale pending payments older than a chosen threshold and settle or expire them through the same Paystack verification path.
- `GET /api/v1/seller/inventory` returns `{ inventory, summary, pagination }` and supports `status` plus `lowStockOnly` filtering.
- Low-stock alerts use a fixed threshold of `5` units for Milestone S-D.
- `POST /api/v1/seller/inventory/bulk` currently treats each csv row as one listing with one compatibility entry; `imageUrls` should be pipe-separated when multiple image URLs are provided.
- `GET /api/v1/seller/orders` returns only the authenticated seller's slice of each order and supports optional filtering by seller `itemStatus`.
- `PATCH /api/v1/seller/orders/:id/status` operates on the seller-owned `order_items.id`; moving an item to `ready_for_pickup` now creates a delivery job and immediately tries nearest-rider auto-assignment.
- `GET /api/v1/seller/dashboard` returns seller profile basics plus UI-ready overview cards, monthly revenue chart data, product-status counts, featured products, customer leaderboard entries, and the existing seller-scoped inventory, order, sales, and payout summaries. It accepts the same optional `dateFrom` plus `dateTo` query pair as the seller sales endpoint.
- `GET /api/v1/seller/sales` returns `{ period, commissionRatePercent, sales, payouts }` and supports optional `dateFrom` plus `dateTo` filtering in `YYYY-MM-DD` format.
- `POST /api/v1/seller/payouts` currently creates one payout request for all eligible delivered seller order items that are not already tied to an open payout record.
- `GET /api/v1/seller/payouts` returns `{ payouts, pagination }` and supports optional payout `status` filtering.
- `POST /api/v1/logistics/register` provisions a new logistics company and returns the company profile plus a company-scoped access token.
- `POST /api/v1/logistics/login` authenticates a logistics company with the registered email and password.
- `GET /api/v1/logistics/zones` returns the delivery zones available for rider onboarding.
- `POST /api/v1/logistics/riders` creates a rider for the authenticated company; `zoneId` must reference an existing delivery zone.
- `GET /api/v1/logistics/riders` returns `{ riders, pagination, filters }` and supports `status`, `search`, `page`, and `limit`.
- `PATCH /api/v1/logistics/riders/:id` lets a company update only its own rider records.
- `PATCH /api/v1/logistics/riders/:id/suspend` suspends one company-owned rider, reassigns not-yet-picked-up jobs, and flags in-progress jobs for manual handling.
- `PATCH /api/v1/logistics/riders/:id/reactivate` restores one company-owned rider account after a suspension.
- `GET /api/v1/logistics/jobs` returns `{ jobs, pagination, filters, summary }` for the authenticated company and supports `status`, `search`, `page`, and `limit`; `summary.jobsByStatus` exposes company-wide job counts, and `summary.riderPerformance` exposes rider availability plus per-rider delivery outcomes.
- `GET /api/v1/logistics/earnings` returns delivered-job earnings, current payout balances, and settlement totals for the authenticated company.
- `POST /api/v1/logistics/payouts` creates one payout request for all eligible delivered jobs that are not already attached to an open logistics-company payout.
- `POST /api/v1/rider/login` returns a rider-scoped token for the delivery execution routes.
- `PATCH /api/v1/rider/availability` accepts `available`, `unavailable`, or `on_delivery`.
- `GET /api/v1/rider/jobs` returns only the authenticated rider's own jobs and supports `status`, `search`, `page`, and `limit`.
- `GET /api/v1/rider/jobs/:id` returns the job detail with seller, buyer, order, item, assignee, and delivery-job status history only when the job belongs to the authenticated rider.
- `PATCH /api/v1/rider/jobs/:id/status` enforces `assigned -> picked_up -> in_transit -> delivered` and also allows `assigned|picked_up|in_transit -> failed`; only the assigned rider can update the job, and `failureReason` is required for `failed`.
- Seller payout eligibility now depends on delivered logistics jobs instead of raw payment confirmation alone.
- `GET /api/v1/admin/logistics/companies` returns `{ companies, pagination, filters, summary }` and supports `status`, `search`, `page`, and `limit`.
- `PATCH /api/v1/admin/logistics/companies/:id/status` accepts `approved` or `suspended` for admin review decisions.
- `GET /api/v1/admin/logistics/riders` returns `{ riders, pagination, filters, summary }` and supports `companyId`, `status`, `search`, `page`, and `limit`.
- `GET /api/v1/admin/delivery-jobs` returns `{ jobs, pagination, filters, summary }` and supports `status`, `companyId`, `riderId`, `search`, `page`, and `limit`; `summary.jobsByStatus` exposes the queue mix, and `summary.deliveryMetrics` exposes unassigned volume, completion rate, and delivered-fee totals.
- `PATCH /api/v1/admin/delivery-jobs/:id/assign` assigns a pending job, or reassigns a failed one, to a rider and records an audit-log entry for the manual intervention.
- `GET /api/v1/admin/sellers` returns `{ sellers, pagination, filters }` and supports `status=all|pending|verified|rejected`, defaulting to `pending`.
- `GET /api/v1/admin/dashboard` returns UI-ready summary data for the admin home screen, including alerts, overview cards, operational cards, seller verification and payout queue previews, dispute and order previews, top sellers, recent audit activity, and platform-health metrics.
- `GET /api/v1/admin/sellers/:id` returns the seller account, uploaded documents, and the stored CAC lookup response from Dojah.
- `PATCH /api/v1/admin/sellers/:id/verification` accepts `verified` or `rejected`; `rejectionReason` is required when rejecting.
- `GET /api/v1/admin/payouts` returns `{ payouts, pagination, filters }` and supports `status`, `payeeType`, `sellerId`, `companyId`, `search`, `page`, and `limit`.
- `PATCH /api/v1/admin/payouts/:id` accepts `approved`, `rejected`, or `paid`; `rejectionReason` is required when rejecting, and only `requested -> approved|rejected` plus `approved -> paid` are allowed for both seller and logistics-company payout requests.
- `GET /api/v1/admin/config` returns the current admin-owned platform config for commissions and other operational settings.
- `PATCH /api/v1/admin/config` accepts any combination of `commissionRateDefault`, `commissionRatesByCategory`, `commissionRatesBySellerTier`, and `platformSettings`.
- `GET /api/v1/admin/disputes` returns `{ disputes, pagination, filters }` and supports `status`, `raisedBy`, `search`, `page`, and `limit`.
- `PATCH /api/v1/admin/disputes/:id` accepts `resolved` or `rejected`; `resolutionNote` is required, refund metadata is optional for resolved disputes, and only open disputes can be reviewed.
- `GET /api/v1/admin/audit-logs` returns `{ auditLogs, pagination, filters }` and supports `adminId`, `action`, `targetType`, `targetId`, `page`, and `limit`.
- The webhook endpoint expects the `x-paystack-signature` header, stores only sanitized Paystack references/status metadata, and never stores card data.

## Database

- Money values are stored in kobo.
- Run `npm run migrate` to apply SQL files in `src/db/migrations`.
- Run `npm run seed` to load the sample catalogue data, delivery zones, and the dev admin user for local review flows.
- The current migration set creates the auth, catalogue, cart, buyer address, order, payment, order-status-history, seller onboarding, seller payout, admin RBAC, `platform_config`, `audit_logs`, `disputes`, `logistics_companies`, `riders`, `delivery_zones`, delivery-job lifecycle data, and payout-settlement fields needed through Logistics Milestone `L-E`.
