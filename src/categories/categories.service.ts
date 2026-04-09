import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

const CATEGORIES_CACHE_KEY = 'categories:list';
const CATEGORY_CACHE_PREFIX = 'categories:detail:';
const CATEGORY_CACHE_TTL_SECONDS = 60 * 10;

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async create(dto: CreateCategoryDto) {
    const existed = await this.prisma.category.findFirst({
      where: { name: dto.name },
      select: { id: true },
    });

    if (existed) {
      throw new ConflictException('Category name already exists');
    }

    const category = await this.prisma.category.create({
      data: dto,
    });

    await this.invalidateCategoryCaches(category.id);
    return category;
  }

  async findAll() {
    const cached = await this.redisService.get(CATEGORIES_CACHE_KEY);
    if (cached) {
      return cached;
    }

    const categories = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
    });

    await this.redisService.set(
      CATEGORIES_CACHE_KEY,
      categories,
      CATEGORY_CACHE_TTL_SECONDS,
    );

    return categories;
  }

  async findOne(id: string) {
    const cacheKey = `${CATEGORY_CACHE_PREFIX}${id}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const category = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    await this.redisService.set(cacheKey, category, CATEGORY_CACHE_TTL_SECONDS);
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const existing = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    const duplicated = await this.prisma.category.findFirst({
      where: {
        name: dto.name,
        NOT: { id },
      },
      select: { id: true },
    });

    if (duplicated) {
      throw new ConflictException('Category name already exists');
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: dto,
    });

    await this.invalidateCategoryCaches(id);
    return updated;
  }

  async remove(id: string) {
    const existing = await this.prisma.category.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    const productCount = await this.prisma.product.count({
      where: {
        categoryId: id,
      },
    });

    if (productCount > 0) {
      throw new ConflictException(
        'Cannot delete category that still has active products',
      );
    }

    const removed = await this.prisma.category.delete({
      where: { id },
    });

    await this.invalidateCategoryCaches(id);
    return removed;
  }

  private async invalidateCategoryCaches(categoryId: string) {
    await this.redisService.del(CATEGORIES_CACHE_KEY, `${CATEGORY_CACHE_PREFIX}${categoryId}`);
  }
}
