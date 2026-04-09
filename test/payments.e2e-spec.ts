import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '@/app.module';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';
import { createHmac } from 'crypto';

describe('Payments E2E - VNPay Flow', () => {
	let app: INestApplication<App>;
	let prisma: PrismaService;

	let userId: string;
	let accessToken: string;
	let productId: string;
	let orderId: string;
	let paymentId: string;
	let externalId: string;

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();

		app = moduleFixture.createNestApplication();
		app.useGlobalPipes(new ValidationPipe());
		await app.init();

		prisma = moduleFixture.get<PrismaService>(PrismaService);

		// Get Redis to clear cache
		const redisService = moduleFixture.get<RedisService>(RedisService);

		// Clean up Redis cache (clear all keys for auth)
		const cacheKey = `auth:user:email:payment-test@example.com`;
		await redisService.del(cacheKey);

		// Clean up test data
		await prisma.cartItem.deleteMany({});
		await prisma.cart.deleteMany({});
		await prisma.review.deleteMany({});
		await prisma.orderItem.deleteMany({});
		await prisma.payment.deleteMany({});
		await prisma.order.deleteMany({});
		await prisma.product.deleteMany({});
		await prisma.category.deleteMany({});
		await prisma.profile.deleteMany({});
		await prisma.user.deleteMany({});
	});

	afterAll(async () => {
		await app.close();
	});

	// Test 1: Register
	it('01. should register user', async () => {
		const res = await request(app.getHttpServer()).post('/auth/register').send({
			email: 'payment-test@example.com',
			password: 'Test123456',
		});

		userId = res.body.id;
		expect(userId).toBeDefined();
		expect(res.body.email).toBe('payment-test@example.com');
	});

	// Test 2: Login
	it('02. should login and get tokens', async () => {
		const res = await request(app.getHttpServer()).post('/auth/login').send({
			email: 'payment-test@example.com',
			password: 'Test123456',
		});

		accessToken = res.body.access_token;
		expect(accessToken).toBeDefined();
	});

	// Test 3: Create category & product
	it('03. should create product via DB', async () => {
		const category = await prisma.category.create({
			data: { name: 'Electronics Test' },
		});

		const product = await prisma.product.create({
			data: {
				name: 'Test Product',
				price: 150000,
				stock: 10,
				categoryId: category.id,
			},
		});

		productId = product.id;
		expect(productId).toBeDefined();
	});

	// Test 4: Add to cart
	it('04. should add product to cart', async () => {
		const res = await request(app.getHttpServer())
			.post(`/carts/${userId}/items`)
			.set('Authorization', `Bearer ${accessToken}`)
			.send({ productId, quantity: 1 });

		expect(res.status).toBeLessThan(400);
		expect(res.body.items).toBeDefined();
		expect(res.body.items.length).toBeGreaterThan(0);
	});

	// Test 5: Checkout
	it('05. should checkout to create order', async () => {
		const res = await request(app.getHttpServer())
			.post('/orders/checkout')
			.set('Authorization', `Bearer ${accessToken}`)
			.send({
				shippingAddress: 'Test Address',
				phone: '0901234567',
			});

		orderId = res.body.id;
		expect(res.status).toBeLessThan(400);
		expect(orderId).toBeDefined();
		expect(res.body.status).toBe('PENDING');
	});

	// Test 6: Initiate payment
	it('06. should initiate VNPay payment', async () => {
		const res = await request(app.getHttpServer())
			.post(`/payments/initiate/${orderId}`)
			.set('Authorization', `Bearer ${accessToken}`);

		paymentId = res.body.id;
		externalId = res.body.externalId;

		expect(res.status).toBeLessThan(400);
		expect(paymentId).toBeDefined();
		expect(externalId).toBeDefined();
		expect(res.body.paymentUrl).toContain('sandbox.vnpayment.vn');
	});

	// Test 7: Handle IPN success
	it('07. should handle VNPay IPN success callback', async () => {
		const hashSecret = process.env.VNPAY_HASH_SECRET!;
		const amount = 15000000;

		const paramsForSign: Record<string, string> = {
			vnp_Amount: String(amount),
			vnp_Command: 'pay',
			vnp_CreateDate: '20260402110000',
			vnp_CurrCode: 'VND',
			vnp_OrderInfo: `Thanh toan don hang ${orderId}`,
			vnp_OrderType: 'other',
			vnp_ResponseCode: '00',
			vnp_TmnCode: process.env.VNPAY_TMN_CODE!,
			vnp_TransactionStatus: '00',
			vnp_TxnRef: externalId,
			vnp_Version: '2.1.0',
		};

		// Sort and build sign data exactly like service does
		const sortedKeys = Object.keys(paramsForSign).sort();
		const signData = sortedKeys
			.map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(paramsForSign[k])}`)
			.join('&')
			.replace(/%20/g, '+');

		const secureHash = createHmac('sha512', hashSecret)
			.update(Buffer.from(signData, 'utf-8'))
			.digest('hex')
			.toLowerCase();

		const res = await request(app.getHttpServer())
			.get('/webhooks/vnpay/ipn')
			.query({ ...paramsForSign, vnp_SecureHash: secureHash });

		expect(res.body.RspCode).toBe('00');
	});

	// Test 8: Verify payment is PAID
	it('08. should verify payment status is PAID', async () => {
		const payment = await prisma.payment.findUnique({
			where: { id: paymentId },
		});

		expect(payment?.status).toBe('PAID');
	});

	// Test 9: Verify order is PAID
	it('09. should verify order status is PAID', async () => {
		const order = await prisma.order.findUnique({
			where: { id: orderId },
		});

		expect(order?.status).toBe('PAID');
	});

	// Test 10: Idempotent IPN
	it('10. should reject duplicate IPN', async () => {
		const hashSecret = process.env.VNPAY_HASH_SECRET!;
		const amount = 15000000;

		const paramsForSign: Record<string, string> = {
			vnp_Amount: String(amount),
			vnp_Command: 'pay',
			vnp_CreateDate: '20260402110000',
			vnp_CurrCode: 'VND',
			vnp_OrderInfo: `Thanh toan don hang ${orderId}`,
			vnp_OrderType: 'other',
			vnp_ResponseCode: '00',
			vnp_TmnCode: process.env.VNPAY_TMN_CODE!,
			vnp_TransactionStatus: '00',
			vnp_TxnRef: externalId,
			vnp_Version: '2.1.0',
		};

		const sortedKeys = Object.keys(paramsForSign).sort();
		const signData = sortedKeys
			.map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(paramsForSign[k])}`)
			.join('&')
			.replace(/%20/g, '+');

		const secureHash = createHmac('sha512', hashSecret)
			.update(Buffer.from(signData, 'utf-8'))
			.digest('hex')
			.toLowerCase();

		const res = await request(app.getHttpServer())
			.get('/webhooks/vnpay/ipn')
			.query({ ...paramsForSign, vnp_SecureHash: secureHash });

		expect(res.body.RspCode).toBe('02');
	});

	// Test 11: Invalid checksum
	it('11. should reject IPN with invalid checksum', async () => {
		const res = await request(app.getHttpServer())
			.get('/webhooks/vnpay/ipn')
			.query({
				vnp_Amount: '15000000',
				vnp_TxnRef: externalId,
				vnp_ResponseCode: '00',
				vnp_SecureHash: 'invalid_hash_xyz',
			});

		expect(res.body.RspCode).toBe('97');
	});
});
