import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';
import { CreateReviewDto } from './dto/create-review.dto';

const PRODUCT_LIST_CACHE_PREFIX = 'products:list:';
const PRODUCT_DETAIL_CACHE_PREFIX = 'products:detail:';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async create(userId: string, dto: CreateReviewDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      select: { id: true, isActive: true },
    });

    if (!product || !product.isActive) {
      throw new NotFoundException('Product not found');
    }

    const deliveredOrderItemCount = await this.prisma.orderItem.count({
      where: {
        productId: dto.productId,
        order: {
          userId,
          status: OrderStatus.DELIVERED,
        },
      },
    });

    if (deliveredOrderItemCount === 0) {
      throw new ForbiddenException(
        'You can only review products from delivered orders',
      );
    }

    try {
      const review = await this.prisma.review.create({
        data: {
          userId,
          productId: dto.productId,
          rating: dto.rating,
          comment: dto.comment,
        },
      });

      await this.invalidateProductCaches(dto.productId);
      return review;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('You already reviewed this product');
      }

      throw error;
    }
  }

  async findByProduct(productId: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, isActive: true },
    });

    if (!product || !product.isActive) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.review.findMany({
      where: { productId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async invalidateProductCaches(productId: string) {
    await this.redisService.del(`${PRODUCT_DETAIL_CACHE_PREFIX}${productId}`);
    await this.redisService.delByPattern(`${PRODUCT_LIST_CACHE_PREFIX}*`);
  }
}