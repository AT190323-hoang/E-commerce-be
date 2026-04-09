import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';
import { CartService } from '@/cart/cart.service';

describe('OrdersService', () => {
  let service: OrdersService;

  const prismaMock = {
    order: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const redisMock = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    delByPattern: jest.fn(),
    setIfNotExists: jest.fn(),
  };

  const cartServiceMock = {
    invalidateCartCache: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: RedisService,
          useValue: redisMock,
        },
        {
          provide: CartService,
          useValue: cartServiceMock,
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('should reject invalid order status transition', async () => {
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order-1',
      userId: 'user-1',
      status: 'PENDING',
      items: [],
    });

    await expect(
      service.updateStatus('order-1', { status: 'DELIVERED' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject checkout while same idempotency key is being processed', async () => {
    redisMock.get.mockResolvedValue(null);
    redisMock.setIfNotExists.mockResolvedValue(false);

    await expect(
      service.checkout(
        'user-1',
        { shippingAddress: 'address', phone: '0901' },
        'idem-123',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('should return existing order when idempotency result key exists', async () => {
    redisMock.get.mockResolvedValue('order-1');
    prismaMock.order.findUnique.mockResolvedValue({
      id: 'order-1',
      userId: 'user-1',
      status: 'PENDING',
      shippingAddress: 'address',
      phone: '0901',
      totalPrice: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
      statusUpdatedAt: new Date(),
      items: [],
    });

    const result = await service.checkout(
      'user-1',
      { shippingAddress: 'address', phone: '0901' },
      'idem-123',
    );

    expect(result.id).toBe('order-1');
    expect(redisMock.setIfNotExists).not.toHaveBeenCalled();
  });
});
