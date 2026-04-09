import {
	BadRequestException,
	ForbiddenException,
	Injectable,
	Logger,
	NotFoundException,
} from '@nestjs/common';
import { createHmac, randomUUID } from 'crypto';
import { PaymentRetryStatus, PaymentStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';
import { Role } from '@/common/enums/role.enum';
import { PaymentMetricsService } from './payment-metrics.service';

const VNPAY_VERSION = '2.1.0';
const VNPAY_COMMAND = 'pay';
const VNPAY_ORDER_TYPE = 'other';
const PAYMENT_METHOD = 'vnpay';
const WEBHOOK_EVENT_TTL_SECONDS = 24 * 60 * 60;
const RETRY_BACKOFF_MINUTES = [1, 5, 15];
const MAX_RETRY_ATTEMPTS = 3;

@Injectable()
export class PaymentsService {
	private readonly logger = new Logger(PaymentsService.name);

	constructor(
		private readonly prisma: PrismaService,
		private readonly redisService: RedisService,
		private readonly paymentMetricsService: PaymentMetricsService,
	) {}

	async initiate(
		orderId: string,
		currentUser: { sub: string; role: Role },
		clientIp: string,
	) {
		const order = await this.prisma.order.findUnique({
			where: { id: orderId },
			include: { payment: true },
		});

		if (!order) {
			throw new NotFoundException('Order not found');
		}

		if (currentUser.role !== Role.ADMIN && currentUser.sub !== order.userId) {
			throw new ForbiddenException('You can only initiate payment for your own order');
		}

		if (order.status !== 'PENDING') {
			throw new BadRequestException('Only pending orders can be paid');
		}

		const tmnCode = this.getRequiredEnv('VNPAY_TMN_CODE');
		const hashSecret = this.getRequiredEnv('VNPAY_HASH_SECRET');
		const payUrl = this.getRequiredEnv('VNPAY_URL');
		const returnUrl = this.getRequiredEnv('VNPAY_RETURN_URL');

		const txnRef = order.payment?.externalId ?? `VNP_${randomUUID().replace(/-/g, '')}`;
		const amount = Math.round(order.totalPrice);
		const createDate = this.formatDate(new Date());
		const expireDate = this.formatDate(new Date(Date.now() + 15 * 60 * 1000));

		const payment = await this.prisma.payment.upsert({
			where: { orderId },
			create: {
				orderId,
				amount,
				currency: 'VND',
				status: PaymentStatus.PENDING,
				method: PAYMENT_METHOD,
				externalId: txnRef,
			},
			update: {
				amount,
				currency: 'VND',
				status: PaymentStatus.PENDING,
				method: PAYMENT_METHOD,
				externalId: txnRef,
			},
		});

		const baseParams: Record<string, string> = {
			vnp_Version: VNPAY_VERSION,
			vnp_Command: VNPAY_COMMAND,
			vnp_TmnCode: tmnCode,
			vnp_Locale: process.env.VNPAY_LOCALE ?? 'vn',
			vnp_CurrCode: 'VND',
			vnp_TxnRef: txnRef,
			vnp_OrderInfo: `Thanh toan don hang ${order.id}`,
			vnp_OrderType: VNPAY_ORDER_TYPE,
			vnp_Amount: String(amount * 100),
			vnp_ReturnUrl: returnUrl,
			vnp_IpAddr: this.normalizeIp(clientIp),
			vnp_CreateDate: createDate,
			vnp_ExpireDate: expireDate,
		};

		const sortedParams = this.sortParams(baseParams);
		const signData = this.buildVnpayQueryString(sortedParams);
		const secureHash = createHmac('sha512', hashSecret)
			.update(Buffer.from(signData, 'utf-8'))
			.digest('hex');

		const paymentUrl = `${payUrl}?${this.buildVnpayQueryString(
			{
				...sortedParams,
				vnp_SecureHash: secureHash,
			},
		)}`;

		return {
			id: payment.id,
			orderId: payment.orderId,
			status: payment.status,
			amount: payment.amount,
			currency: payment.currency,
			method: payment.method,
			externalId: payment.externalId,
			paymentUrl,
		};
	}

	async findOne(paymentId: string, currentUser: { sub: string; role: Role }) {
		const payment = await this.prisma.payment.findUnique({
			where: { id: paymentId },
			include: {
				order: {
					select: {
						userId: true,
					},
				},
			},
		});

		if (!payment) {
			throw new NotFoundException('Payment not found');
		}

		if (currentUser.role !== Role.ADMIN && currentUser.sub !== payment.order.userId) {
			throw new ForbiddenException('You can only view your own payment');
		}

		return {
			id: payment.id,
			orderId: payment.orderId,
			status: payment.status,
			amount: payment.amount,
			currency: payment.currency,
			method: payment.method,
			externalId: payment.externalId,
			createdAt: payment.createdAt,
			updatedAt: payment.updatedAt,
		};
	}

	async handleVnpayIpn(query: Record<string, string | string[] | undefined>) {
		const requestId = randomUUID();
		const startedAt = Date.now();
		const secureHash = this.readSingleQueryParam(query.vnp_SecureHash);
		this.paymentMetricsService.recordReceived();
		
		this.logger.log(
			`[${requestId}] VNPay IPN received - TxnRef: ${query.vnp_TxnRef}, Amount: ${query.vnp_Amount}`,
		);

		if (!secureHash) {
			this.logger.warn(`[${requestId}] Missing checksum`);
			this.paymentMetricsService.recordFailed(Date.now() - startedAt);
			return { RspCode: '97', Message: 'Invalid Checksum' };
		}

		const paramsForSign: Record<string, string> = {};
		for (const [key, value] of Object.entries(query)) {
			if (key === 'vnp_SecureHash' || key === 'vnp_SecureHashType') {
				continue;
			}

			const parsed = this.readSingleQueryParam(value);
			if (parsed !== undefined) {
				paramsForSign[key] = parsed;
			}
		}

		const hashSecret = this.getRequiredEnv('VNPAY_HASH_SECRET');
		const signData = this.buildVnpayQueryString(this.sortParams(paramsForSign));
		const expectedHash = createHmac('sha512', hashSecret)
			.update(Buffer.from(signData, 'utf-8'))
			.digest('hex');

		const checksumValid = expectedHash.toLowerCase() === secureHash.toLowerCase();
		this.logger.log(
			`[${requestId}] Checksum validation: ${checksumValid ? 'SUCCESS' : 'FAILED'}`,
		);

		if (!checksumValid) {
			this.logger.warn(
				`[${requestId}] Checksum mismatch - Expected: ${expectedHash}, Got: ${secureHash}`,
			);
			this.paymentMetricsService.recordFailed(Date.now() - startedAt);
			return { RspCode: '97', Message: 'Invalid Checksum' };
		}

		const txnRef = paramsForSign.vnp_TxnRef;
		const responseCode = paramsForSign.vnp_ResponseCode;
		const transactionStatus = paramsForSign.vnp_TransactionStatus;
		const rawAmount = Number(paramsForSign.vnp_Amount ?? '0');

		if (!txnRef) {
			this.logger.warn(`[${requestId}] Missing TxnRef`);
			this.paymentMetricsService.recordFailed(Date.now() - startedAt);
			return { RspCode: '01', Message: 'Order not found' };
		}

		const payment = await this.prisma.payment.findFirst({
			where: { externalId: txnRef },
			include: {
				order: {
					include: {
						items: true,
					},
				},
			},
		});

		if (!payment) {
			this.logger.warn(`[${requestId}] Payment not found for TxnRef: ${txnRef}`);
			this.paymentMetricsService.recordFailed(Date.now() - startedAt);
			return { RspCode: '01', Message: 'Order not found' };
		}

		if (rawAmount !== payment.amount * 100) {
			this.logger.error(
				`[${requestId}] Amount mismatch - Expected: ${payment.amount * 100}, Got: ${rawAmount}`,
			);
			this.paymentMetricsService.recordFailed(Date.now() - startedAt);
			return { RspCode: '04', Message: 'Invalid amount' };
		}

		const eventKey = `payments:vnpay:ipn:${txnRef}:${responseCode}:${transactionStatus}`;
		const accepted = await this.redisService.setIfNotExists(
			eventKey,
			'1',
			WEBHOOK_EVENT_TTL_SECONDS,
		);

		if (!accepted) {
			this.logger.log(`[${requestId}] Duplicate IPN - already processed`);
			this.paymentMetricsService.recordDuplicate();
			this.paymentMetricsService.recordSucceeded(Date.now() - startedAt);
			return { RspCode: '02', Message: 'Order already confirmed' };
		}

		const isPaid = responseCode === '00' && transactionStatus === '00';

		this.logger.log(
			`[${requestId}] Processing payment - ResponseCode: ${responseCode}, TransactionStatus: ${transactionStatus}, IsPaid: ${isPaid}`,
		);

		try {
			await this.processPaymentTransition(payment, paramsForSign, requestId);
			await this.redisService.delByPattern('products:list:*');
			this.paymentMetricsService.recordSucceeded(Date.now() - startedAt);
			this.logger.log(`[${requestId}] IPN processing completed successfully`);
			return { RspCode: '00', Message: 'Confirm Success' };
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			this.logger.error(`[${requestId}] IPN processing failed. Queuing retry: ${message}`);
			this.paymentMetricsService.recordFailed(Date.now() - startedAt);

			await this.enqueueRetry(payment.id, eventKey, paramsForSign, message);
			return { RspCode: '00', Message: 'Confirm Success' };
		}
	}

	async processPendingRetries(limit = 20) {
		const pendingLogs = await this.prisma.paymentRetryLog.findMany({
			where: {
				status: PaymentRetryStatus.PENDING,
				nextRetryAt: { lte: new Date() },
			},
			orderBy: { nextRetryAt: 'asc' },
			take: limit,
		});

		let processed = 0;
		for (const log of pendingLogs) {
			const lockKey = `payments:retry:lock:${log.id}`;
			const locked = await this.redisService.setIfNotExists(lockKey, '1', 30);
			if (!locked) {
				continue;
			}

			try {
				await this.processRetryLog(log.id);
				processed += 1;
			} finally {
				await this.redisService.del(lockKey);
			}
		}

		return { processed, totalCandidates: pendingLogs.length };
	}

	async processRetryLog(retryLogId: string) {
		const retryLog = await this.prisma.paymentRetryLog.findUnique({
			where: { id: retryLogId },
			include: {
				payment: {
					include: {
						order: {
							include: {
								items: true,
							},
						},
					},
				},
			},
		});

		if (!retryLog || retryLog.status !== PaymentRetryStatus.PENDING) {
			return;
		}

		const payload = retryLog.payload as Record<string, string>;
		const attemptNumber = retryLog.attemptCount + 1;

		await this.prisma.paymentRetryLog.update({
			where: { id: retryLog.id },
			data: {
				status: PaymentRetryStatus.PROCESSING,
				attemptCount: attemptNumber,
			},
		});

		const requestId = randomUUID();
		const startedAt = Date.now();
		this.logger.log(
			`[${requestId}] Processing IPN retry ${attemptNumber}/${MAX_RETRY_ATTEMPTS} for txnRef ${retryLog.txnRef}`,
		);

		try {
			await this.processPaymentTransition(retryLog.payment, payload, requestId);

			await this.prisma.paymentRetryLog.update({
				where: { id: retryLog.id },
				data: {
					status: PaymentRetryStatus.SUCCEEDED,
					processedAt: new Date(),
					lastError: null,
				},
			});

			await this.redisService.delByPattern('products:list:*');
			this.paymentMetricsService.recordSucceeded(Date.now() - startedAt);
			this.logger.log(`[${requestId}] Retry succeeded for txnRef ${retryLog.txnRef}`);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			const canRetry = attemptNumber < MAX_RETRY_ATTEMPTS;

			await this.prisma.paymentRetryLog.update({
				where: { id: retryLog.id },
				data: canRetry
					? {
						status: PaymentRetryStatus.PENDING,
						nextRetryAt: this.getNextRetryAt(attemptNumber + 1),
						lastError: message,
					  }
					: {
						status: PaymentRetryStatus.FAILED_PERMANENT,
						processedAt: new Date(),
						lastError: message,
					  },
			});

			this.logger.error(
				`[${requestId}] Retry ${attemptNumber} failed for txnRef ${retryLog.txnRef}: ${message}`,
			);
			this.paymentMetricsService.recordFailed(Date.now() - startedAt);
		}
	}

	async parseVnpayReturn(query: Record<string, string | string[] | undefined>) {
		const params: Record<string, string> = {};
		for (const [key, value] of Object.entries(query)) {
			const parsed = this.readSingleQueryParam(value);
			if (parsed !== undefined) {
				params[key] = parsed;
			}
		}

		return {
			code: params.vnp_ResponseCode ?? null,
			txnRef: params.vnp_TxnRef ?? null,
			amount: params.vnp_Amount ? Number(params.vnp_Amount) / 100 : null,
			orderInfo: params.vnp_OrderInfo ?? null,
			bankCode: params.vnp_BankCode ?? null,
			transactionNo: params.vnp_TransactionNo ?? null,
			payDate: params.vnp_PayDate ?? null,
			message:
				params.vnp_ResponseCode === '00'
					? 'Payment successful'
					: 'Payment failed or cancelled',
		};
	}

	private getRequiredEnv(name: string): string {
		const value = process.env[name];
		if (!value) {
			throw new BadRequestException(`${name} is not configured`);
		}

		return value;
	}

	private formatDate(date: Date) {
		const yyyy = date.getFullYear();
		const mm = String(date.getMonth() + 1).padStart(2, '0');
		const dd = String(date.getDate()).padStart(2, '0');
		const hh = String(date.getHours()).padStart(2, '0');
		const mi = String(date.getMinutes()).padStart(2, '0');
		const ss = String(date.getSeconds()).padStart(2, '0');

		return `${yyyy}${mm}${dd}${hh}${mi}${ss}`;
	}

	private buildVnpayQueryString(params: Record<string, string>): string {
		return Object.entries(params)
			.map(([key, value]) => {
				return `${this.vnpayEncode(key)}=${this.vnpayEncode(value)}`;
			})
			.join('&');
	}

	private vnpayEncode(value: string) {
		return encodeURIComponent(value).replace(/%20/g, '+');
	}

	private sortParams(params: Record<string, string>): Record<string, string> {
		return Object.keys(params)
			.sort()
			.reduce<Record<string, string>>((result, key) => {
				result[key] = params[key];
				return result;
			}, {});
	}

	private normalizeIp(clientIp: string) {
		if (!clientIp) {
			return '127.0.0.1';
		}

		if (clientIp.includes(',')) {
			return clientIp.split(',')[0].trim();
		}

		return clientIp.trim();
	}

	private readSingleQueryParam(
		value: string | string[] | undefined,
	): string | undefined {
		if (Array.isArray(value)) {
			return value[0];
		}

		return value;
	}

	private async processPaymentTransition(
		payment: {
			id: string;
			orderId: string;
			order: { status: string; items: { productId: string; quantity: number }[] };
		},
		paramsForSign: Record<string, string>,
		requestId: string,
	) {
		const responseCode = paramsForSign.vnp_ResponseCode;
		const transactionStatus = paramsForSign.vnp_TransactionStatus;
		const isPaid = responseCode === '00' && transactionStatus === '00';

		await this.prisma.$transaction(async (tx) => {
			if (isPaid) {
				await tx.payment.update({
					where: { id: payment.id },
					data: {
						status: PaymentStatus.PAID,
						metadata: this.buildPaymentMetadata(paramsForSign),
					},
				});

				if (payment.order.status === 'PENDING') {
					await tx.order.update({
						where: { id: payment.orderId },
						data: {
							status: 'PAID',
							statusUpdatedAt: new Date(),
						},
					});
				}

				this.logger.log(`[${requestId}] Payment marked as PAID`);
				return;
			}

			await tx.payment.update({
				where: { id: payment.id },
				data: {
					status: PaymentStatus.FAILED,
					metadata: this.buildPaymentMetadata(paramsForSign),
				},
			});

			if (payment.order.status === 'PENDING') {
				for (const item of payment.order.items) {
					await tx.product.update({
						where: { id: item.productId },
						data: {
							stock: {
								increment: item.quantity,
							},
						},
					});
				}

				await tx.order.update({
					where: { id: payment.orderId },
					data: {
						status: 'CANCELLED',
						statusUpdatedAt: new Date(),
					},
				});
			}

			this.logger.log(`[${requestId}] Payment marked as FAILED`);
		});
	}

	private buildPaymentMetadata(paramsForSign: Record<string, string>) {
		return {
			vnp_ResponseCode: paramsForSign.vnp_ResponseCode,
			vnp_TransactionStatus: paramsForSign.vnp_TransactionStatus,
			vnp_PayDate: paramsForSign.vnp_PayDate,
			vnp_BankCode: paramsForSign.vnp_BankCode,
			vnp_TransactionNo: paramsForSign.vnp_TransactionNo,
		};
	}

	private async enqueueRetry(
		paymentId: string,
		eventKey: string,
		payload: Record<string, string>,
		errorMessage: string,
	) {
		await this.prisma.paymentRetryLog.upsert({
			where: { eventKey },
			create: {
				paymentId,
				eventKey,
				txnRef: payload.vnp_TxnRef ?? 'UNKNOWN',
				responseCode: payload.vnp_ResponseCode ?? 'UNKNOWN',
				transactionStatus: payload.vnp_TransactionStatus ?? 'UNKNOWN',
				payload,
				attemptCount: 0,
				status: PaymentRetryStatus.PENDING,
				nextRetryAt: this.getNextRetryAt(1),
				lastError: errorMessage,
			},
			update: {
				status: PaymentRetryStatus.PENDING,
				lastError: errorMessage,
				nextRetryAt: this.getNextRetryAt(1),
			},
		});
	}

	private getNextRetryAt(retryAttempt: number): Date {
		const delayMinutes = RETRY_BACKOFF_MINUTES[Math.max(0, retryAttempt - 1)] ?? 15;
		return new Date(Date.now() + delayMinutes * 60 * 1000);
	}
}
