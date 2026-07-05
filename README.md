# AutoParts Marketplace Backend

Backend API for the AutoParts Marketplace buyer flow plus Seller Flow Milestones `S-A`, `S-B`, `S-C`, and `S-D`. This repository currently implements `AGENTS.md` Milestones A, B, C, D, E, S-A, S-B, S-C, and S-D: buyer authentication, catalogue browsing, cart management, checkout order creation, Paystack-backed payment initialization and verification, buyer order tracking/history, seller registration plus verification onboarding, seller-owned listing management, seller-side order management, and the seller inventory dashboard.

## Implemented Milestone

- Buyer registration with email or Nigerian phone number and password
- Buyer login with JWT access token
- Forgot-password, reset-password, and authenticated change-password flows
- Auth-protected `GET /api/v1/me`
- Product catalogue schema and seed data for categories, products, images, compatibility, and vehicle taxonomy
- Public catalogue browsing with filtering, pagination, and single-product detail
- Authenticated buyer cart management with quantity updates and removal
- Buyer checkout order creation with saved-or-inline delivery address support
- Paystack payment initialization for paystack, bank transfer, and USSD checkout methods
- Paystack payment verification via callback and webhook, including order confirmation on successful verification
- Buyer order history listing, single-order detail, current status/history, and receipt responses
- Order status-history persistence for `pending_payment` and `confirmed`, with buyer-readable lifecycle tracking
- Seller registration with shared auth credentials plus seller business profile fields
- Seller document upload for CAC and proof of address with `multer` local storage
- Seller verification state tracking with a dev-only auto-verify flag and `// ADMIN-STUB` handoff for real approval
- Seller-protected `GET /api/v1/seller/me` profile and verification-status response
- Seller CRUD for owned product listings with multipart photo upload and compatibility records
- Seller-scoped incoming order views with pagination and order-item ownership enforcement
- Seller order-item updates to `ready_for_pickup` or `cancelled`, with `// LOGISTICS-STUB` handoff for downstream dispatch/refund workflows
- Seller inventory dashboard with seller-scoped stock levels, low-stock flags, and summary counts
- Automatic stock decrement when a buyer payment confirms an order for the first time
- Seller CSV bulk upload for creating multiple listings in one request
- Buyer order detail now includes per-item `itemStatus` alongside the existing order-level status history
- Buyer catalogue, cart, and order reads now project seller business metadata from real seller profiles instead of the old product-level seller stub
- Joi request validation, auth rate limiting, central error handling
- MySQL migration and seed scaffolding for buyer-flow tables plus seller onboarding/order-management tables
- Unit and integration test suites for auth, catalogue browsing, cart, checkout, payments, buyer order history, seller onboarding, seller listing management, seller order management, and seller inventory

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

- `UPLOAD_DIR` for local document storage in development
- `SELLER_AUTO_VERIFY` to auto-verify sellers after both required documents are uploaded in non-admin flows

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
- `GET /api/v1/payments/callback`
- `POST /api/v1/payments/webhook`

### Seller

- `POST /api/v1/seller/register`
- `POST /api/v1/seller/documents`
- `GET /api/v1/seller/me`
- `POST /api/v1/seller/products`
- `GET /api/v1/seller/products`
- `PATCH /api/v1/seller/products/:id`
- `DELETE /api/v1/seller/products/:id`
- `GET /api/v1/seller/inventory`
- `POST /api/v1/seller/inventory/bulk`
- `GET /api/v1/seller/orders`
- `PATCH /api/v1/seller/orders/:id/status`

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

Bulk upload seller inventory as multipart form-data:

```text
POST /api/v1/seller/inventory/bulk
Authorization: Bearer <token>

file=<inventory.csv>
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
GET /api/v1/payments/callback?reference=APT-1-1234567890-ABCDEF12
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
- Catalogue list responses return `{ products, pagination }`.
- Product price fields and price filters use kobo integers, for example `minPriceKobo=1000000`.
- The `sellerRating` catalogue filter is treated as a minimum public seller rating threshold.
- Cart responses return `{ id, items, summary }`.
- Checkout currently supports `paystack`, `bank_transfer`, and `ussd` as payment-method selections.
- For Milestone C, delivery fees are stored as `0` kobo until logistics pricing is introduced.
- `POST /api/v1/orders` accepts either a saved `deliveryAddressId` or an inline `deliveryAddress` object, and stores an address snapshot on the order.
- `GET /api/v1/orders` returns `{ orders, pagination }` and supports optional filtering by buyer order `status`.
- `GET /api/v1/orders/:id` returns the order detail, item lines with per-item `itemStatus`, the delivery snapshot, and status history for the authenticated buyer.
- `GET /api/v1/orders/:id/status` returns the current buyer-visible order status plus the status history timeline.
- `GET /api/v1/orders/:id/receipt` returns JSON by default and supports `?format=html` for a printable HTML receipt.
- `POST /api/v1/payments/initialize` uses the authenticated buyer email by default. If the buyer registered without an email, the request can include an `email` field for Paystack initialization.
- Successful Paystack verification moves the order from `pending_payment` to `confirmed`.
- The first successful payment confirmation decrements product stock for the matching order items.
- Order creation records an initial `pending_payment` status-history entry, and successful payment verification records `confirmed`.
- `GET /api/v1/seller/inventory` returns `{ inventory, summary, pagination }` and supports `status` plus `lowStockOnly` filtering.
- Low-stock alerts use a fixed threshold of `5` units for Milestone S-D.
- `POST /api/v1/seller/inventory/bulk` currently treats each csv row as one listing with one compatibility entry; `imageUrls` should be pipe-separated when multiple image URLs are provided.
- `GET /api/v1/seller/orders` returns only the authenticated seller's slice of each order and supports optional filtering by seller `itemStatus`.
- `PATCH /api/v1/seller/orders/:id/status` operates on the seller-owned `order_items.id` and currently allows `ready_for_pickup` and `cancelled` after payment has been confirmed.
- The webhook endpoint expects the `x-paystack-signature` header and stores only sanitized Paystack references/status metadata. No card data is stored.

## Database

- Money values are stored in kobo.
- Run `npm run migrate` to apply SQL files in `src/db/migrations`.
- Run `npm run seed` to load the sample catalogue data for local browsing.
- The current migration set creates the auth, catalogue, cart, buyer address, order, payment, order-status-history, seller onboarding, and seller order-item status tables needed through Milestone S-D.
