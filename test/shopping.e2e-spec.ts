import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';

describe('Shopping E2E - Shopping Flow', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let redisService: RedisService;

  let userId: string;
  let accessToken: string;
  let productId: string;
  let categoryId: string;
  let orderId: string;

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
    await redisService.del('auth:user:email:shopping-test@example.com');
    await prisma.cartItem.deleteMany({});
    await prisma.cart.deleteMany({});
    await prisma.review.deleteMany({});
    await prisma.orderItem.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.user.deleteMany({});
  });

  afterAll(async () => {
    await app.close();
  });

  // Test 1: Register user
  it('S1.1 should register user for shopping', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'shopping-test@example.com',
        password: 'Password123456',
      });

    expect(res.status).toBe(201);
    userId = res.body.id;
  });

  // Test 2: Login user
  it('S1.2 should login user', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'shopping-test@example.com',
        password: 'Password123456',
      });

    expect(res.status).toBe(201);
    accessToken = res.body.access_token;
  });

  // Test 3: Create category
  it('S1.3 should create category via DB', async () => {
    const category = await prisma.category.create({
      data: { name: 'Electronics' },
    });

    categoryId = category.id;
    expect(categoryId).toBeDefined();
  });

  // Test 4: Create product
  it('S1.4 should create product via DB', async () => {
    const product = await prisma.product.create({
      data: {
        name: 'Test Laptop',
        price: 999.99,
        stock: 5,
        categoryId,
      },
    });

    productId = product.id;
    expect(productId).toBeDefined();
    expect(product.stock).toBe(5);
  });

  // Test 5: Add product to cart
  it('S1.5 should add product to cart', async () => {
    const res = await request(app.getHttpServer())
      .post(`/carts/${userId}/items`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        productId,
        quantity: 2,
      });

    expect(res.status).toBe(201);
    expect(res.body.items).toBeDefined();
    expect(res.body.items.length).toBeGreaterThan(0);
    expect(res.body.totalItems).toBe(2);
    expect(res.body.totalAmount).toBe(999.99 * 2);
  });

  // Test 6: View cart
  it('S1.6 should retrieve cart', async () => {
    const res = await request(app.getHttpServer())
      .get(`/carts/${userId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toBeDefined();
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].quantity).toBe(2);
  });

  // Test 7: Update cart item quantity
  it('S1.7 should update cart item quantity', async () => {
    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: { items: true },
    });

    expect(cart).toBeDefined();
    expect(cart?.items?.length).toBeGreaterThan(0);
    const cartItemId = cart!.items[0].id;

    const res = await request(app.getHttpServer())
      .patch(`/carts/${userId}/items/${cartItemId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        quantity: 3,
      });

    expect(res.status).toBe(200);
    expect(res.body.totalItems).toBe(3);
  });

  // Test 8: Checkout to create order
  it('S1.8 should checkout and create order with PENDING status', async () => {
    const res = await request(app.getHttpServer())
      .post('/orders/checkout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        shippingAddress: '123 Main St, Test City',
        phone: '+1234567890',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('PENDING');
    expect(res.body.totalPrice).toBeCloseTo(999.99 * 3, 2);
    expect(res.body.items).toBeDefined();
    expect(res.body.items.length).toBe(1);

    orderId = res.body.id;
  });

  // Test 9: Verify cart is cleared after checkout
  it('S1.9 should clear cart after successful checkout', async () => {
    const res = await request(app.getHttpServer())
      .get(`/carts/${userId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toBeDefined();
    expect(res.body.items.length).toBe(0);
  });

  // Test 10: Verify stock is decreased after checkout
  it('S1.10 should decrease product stock after checkout', async () => {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    expect(product).toBeDefined();
    expect(product!.stock).toBe(2); // 5 - 3 items purchased
  });

  // Test 11: Retrieve created order
  it('S1.11 should retrieve order with details', async () => {
    const res = await request(app.getHttpServer())
      .get(`/orders/${orderId}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(orderId);
    expect(res.body.status).toBe('PENDING');
    expect(res.body.userId).toBe(userId);
    expect(res.body.shippingAddress).toBe('123 Main St, Test City');
    expect(res.body.phone).toBe('+1234567890');
  });

  // Test 12: List user's orders
  it('S1.12 should list user orders', async () => {
    const res = await request(app.getHttpServer())
      .get('/orders?limit=10&offset=0')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items || res.body.data || res.body)).toBe(true);
    const orders = res.body.items || res.body.data || res.body;
    expect(orders.length).toBeGreaterThan(0);
    expect(orders.find((o: any) => o.id === orderId)).toBeDefined();
  });

  // Test 13: Cannot checkout with empty cart
  it('S1.13 should reject checkout with empty cart', async () => {
    // Create another user
    const regRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'empty-cart-test@example.com',
        password: 'Password123456',
      });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'empty-cart-test@example.com',
        password: 'Password123456',
      });

    const res = await request(app.getHttpServer())
      .post('/orders/checkout')
      .set('Authorization', `Bearer ${loginRes.body.access_token}`)
      .send({
        shippingAddress: '123 Main St',
        phone: '+1234567890',
      });

    expect(res.status).toBe(400);
    expect(res.body.error || res.body.message).toBeDefined();
    expect(res.body.message).toContain('empty');
  });
});
