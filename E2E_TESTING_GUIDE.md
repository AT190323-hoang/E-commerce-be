# E2E Testing Guide

## Prerequisites

- Node.js 20.x or higher
- Docker & Docker Compose installed
- PostgreSQL and Redis running (see setup below)

## Local Setup for E2E Tests

### Option 1: Using Docker Compose (Recommended)

```bash
# Start test services (PostgreSQL + Redis)
docker-compose -f docker-compose.test.yml up -d

# Create .env.test file with correct port mappings
cat > .env.test << EOF
NODE_ENV=test
DATABASE_URL=postgresql://test_user:test_password@localhost:5433/ecommerce_test
REDIS_HOST=localhost
REDIS_PORT=6380
JWT_ACCESS_SECRET=test_access_secret_key_12345
JWT_REFRESH_SECRET=test_refresh_secret_key_12345
BCRYPT_SALT=10
VNPAY_TMN_CODE=2CEX1U39
VNPAY_HASH_SECRET=test_hash_secret
VNPAY_API_URL=https://sandbox.vnpayment.vn
VNPAY_RETURN_URL=http://localhost:3000/payments/payment-return
LOG_LEVEL=debug
EOF

# Run migrations
npx prisma migrate deploy --skip-generate

# Run all E2E tests
npm run test:e2e

# Or run specific test suite
npm run test:e2e -- payments.e2e-spec.ts
npm run test:e2e -- auth.e2e-spec.ts
npm run test:e2e -- shopping.e2e-spec.ts
npm run test:e2e -- errors.e2e-spec.ts

# Stop services when done
docker-compose -f docker-compose.test.yml down
```

### Option 2: Using Development Containers

```bash
# Use main docker-compose (default ports 5432, 6379)
docker-compose up -d

# Create .env.test with main docker compose ports
cat > .env.test << EOF
NODE_ENV=test
DATABASE_URL=postgresql://postgres:123456@localhost:5432/ecommerce
REDIS_HOST=localhost
REDIS_PORT=6379
...other vars...
EOF

# Run migrations and tests
npx prisma migrate deploy --skip-generate
npm run test:e2e
```

## Running Tests

### All E2E Tests
```bash
npm run test:e2e
```

### Specific Test Suite
```bash
# Payment flow tests (VNPay integration)
npm run test:e2e -- payments.e2e-spec.ts

# Auth flow tests (register, login, JWT, refresh)
npm run test:e2e -- auth.e2e-spec.ts

# Shopping flow tests (cart, products, orders)
npm run test:e2e -- shopping.e2e-spec.ts

# Error handling tests (4xx/5xx responses)
npm run test:e2e -- errors.e2e-spec.ts
```

### Run with Debugging
```bash
# Run with verbose output
npm run test:e2e -- --verbose

# Run with coverage
npm run test:e2e -- --coverage

# Run single test
npm run test:e2e -- payments.e2e-spec.ts -t "should get VNPay payment link"
```

## Test Coverage

| Test Suite | File | Tests | Status |
|-----------|------|-------|--------|
| Payment Flow | `test/payments.e2e-spec.ts` | 11 | ✅ PASSING |
| Auth Flow | `test/auth.e2e-spec.ts` | 10 | ✅ Ready (Redis required) |
| Shopping Flow | `test/shopping.e2e-spec.ts` | 13 | ✅ Ready (Redis required) |
| Error Handling | `test/errors.e2e-spec.ts` | 11 | ✅ Ready (Redis required) |
| **Total** | - | **45** | - |

## Environment Variables for Testing

| Variable | Value | Purpose |
|----------|-------|---------|
| `NODE_ENV` | `test` | Activates test mode |
| `DATABASE_URL` | PostgreSQL connection string | Test database |
| `REDIS_HOST` | `localhost` | Redis test instance |
| `REDIS_PORT` | `6380` (test compose) or `6379` (dev) | Redis port |
| `JWT_ACCESS_SECRET` | Test secret key | JWT token generation |
| `JWT_REFRESH_SECRET` | Test secret key | Refresh token generation |
| `BCRYPT_SALT` | `10` | Password hashing for test users |
| `VNPAY_TMN_CODE` | `2CEX1U39` | VNPay test merchant code |
| `VNPAY_HASH_SECRET` | Test secret | VNPay HMAC validation |

## Troubleshooting

### Redis Connection Errors

**Error**: `MaxRetriesPerRequestError: Reached the max retries per request limit`

**Solutions**:
1. Check Redis is running: `docker ps | grep redis`
2. Verify Redis port: `redis-cli -h localhost -p 6380 ping` should return `PONG`
3. Check DATABASE_URL points to test database
4. Restart services: `docker-compose -f docker-compose.test.yml restart`

### Database Migration Errors

**Error**: `Can't reach database server`

**Solutions**:
1. Check PostgreSQL is running: `docker ps | grep postgres`
2. Verify connection string in .env.test
3. Wait for database to be ready before running migrations
4. Run: `npx prisma db push` to sync schema

### Port Already in Use

**Error**: `Port 5433 is already in use`

**Solutions**:
1. Stop conflicting container: `docker stop ecommerce-test-db`
2. Or check what's using the port: `lsof -i :5433`
3. Or modify ports in docker-compose.test.yml

## CI/CD Integration

Tests are automatically run on:
- **Push** to `main` or `develop` branches
- **Pull requests** targeting `main` or `develop`
- **Manual trigger** via Actions tab

See `.github/workflows/e2e-tests.yml` for CI/CD configuration.

### GitHub Actions Environment

The CI/CD pipeline:
1. Uses GitHub-hosted Ubuntu runner
2. Spins up PostgreSQL & Redis services
3. Builds the application
4. Runs Prisma migrations
5. Executes all E2E test suites in sequence
6. Uploads results as artifacts

Expected execution time: ~2-3 minutes for all test suites

## Test Structure

Each test suite:
- **Imports**: Supertest + NestJS testing module
- **Setup**: Creates test module with all dependencies
- **Teardown**: Closes database/Redis connections
- **Format**: Follows Arrange-Act-Assert pattern
- **Assertions**: Validates response status, headers, body structure

## Adding New E2E Tests

When adding new tests:

1. Create file: `test/feature.e2e-spec.ts`
2. Import test utilities:
```typescript
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '@/app.module';

describe('Feature E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should work', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/endpoint')
      .expect(200);
    
    expect(res.body).toBeDefined();
  });
});
```

3. Run: `npm run test:e2e -- feature.e2e-spec.ts`

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Supertest Guide](https://github.com/visionmedia/supertest)
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [Prisma Testing](https://www.prisma.io/docs/guides/testing)
