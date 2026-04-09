import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';
import { Prisma, Product } from '@prisma/client';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { PaginationParams } from '@/common/decorators/paginate.decorator';

const PRODUCT_LIST_CACHE_PREFIX = 'products:list:';
const PRODUCT_DETAIL_CACHE_PREFIX = 'products:detail:';
const PRODUCT_CACHE_TTL_SECONDS = 60 * 5;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async create(dto: CreateProductDto) {
    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const product = await this.prisma.product.create({
      data: {
        ...dto,
      },
    });

    await this.invalidateProductCaches(product.id);
    return {
      ...product,
      avgRating: null,
    };
  }

  async findAll(query: ProductQueryDto, pagination: PaginationParams) {
    const listParams = this.normalizeListParams(query, pagination);

    const cacheKey = `${PRODUCT_LIST_CACHE_PREFIX}${JSON.stringify(listParams.cacheQuery)}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const { limit, skip, categoryId } = listParams;
    const page = Math.floor(skip / limit) + 1;

    const sortConfig = this.resolveSort(query);

    const where = this.buildListWhere(query, categoryId);

    const orderBy: Prisma.ProductOrderByWithRelationInput = {
      [sortConfig.sortBy]: sortConfig.sortOrder,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    const ratedItems = await this.attachAverageRatings(items);

    const result = {
      items: ratedItems,
      page,
      limit,
      offset: skip,
      total,
      totalPages: Math.ceil(total / limit),
    };

    await this.redisService.set(cacheKey, result, PRODUCT_CACHE_TTL_SECONDS);
    return result;
  }

  private normalizeListParams(query: ProductQueryDto, pagination: PaginationParams) {
    const categoryId = query.categoryId ?? query.category;

    return {
      limit: pagination.limit,
      skip: pagination.offset,
      categoryId,
      cacheQuery: {
        ...query,
        categoryId,
        limit: String(pagination.limit),
        offset: String(pagination.offset),
      },
    };
  }

  private buildListWhere(
    query: ProductQueryDto,
    categoryId?: string,
  ): Prisma.ProductWhereInput {
    return {
      ...(query.search
        ? {
            name: {
              contains: query.search,
              mode: 'insensitive',
            },
          }
        : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(query.minPrice || query.maxPrice
        ? {
            price: {
              ...(query.minPrice ? { gte: Number(query.minPrice) } : {}),
              ...(query.maxPrice ? { lte: Number(query.maxPrice) } : {}),
            },
          }
        : {}),
    };
  }

  async findOne(id: string) {
    const cacheKey = `${PRODUCT_DETAIL_CACHE_PREFIX}${id}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const product = await this.prisma.product.findFirst({
      where: {
        id,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const rating = await this.prisma.review.aggregate({
      where: { productId: id },
      _avg: { rating: true },
    });

    const enriched = {
      ...product,
      avgRating: rating._avg.rating,
    };

    await this.redisService.set(cacheKey, enriched, PRODUCT_CACHE_TTL_SECONDS);
    return enriched;
  }

  async update(id: string, dto: UpdateProductDto) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
        select: { id: true },
      });

      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: dto,
    });

    await this.invalidateProductCaches(id);
    const rating = await this.prisma.review.aggregate({
      where: { productId: id },
      _avg: { rating: true },
    });

    return {
      ...updated,
      avgRating: rating._avg.rating,
    };
  }

  async remove(id: string) {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Product not found');
    }

    const removed = await this.prisma.product.delete({
      where: { id },
    });

    await this.invalidateProductCaches(id);
    return {
      ...removed,
      avgRating: null,
    };
  }

  private async attachAverageRatings(products: Product[]) {
    if (products.length === 0) {
      return [];
    }

    const ratings = await this.prisma.review.groupBy({
      by: ['productId'],
      where: {
        productId: {
          in: products.map((product) => product.id),
        },
      },
      _avg: {
        rating: true,
      },
    });

    const ratingMap = new Map(
      ratings.map((entry) => [entry.productId, entry._avg.rating]),
    );

    return products.map((product) => ({
      ...product,
      avgRating: ratingMap.get(product.id) ?? null,
    }));
  }

  private async invalidateProductCaches(productId: string) {
    await this.redisService.del(`${PRODUCT_DETAIL_CACHE_PREFIX}${productId}`);
    await this.redisService.delByPattern(`${PRODUCT_LIST_CACHE_PREFIX}*`);
  }

  private resolveSort(query: ProductQueryDto): {
    sortBy: 'createdAt' | 'price' | 'name';
    sortOrder: 'asc' | 'desc';
  } {
    if (query.sort) {
      const [sortBy, sortOrder] = query.sort.split('_');
      if (
        (sortBy === 'createdAt' || sortBy === 'price' || sortBy === 'name') &&
        (sortOrder === 'asc' || sortOrder === 'desc')
      ) {
        return { sortBy, sortOrder };
      }
    }

    return {
      sortBy: query.sortBy ?? 'createdAt',
      sortOrder: query.sortOrder ?? 'desc',
    };
  }
}
