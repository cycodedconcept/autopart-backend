# AutoParts Marketplace Backend

Backend API for the AutoParts Marketplace buyer flow. This repository currently implements `AGENTS.md` Milestones A, B, C, D, and E: buyer authentication, catalogue browsing, cart management, checkout order creation, Paystack-backed payment initialization and verification, and buyer order tracking/history.

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
- Joi request validation, auth rate limiting, central error handling
- MySQL migration and seed scaffolding for buyer-flow tables built so far
- Unit and integration test suites for auth, catalogue browsing, cart, checkout, payments, and buyer order history

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
- `GET /api/v1/orders/:id` returns the order detail, item lines, delivery snapshot, and status history for the authenticated buyer.
- `GET /api/v1/orders/:id/status` returns the current buyer-visible order status plus the status history timeline.
- `GET /api/v1/orders/:id/receipt` returns JSON by default and supports `?format=html` for a printable HTML receipt.
- `POST /api/v1/payments/initialize` uses the authenticated buyer email by default. If the buyer registered without an email, the request can include an `email` field for Paystack initialization.
- Successful Paystack verification moves the order from `pending_payment` to `confirmed`.
- Order creation records an initial `pending_payment` status-history entry, and successful payment verification records `confirmed`.
- The webhook endpoint expects the `x-paystack-signature` header and stores only sanitized Paystack references/status metadata. No card data is stored.

## Database

- Money values are stored in kobo.
- Run `npm run migrate` to apply SQL files in `src/db/migrations`.
- Run `npm run seed` to load the sample catalogue data for local browsing.
- The current migration set creates the auth, catalogue, cart, buyer address, order, payment, and order-status-history tables needed for Milestones A through E.
