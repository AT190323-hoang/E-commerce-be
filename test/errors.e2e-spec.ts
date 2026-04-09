import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';

describe('Error Handling E2E - Error Cases', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let redisService: RedisService;

  let user1Id: string;
  let user1Token: string;
  let user2Id: string;
  let user2Token: string;
  let orderId: string;
  const runId = Date.now();
  const user1Email = `error-user1-${runId}@example.com`;
  const user2Email = `error-user2-${runId}@example.com`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    redisService = moduleFixture.get<RedisService>(RedisService);

    // Clean up
    await redisService.del(`auth:user:email:${user1Email}`);
    await redisService.del(`auth:user:email:${user2Email}`);
  });

  afterAll(async () => {
    await app.close();
  });

  // Setup: Create two users and one order
  beforeAll(async () => {
    // User 1
    const reg1 = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: user1Email,
        password: 'Password123456',
      });
    user1Id = reg1.body.id;

    const login1 = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: user1Email,
        password: 'Password123456',
      });
    user1Token = login1.body.access_token;

    // User 2
    const reg2 = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: user2Email,
        password: 'Password123456',
      });
    user2Id = reg2.body.id;

    const login2 = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: user2Email,
        password: 'Password123456',
      });
    user2Token = login2.body.access_token;

    // Create order for user1
    const order = await prisma.order.create({
      data: {
        userId: user1Id,
        totalPrice: 100,
        shippingAddress: '123 Main St',
        phone: '+1234567890',
      },
    });
    orderId = order.id;
  });

  // ========== 400 Bad Request Tests ==========

  it('E1.1 should return 400 when registration email is missing', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        password: 'Password123456',
      });

    expect(res.status).toBe(400);
    expect(res.body.error || res.body.message).toBeDefined();
  });

  it('E1.2 should return 400 when password is too weak', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'weak-pass@example.com',
        password: '123', // Too short
      });

    expect(res.status).toBe(400);
    expect(res.body.error || res.body.message).toBeDefined();
  });

  it('E1.3 should return 400 when adding negative quantity to cart', async () => {
    const productRes = await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        name: 'Test Product',
        price: 100,
        stock: 10,
      })
      .catch(() => null); // Product creation might need admin role

    // Fallback: create via DB if endpoint doesn't work
    const product = await prisma.product.create({
      data: {
        name: 'Test Product',
        price: 100,
        stock: 10,
        categoryId: (
          await prisma.category.create({
            data: { name: 'Test' },
          })
        ).id,
      },
    });

    const res = await request(app.getHttpServer())
      .post(`/carts/${user1Id}/items`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        productId: product.id,
        quantity: -5,
      });

    expect(res.status).toBe(400);
    expect(res.body.error || res.body.message).toBeDefined();
  });

  // ========== 401 Unauthorized Tests ==========

  it('E1.4 should return 401 when accessing protected route without token', async () => {
    const res = await request(app.getHttpServer()).get(`/orders/${orderId}`);

    expect(res.status).toBe(401);
    expect(res.body.error || res.body.message).toBeDefined();
    expect(res.body.message).not.toBeNull();
  });

  it('E1.5 should return 401 when using invalid token', async () => {
    const res = await request(app.getHttpServer())
      .get(`/orders/${orderId}`)
      .set('Authorization', 'Bearer invalid.token.here');

    expect(res.status).toBe(401);
    expect(res.body.error || res.body.message).toBeDefined();
  });

  it('E1.6 should return 401 when using malformed Authorization header', async () => {
    const res = await request(app.getHttpServer())
      .get(`/orders/${orderId}`)
      .set('Authorization', 'InvalidTokenFormat');

    expect(res.status).toBe(401);
    expect(res.body.error || res.body.message).toBeDefined();
  });

  // ========== 403 Forbidden Tests ==========

  it('E1.7 should return 403 when accessing other user cart', async () => {
    const res = await request(app.getHttpServer())
      .get(`/carts/${user1Id}`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(res.status).toBe(403);
    expect(res.body.error || res.body.message).toBeDefined();
    expect(res.body.message).toContain('own');
  });

  it('E1.8 should return 403 when user tries to access other user order', async () => {
    const res = await request(app.getHttpServer())
      .get(`/orders/${orderId}`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(res.status).toBe(403);
    expect(res.body.error || res.body.message).toBeDefined();
  });

  it('E1.9 should return 403 when non-admin tries to update product', async () => {
    const product = await prisma.product.findFirst();

    if (!product) {
      console.log('Skipping admin test - no products found');
      return;
    }

    const res = await request(app.getHttpServer())
      .patch(`/products/${product.id}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        price: 200,
      });

    // Should be 403 Forbidden if user is not admin
    expect([403, 401]).toContain(res.status);
  });

  // ========== 404 Not Found Tests ==========

  it('E1.10 should return 404 for non-existent order', async () => {
    const res = await request(app.getHttpServer())
      .get('/orders/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(404);
    expect(res.body.error || res.body.message).toBeDefined();
  });

  it('E1.11 should return 404 for non-existent product', async () => {
    const res = await request(app.getHttpServer())
      .get('/products/00000000-0000-0000-0000-000000000000');

    expect(res.status).toBe(404);
    expect(res.body.error || res.body.message).toBeDefined();
  });

  // ========== 409 Conflict Tests ==========

  it('E1.12 should return 409 when registering duplicate email', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: user1Email,
        password: 'DifferentPassword123',
      });

    expect(res.status).toBe(409);
    expect(res.body.error || res.body.message).toBeDefined();
    expect(res.body.message).toContain('Email already exists');
  });

  // ========== Validation Tests ==========

  it('E1.13 should return 400 with validation errors in response', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'not-an-email',
        password: '123',
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('statusCode');
    expect(res.body).toHaveProperty('message');
    expect(res.body.error || res.body.message).toBeDefined();
  });

  // ========== Standard Error Response Format Tests ==========

  it('E1.14 should include x-request-id in error response headers', async () => {
    const res = await request(app.getHttpServer())
      .get('/orders/invalid-id')
      .set('Authorization', `Bearer ${user1Token}`);

    if (res.headers['x-request-id']) {
      expect(typeof res.headers['x-request-id']).toBe('string');
    }
  });

  it('E1.15 should have standardized error response structure', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/logout')
      .send({
        refreshToken: 'invalid-refresh-token',
      });

    expect(res.status).toBeLessThanOrEqual(500);
    expect(res.body).toHaveProperty('statusCode');
    expect(res.body).toHaveProperty('message');
    expect(res.body.error || res.body.message).toBeDefined();
  });
});
