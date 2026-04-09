# E-commerce Backend (Personal Project)

This is a personal backend project I built to practice a realistic end-to-end e-commerce workflow, from authentication and cart checkout to payment webhooks and admin operations.

Project goals:

- Build clean, modular APIs with NestJS
- Work with a production-style data layer using Prisma + PostgreSQL
- Use Redis for cache and token/session state
- Handle payment callbacks with idempotency
- Maintain confidence with E2E regression tests

## 1) Tech Stack

- NestJS 11 (TypeScript)
- Prisma ORM
- PostgreSQL
- Redis
- AdminJS
- Swagger (OpenAPI)
- Jest + Supertest

## 2) Implemented Features

- Auth: register, login, refresh, logout (access + refresh JWT)
- Users: basic CRUD operations
- Categories + Products: CRUD, filtering, pagination
- Cart: add, update, remove, clear
- Orders: checkout, listing, detail, status updates
- Payments: payment initiation + VNPay return/IPN handling
- Reviews: product reviews allowed only after delivered orders
- Admin module: business stats + order management endpoints
- AdminJS dashboard for direct data operations

## 3) Module Structure

- `src/auth`: authentication and token lifecycle
- `src/users`: user and profile management
- `src/categories`, `src/products`: catalog domain
- `src/cart`, `src/orders`: shopping and order flow
- `src/payments`: payments, webhooks, retry processing
- `src/reviews`: reviews and rating flow
- `src/admin`: admin APIs
- `src/prisma`, `src/redis`: infrastructure services

## 4) Quick Start

### Requirements

- Node.js 20+
- npm 10+
- Docker Desktop

### Run Locally

```bash
npm install
docker-compose up -d
npx prisma migrate deploy
npm run db:seed
npm run start:dev
```

After startup:

- Swagger: http://localhost:3000/api-docs
- AdminJS: http://localhost:3000/admin

## 5) Environment Variables

Create a `.env` file:

```env
NODE_ENV=development
PORT=3000

DATABASE_URL=postgresql://postgres:123456@localhost:5432/ecommerce

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
BCRYPT_SALT=10

VNPAY_TMN_CODE=TMNCODE
VNPAY_HASH_SECRET=your_vnpay_hash_secret
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=http://localhost:3000/webhooks/vnpay/return

ADMINJS_EMAIL=admin@local.dev
ADMINJS_PASSWORD=admin123
ADMINJS_COOKIE_SECRET=change_me_cookie_secret
ADMINJS_SESSION_SECRET=change_me_session_secret

ADMIN_SEED_EMAIL=admin@local.dev
ADMIN_SEED_PASSWORD=Admin@123456
ADMIN_SEED_FULL_NAME=System Admin
ADMIN_SEED_PHONE=0900000000
ADMIN_SEED_ADDRESS=Head Office
```

Required variables for local run:

- `DATABASE_URL`
- `REDIS_HOST`, `REDIS_PORT`
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `BCRYPT_SALT`

Optional (only if testing payment/admin flows):

- `VNPAY_*`
- `ADMINJS_*`
- `ADMIN_SEED_*`

Quick pre-run checklist:

1. PostgreSQL is reachable from `DATABASE_URL`.
2. Redis is running on configured host/port.
3. `npx prisma migrate deploy` completed successfully.
4. `npm run db:seed` ran without errors.

## 6) Seed Data

The project includes an idempotent seed script at `prisma/seed.mjs` that:

- Upserts an admin user
- Upserts sample categories
- Upserts sample products

Run seed:

```bash
npm run db:seed
```

You can run it multiple times without creating duplicates.

## 7) Common Commands

```bash
# build
npm run build

# start in dev mode
npm run start:dev

# unit tests
npm run test

# e2e tests
npm run test:e2e
```

## 8) Main API Groups

- Auth: `/auth/*`
- Users: `/users/*`
- Categories: `/categories/*`
- Products: `/products/*`
- Cart: `/carts/*`
- Orders: `/orders/*`
- Payments: `/payments/*`
- VNPay webhooks: `/webhooks/vnpay/*`
- Reviews: `/reviews`, `/products/:productId/reviews`
- Admin: `/admin/*`

## 9) Admin Module (Sprint 4.2)

Admin endpoints (requires `ADMIN` role):

- `GET /admin/stats/revenue`
- `GET /admin/stats/orders`
- `GET /admin/products/top-selling`
- `GET /admin/orders`
- `PATCH /admin/orders/bulk-status`

AdminJS resources currently enabled:

- User
- Category
- Product
- Order
- Payment
- Review

## 10) Payment Notes (VNPay)

The project includes a helper command to generate signed payloads for local IPN testing:

```bash
npm run vnpay:sign -- <orderId> <externalId> <status> <amount> <currency>
```

Current behavior:

- Success: payment `PAID`, order `PAID`
- Failure: payment `FAILED`, order `CANCELLED`, stock is restored
- Duplicate IPN: safely ignored (idempotent handling)

## 11) E2E Status

Current test suites:

- `auth.e2e-spec.ts`
- `shopping.e2e-spec.ts`
- `errors.e2e-spec.ts`
- `reviews.e2e-spec.ts`
- `payments.e2e-spec.ts`

Latest regression run: all suites passed.

## 12) Key Learnings from This Project

- Domain-based modular structure scales better over time
- Redis token state makes auth lifecycle handling more practical
- Idempotency is critical for payment/webhook reliability
- E2E tests greatly reduce fear during refactoring
- Idempotent seed scripts save setup/demo time

## 13) Current Limitations / Next Improvements

- No dedicated seller role yet (multi-vendor not implemented)
- No read/write DB split or message queue integration
- No custom frontend admin dashboard yet (using AdminJS)
- Production-grade monitoring and alerting can be expanded

## 14) License

UNLICENSED
