import { Test, TestingModule } from '@nestjs/testing';
import { createHmac } from 'crypto';
import { PaymentsService } from './payments.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';
import { PaymentStatus } from '@prisma/client';
import { PaymentMetricsService } from './payment-metrics.service';

describe('PaymentsService', () => {
  let service: PaymentsService;

  const prismaMock = {
    payment: {
      findFirst: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    order: {
      update: jest.fn(),
    },
    product: {
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const redisMock = {
    setIfNotExists: jest.fn(),
    delByPattern: jest.fn(),
  };

  const metricsMock = {
    recordReceived: jest.fn(),
    recordSucceeded: jest.fn(),
    recordFailed: jest.fn(),
    recordDuplicate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: RedisService,
          useValue: redisMock,
        },
        {
          provide: PaymentMetricsService,
          useValue: metricsMock,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    process.env.VNPAY_HASH_SECRET = 'test_hash_secret';
  });

  it('should return invalid checksum when secure hash is missing', async () => {
    const result = await service.handleVnpayIpn({});

    expect(result).toEqual({ RspCode: '97', Message: 'Invalid Checksum' });
  });

  it('should return order not found when payment is missing', async () => {
    const query = makeIpnQuery({
      txnRef: 'VNP_NOT_EXISTS',
      amount: '10000',
      responseCode: '00',
      transactionStatus: '00',
    });

    prismaMock.payment.findFirst.mockResolvedValue(null);

    const result = await service.handleVnpayIpn(query);

    expect(result).toEqual({ RspCode: '01', Message: 'Order not found' });
  });

  it('should process paid ipn successfully', async () => {
    const query = makeIpnQuery({
      txnRef: 'VNP_ABC123',
      amount: '10000',
      responseCode: '00',
      transactionStatus: '00',
    });

    prismaMock.payment.findFirst.mockResolvedValue({
      id: 'pay-1',
      externalId: 'VNP_ABC123',
      amount: 100,
      orderId: 'order-1',
      order: {
        id: 'order-1',
        status: 'PENDING',
        items: [],
      },
    });

    redisMock.setIfNotExists.mockResolvedValue(true);
    prismaMock.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        payment: { update: jest.fn() },
        order: { update: jest.fn() },
        product: { update: jest.fn() },
      };
      await cb(tx);
      return true;
    });

    const result = await service.handleVnpayIpn(query);

    expect(result).toEqual({ RspCode: '00', Message: 'Confirm Success' });
    expect(redisMock.delByPattern).toHaveBeenCalledWith('products:list:*');
  });

  it('should parse return payload correctly', async () => {
    const result = await service.parseVnpayReturn({
      vnp_ResponseCode: '00',
      vnp_TxnRef: 'VNP_ABC123',
      vnp_Amount: '10000',
      vnp_OrderInfo: 'Thanh toan don hang order-1',
      vnp_BankCode: 'NCB',
      vnp_TransactionNo: '1234567',
      vnp_PayDate: '20260402101010',
    });

    expect(result).toEqual({
      code: '00',
      txnRef: 'VNP_ABC123',
      amount: 100,
      orderInfo: 'Thanh toan don hang order-1',
      bankCode: 'NCB',
      transactionNo: '1234567',
      payDate: '20260402101010',
      message: 'Payment successful',
    });
  });
});

function makeIpnQuery({
  txnRef,
  amount,
  responseCode,
  transactionStatus,
}: {
  txnRef: string;
  amount: string;
  responseCode: string;
  transactionStatus: string;
}) {
  const params: Record<string, string> = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: 'TMNCODE',
    vnp_TxnRef: txnRef,
    vnp_Amount: amount,
    vnp_ResponseCode: responseCode,
    vnp_TransactionStatus: transactionStatus,
  };

  const signData = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');

  const vnp_SecureHash = createHmac('sha512', process.env.VNPAY_HASH_SECRET as string)
    .update(Buffer.from(signData, 'utf-8'))
    .digest('hex');

  return {
    ...params,
    vnp_SecureHash,
  };
}
