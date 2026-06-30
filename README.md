# AutoParts Marketplace Backend

Backend API for the AutoParts Marketplace buyer flow. This repository currently implements `AGENTS.md` Milestones A, B, and C: buyer authentication, catalogue browsing, cart management, and checkout order creation.

## Implemented Milestone

- Buyer registration with email or Nigerian phone number and password
- Buyer login with JWT access token
- Forgot-password, reset-password, and authenticated change-password flows
- Auth-protected `GET /api/v1/me`
- Product catalogue schema and seed data for categories, products, images, compatibility, and vehicle taxonomy
- Public catalogue browsing with filtering, pagination, and single-product detail
- Authenticated buyer cart management with quantity updates and removal
- Buyer checkout order creation with saved-or-inline delivery address support
- Joi request validation, auth rate limiting, central error handling
- MySQL migration and seed scaffolding for buyer-flow tables built so far
- Unit and integration test suites for auth, catalogue browsing, cart, and checkout

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
GET /api/v1/products?partName=brake%20pad&vehicleMake=Toyota&vehicleModel=Camry&vehicleYear=2010&category=brake-system&minPriceKobo=1000000&maxPriceKobo=3000000&location=Lagos&sellerRating=4.5&sellerBusinessName=Prime&page=1&limit=10
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

## Database

- Money values are stored in kobo.
- Run `npm run migrate` to apply SQL files in `src/db/migrations`.
- Run `npm run seed` to load the sample catalogue data for local browsing.
- The current migration set creates the auth, catalogue, cart, buyer address, and order tables needed for Milestones A through C.
