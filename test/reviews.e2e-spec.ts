import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';

describe('Reviews E2E - Review Flow', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let redisService: RedisService;

  let productId: string;
  let user1Id: string;
  let user1Token: string;
  let user2Id: string;
  let user2Token: string;

  const runId = Date.now();
  const user1Email = `review-user1-${runId}@example.com`;
  const user2Email = `review-user2-${runId}@example.com`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    redisService = moduleFixture.get<RedisService>(RedisService);

    await redisService.del(`auth:user:email:${user1Email}`);
    await redisService.del(`auth:user:email:${user2Email}`);

    await prisma.review.deleteMany({});
    await prisma.orderItem.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.cartItem.deleteMany({});
    await prisma.cart.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.profile.deleteMany({});
    await prisma.user.deleteMany({});

    const category = await prisma.category.create({
      data: { name: `Review Category ${runId}` },
    });

    const product = await prisma.product.create({
      data: {
        name: `Review Product ${runId}`,
        price: 120,
        stock: 50,
        categoryId: category.id,
      },
    });

    productId = product.id;

    const user1 = await registerAndLogin(app, user1Email);
    user1Id = user1.userId;
    user1Token = user1.accessToken;

    const user2 = await registerAndLogin(app, user2Email);
    user2Id = user2.userId;
    user2Token = user2.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('R1 should reject review when user has no delivered order', async () => {
    const res = await request(app.getHttpServer())
      .post('/reviews')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        productId,
        rating: 5,
        comment: 'Great product',
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('delivered orders');
  });

  it('R2 should allow review after delivered order', async () => {
    await createDeliveredOrder(prisma, user1Id, productId, 1, 120);

    const res = await request(app.getHttpServer())
      .post('/reviews')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        productId,
        rating: 5,
        comment: 'Worth the price',
      });

    expect(res.status).toBe(201);
    expect(res.body.productId).toBe(productId);
    expect(res.body.rating).toBe(5);
  });

  it('R3 should reject duplicate review for same user and product', async () => {
    const res = await request(app.getHttpServer())
      .post('/reviews')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        productId,
        rating: 4,
        comment: 'Second attempt',
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toContain('already reviewed');
  });

  it('R4 should list product reviews publicly', async () => {
    await createDeliveredOrder(prisma, user2Id, productId, 1, 120);

    await request(app.getHttpServer())
      .post('/reviews')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({
        productId,
        rating: 3,
        comment: 'Average experience',
      })
      .expect(201);

    const res = await request(app.getHttpServer()).get(`/products/${productId}/reviews`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it('R5 should reflect avgRating on product detail and list', async () => {
    const detailRes = await request(app.getHttpServer()).get(`/products/${productId}`);

    expect(detailRes.status).toBe(200);
    expect(detailRes.body.avgRating).toBeCloseTo(4, 5);

    const listRes = await request(app.getHttpServer())
      .get('/products')
      .query({ search: `Review Product ${runId}` });

    expect(listRes.status).toBe(200);
    const product = (listRes.body.items || []).find((item: any) => item.id === productId);
    expect(product).toBeDefined();
    expect(product.avgRating).toBeCloseTo(4, 5);
  });
});

async function registerAndLogin(app: INestApplication<App>, email: string) {
  const registerRes = await request(app.getHttpServer()).post('/auth/register').send({
    email,
    password: 'Password123456',
  });

  const loginRes = await request(app.getHttpServer()).post('/auth/login').send({
    email,
    password: 'Password123456',
  });

  return {
    userId: registerRes.body.id as string,
    accessToken: loginRes.body.access_token as string,
  };
}

async function createDeliveredOrder(
  prisma: PrismaService,
  userId: string,
  productId: string,
  quantity: number,
  price: number,
) {
  return prisma.order.create({
    data: {
      userId,
      totalPrice: quantity * price,
      status: 'DELIVERED',
      shippingAddress: 'Review street',
      phone: '0900000000',
      items: {
        create: {
          productId,
          quantity,
          price,
        },
      },
    },
  });
}
