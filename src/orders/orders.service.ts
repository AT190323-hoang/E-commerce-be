import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';
import { CartService } from '@/cart/cart.service';
import { Role } from '@/common/enums/role.enum';
import { CheckoutDto } from './dto/checkout.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderQueryDto } from './dto/order-query.dto';

const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['PAID', 'CANCELLED'],
  PAID: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

const CHECKOUT_IDEMPOTENCY_LOCK_TTL_SECONDS = 30;
const CHECKOUT_IDEMPOTENCY_RESULT_TTL_SECONDS = 60 * 60;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly cartService: CartService,
  ) {}

  async checkout(userId: string, dto: CheckoutDto, idempotencyKey?: string) {
    if (!idempotencyKey) {
      return this.processCheckout(userId, dto);
    }

    const resultKey = this.getCheckoutResultKey(userId, idempotencyKey);
    const lockKey = this.getCheckoutLockKey(userId, idempotencyKey);

    const cachedOrderId = await this.redisService.get<string>(resultKey);
    if (cachedOrderId) {
      return this.findOne(cachedOrderId, { sub: userId, role: Role.USER });
    }

    const locked = await this.redisService.setIfNotExists(
      lockKey,
      '1',
      CHECKOUT_IDEMPOTENCY_LOCK_TTL_SECONDS,
    );
    if (!locked) {
      throw new ConflictException('Checkout request is already processing');
    }

    try {
      const order = await this.processCheckout(userId, dto);

      await this.redisService.set(
        resultKey,
        order.id,
        CHECKOUT_IDEMPOTENCY_RESULT_TTL_SECONDS,
      );

      return order;
    } finally {
      await this.redisService.del(lockKey);
    }
  }

  private async processCheckout(userId: string, dto: CheckoutDto) {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      let totalPrice = 0;

      for (const item of cart.items) {
        const stockUpdate = await tx.product.updateMany({
          where: {
            id: item.productId,
            stock: { gte: item.quantity },
          },
          data: {
            stock: {
              decrement: item.quantity,
            },
          },
        });

        if (stockUpdate.count === 0) {
          throw new BadRequestException(
            `Product ${item.product.name} is out of stock`,
          );
        }

        totalPrice += item.quantity * item.product.price;
      }

      const order = await tx.order.create({
        data: {
          userId,
          shippingAddress: dto.shippingAddress,
          phone: dto.phone,
          status: 'PENDING',
          totalPrice,
          items: {
            createMany: {
              data: cart.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                price: item.product.price,
              })),
            },
          },
        },
      });

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return order;
    });

    await this.cartService.invalidateCartCache(userId);
    await this.redisService.delByPattern('products:list:*');
    for (const item of cart.items) {
      await this.redisService.del(`products:detail:${item.productId}`);
    }

    return this.findOne(result.id, { sub: userId, role: Role.USER });
  }

  async findAll(currentUser: { sub: string; role: Role }, query: OrderQueryDto) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 10);
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(currentUser.role === Role.ADMIN ? {} : { userId: currentUser.sub }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  imageUrl: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(orderId: string, currentUser: { sub: string; role: Role }) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (currentUser.role !== Role.ADMIN && currentUser.sub !== order.userId) {
      throw new ForbiddenException('You can only access your own orders');
    }

    return order;
  }

  async updateStatus(orderId: string, dto: UpdateOrderStatusDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const allowedStatuses = ORDER_TRANSITIONS[order.status];
    if (!allowedStatuses.includes(dto.status)) {
      throw new BadRequestException(
        `Invalid transition from ${order.status} to ${dto.status}`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.status === 'CANCELLED') {
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: {
                increment: item.quantity,
              },
            },
          });
        }
      }

      return tx.order.update({
        where: { id: orderId },
        data: {
          status: dto.status,
          statusUpdatedAt: new Date(),
        },
      });
    });

    await this.redisService.delByPattern('products:list:*');
    for (const item of order.items) {
      await this.redisService.del(`products:detail:${item.productId}`);
    }

    return this.findOne(updated.id, { sub: order.userId, role: Role.ADMIN });
  }

  private getCheckoutLockKey(userId: string, idempotencyKey: string) {
    return `orders:checkout:lock:${userId}:${idempotencyKey}`;
  }

  private getCheckoutResultKey(userId: string, idempotencyKey: string) {
    return `orders:checkout:result:${userId}:${idempotencyKey}`;
  }
}
