import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';
import { RevenueStatsQueryDto } from './dto/revenue-stats-query.dto';
import { AdminOrdersQueryDto } from './dto/admin-orders-query.dto';
import { BulkUpdateOrderStatusDto } from './dto/bulk-update-order-status.dto';

const REVENUE_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
];

const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['PAID', 'CANCELLED'],
  PAID: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async getRevenueStats(query: RevenueStatsQueryDto) {
    const period = query.period ?? 'daily';
    const now = new Date();

    const startDate =
      period === 'monthly'
        ? this.subtractMonths(now, Number(query.months ?? 12))
        : this.subtractDays(now, Number(query.days ?? 30));

    const paidOrders = await this.prisma.order.findMany({
      where: {
        status: { in: REVENUE_STATUSES },
        createdAt: { gte: startDate },
      },
      select: {
        createdAt: true,
        totalPrice: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    const map = new Map<string, { revenue: number; orders: number }>();
    for (const order of paidOrders) {
      const label =
        period === 'monthly'
          ? this.formatMonthKey(order.createdAt)
          : this.formatDayKey(order.createdAt);

      const prev = map.get(label) ?? { revenue: 0, orders: 0 };
      map.set(label, {
        revenue: prev.revenue + order.totalPrice,
        orders: prev.orders + 1,
      });
    }

    return {
      period,
      points: Array.from(map.entries()).map(([label, value]) => ({
        label,
        revenue: Number(value.revenue.toFixed(2)),
        orders: value.orders,
      })),
    };
  }

  async getOrderStats() {
    const [totalOrders, paidOrdersAgg, allOrdersAgg] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.aggregate({
        where: { status: { in: REVENUE_STATUSES } },
        _count: true,
        _sum: { totalPrice: true },
      }),
      this.prisma.order.aggregate({
        _avg: { totalPrice: true },
        _sum: { totalPrice: true },
      }),
    ]);

    return {
      totalOrders,
      paidOrders: paidOrdersAgg._count,
      totalOrderValue: Number((allOrdersAgg._sum.totalPrice ?? 0).toFixed(2)),
      averageOrderValue: Number((allOrdersAgg._avg.totalPrice ?? 0).toFixed(2)),
    };
  }

  async getTopSellingProducts(limit = 10) {
    const grouped = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: {
          status: { in: REVENUE_STATUSES },
        },
      },
      _sum: {
        quantity: true,
        price: true,
      },
      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },
      take: limit,
    });

    const products = await this.prisma.product.findMany({
      where: {
        id: {
          in: grouped.map((item) => item.productId),
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    return grouped.map((item) => {
      const product = productMap.get(item.productId);
      return {
        productId: item.productId,
        name: product?.name ?? 'Unknown product',
        totalSold: item._sum.quantity ?? 0,
        revenue: Number((item._sum.price ?? 0).toFixed(2)),
      };
    });
  }

  async listOrders(query: AdminOrdersQueryDto) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));
    const skip = (page - 1) * limit;

    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...((query.fromDate || query.toDate)
        ? {
            createdAt: {
              ...(query.fromDate ? { gte: new Date(query.fromDate) } : {}),
              ...(query.toDate ? { lte: new Date(query.toDate) } : {}),
            },
          }
        : {}),
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

  async bulkUpdateOrderStatus(dto: BulkUpdateOrderStatusDto) {
    const orders = await this.prisma.order.findMany({
      where: {
        id: {
          in: dto.orderIds,
        },
      },
      include: {
        items: true,
      },
    });

    if (orders.length !== dto.orderIds.length) {
      throw new NotFoundException('One or more orders were not found');
    }

    for (const order of orders) {
      if (order.status === dto.status) {
        continue;
      }

      const allowed = ORDER_TRANSITIONS[order.status];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Invalid transition from ${order.status} to ${dto.status} for order ${order.id}`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      for (const order of orders) {
        if (order.status === dto.status) {
          continue;
        }

        if (dto.status === OrderStatus.CANCELLED && order.status === OrderStatus.PENDING) {
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

        await tx.order.update({
          where: { id: order.id },
          data: {
            status: dto.status,
            statusUpdatedAt: new Date(),
          },
        });
      }
    });

    await this.redisService.delByPattern('products:list:*');
    for (const order of orders) {
      for (const item of order.items) {
        await this.redisService.del(`products:detail:${item.productId}`);
      }
    }

    return {
      updatedCount: orders.length,
      status: dto.status,
    };
  }

  private subtractDays(date: Date, days: number) {
    const safeDays = Number.isFinite(days) && days > 0 ? days : 30;
    return new Date(date.getTime() - safeDays * 24 * 60 * 60 * 1000);
  }

  private subtractMonths(date: Date, months: number) {
    const safeMonths = Number.isFinite(months) && months > 0 ? months : 12;
    const result = new Date(date);
    result.setMonth(result.getMonth() - safeMonths);
    return result;
  }

  private formatDayKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatMonthKey(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
}
