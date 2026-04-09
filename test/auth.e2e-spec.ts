import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';

describe('Auth E2E - Auth Flow', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let redisService: RedisService;

  let userId: string;
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    redisService = moduleFixture.get<RedisService>(RedisService);

    // Clean up test data
    await redisService.del('auth:user:email:auth-test@example.com');
    await prisma.review.deleteMany({});
    await prisma.orderItem.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.cartItem.deleteMany({});
    await prisma.cart.deleteMany({});
    await prisma.profile.deleteMany({});
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    await app.close();
  });

  // Test 1: Register new user
  it('T1.1 should register new user with valid credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'auth-test@example.com',
        password: 'Password123456',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.email).toBe('auth-test@example.com');
    expect(res.body.role).toBe('USER');

    userId = res.body.id;
  });

  // Test 2: Reject duplicate email registration
  it('T1.2 should reject registration with duplicate email', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'auth-test@example.com',
        password: 'AnotherPass123',
      });

    expect(res.status).toBe(409);
    expect(res.body.error || res.body.message).toBeDefined();
    expect(res.body.message).toContain('Email already exists');
  });

  // Test 3: Login with correct credentials
  it('T1.3 should login successfully with correct credentials', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'auth-test@example.com',
        password: 'Password123456',
      });

    expect(res.status).toBe(201);
    expect(res.body.access_token).toBeDefined();
    expect(res.body.refresh_token).toBeDefined();

    // Verify JWT structure
    const tokenParts = res.body.access_token.split('.');
    expect(tokenParts).toHaveLength(3);

    // Decode and verify payload
    const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
    expect(payload.sub).toBe(userId);
    expect(payload.role).toBe('USER');
    expect(payload.type).toBe('access');

    accessToken = res.body.access_token;
    refreshToken = res.body.refresh_token;
  });

  // Test 4: Reject login with wrong password
  it('T1.4 should reject login with wrong password', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'auth-test@example.com',
        password: 'WrongPassword123',
      });

    expect(res.status).toBe(401);
    expect(res.body.error || res.body.message).toBeDefined();
    expect(res.body.message).toContain('Invalid credentials');
  });

  // Test 5: Reject login with non-existent email
  it('T1.5 should reject login with non-existent email', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'SomePassword123',
      });

    expect(res.status).toBe(401);
    expect(res.body.error || res.body.message).toBeDefined();
  });

  // Test 6: Access protected endpoint with valid token
  it('T1.6 should access protected endpoint with valid access token', async () => {
    const res = await request(app.getHttpServer())
      .get(`/users/${userId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(userId);
  });

  // Test 7: Reject access without token
  it('T1.7 should reject access to protected endpoint without token', async () => {
    const res = await request(app.getHttpServer()).get(`/users/${userId}`);

    expect(res.status).toBe(401);
    expect(res.body.error || res.body.message).toBeDefined();
  });

  // Test 8: Reject access with invalid token
  it('T1.8 should reject access with invalid/malformed token', async () => {
    const res = await request(app.getHttpServer())
      .get(`/users/${userId}`)
      .set('Authorization', 'Bearer invalid.token.format');

    expect(res.status).toBe(401);
    expect(res.body.error || res.body.message).toBeDefined();
  });

  // Test 9: Refresh token to get new access token
  it('T1.9 should refresh tokens and get new access token', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({
        refreshToken,
      });

    expect(res.status).toBe(201);
    expect(res.body.access_token).toBeDefined();
    expect(res.body.refresh_token).toBeDefined();

    // Verify refreshed access token is valid
    const newTokenParts = res.body.access_token.split('.');
    const newPayload = JSON.parse(Buffer.from(newTokenParts[1], 'base64').toString());
    expect(newPayload.sub).toBe(userId);

    accessToken = res.body.access_token;
    refreshToken = res.body.refresh_token;
  });

  // Test 10: Logout and invalidate tokens
  it('T1.10 should logout and invalidate tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        refreshToken,
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toContain('successful');

    // Verify token is invalidated
    const protectedRes = await request(app.getHttpServer())
      .get(`/users/${userId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(protectedRes.status).toBe(401);
  });
});
