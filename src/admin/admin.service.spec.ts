import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';

describe('AdminService', () => {
  let service: AdminService;

  const prismaMock = {
    order: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const redisMock = {
    delByPattern: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: RedisService,
          useValue: redisMock,
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  it('should throw NotFoundException when one or more order ids do not exist', async () => {
    prismaMock.order.findMany.mockResolvedValue([
      {
        id: '00000000-0000-4000-8000-000000000001',
        status: 'PENDING',
        items: [],
      },
    ]);

    await expect(
      service.bulkUpdateOrderStatus({
        orderIds: [
          '00000000-0000-4000-8000-000000000001',
          '00000000-0000-4000-8000-000000000002',
        ],
        status: 'PAID',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('should throw BadRequestException for invalid status transition', async () => {
    prismaMock.order.findMany.mockResolvedValue([
      {
        id: '00000000-0000-4000-8000-000000000001',
        status: 'PENDING',
        items: [],
      },
    ]);

    await expect(
      service.bulkUpdateOrderStatus({
        orderIds: ['00000000-0000-4000-8000-000000000001'],
        status: 'DELIVERED',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
