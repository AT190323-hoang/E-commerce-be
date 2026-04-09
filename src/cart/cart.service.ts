import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { RedisService } from '@/redis/redis.service';
import { Role } from '@/common/enums/role.enum';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

const CART_CACHE_PREFIX = 'cart:user:';
const CART_CACHE_TTL_SECONDS = 60 * 60;

@Injectable()
export class CartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  validateOwnerOrAdmin(currentUser: { sub: string; role: Role }, userId: string) {
    if (currentUser.role === Role.ADMIN || currentUser.sub === userId) {
      return;
    }

    throw new ForbiddenException('You can only access your own cart');
  }

  async addItem(userId: string, dto: AddCartItemDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId },
      select: { id: true, stock: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const cart = await this.prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
      select: { id: true },
    });

    const existingItem = await this.prisma.cartItem.findFirst({
      where: { cartId: cart.id, productId: dto.productId },
      select: { id: true, quantity: true },
    });

    const nextQuantity = (existingItem?.quantity ?? 0) + dto.quantity;
    if (nextQuantity > product.stock) {
      throw new BadRequestException('Quantity exceeds available stock');
    }

    if (existingItem) {
      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: nextQuantity },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: dto.productId,
          quantity: dto.quantity,
        },
      });
    }

    await this.invalidateCartCache(userId);
    return this.getCart(userId);
  }

  async getCart(userId: string) {
    const cacheKey = this.getCacheKey(userId);
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    });

    const items = cart?.items ?? [];
    const result = {
      id: cart?.id ?? null,
      userId,
      items,
      totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
      totalAmount: items.reduce(
        (sum, item) => sum + item.quantity * item.product.price,
        0,
      ),
    };

    await this.redisService.set(cacheKey, result, CART_CACHE_TTL_SECONDS);
    return result;
  }

  async updateItem(userId: string, itemId: string, dto: UpdateCartItemDto) {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
      include: {
        product: {
          select: { stock: true },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    if (dto.quantity > item.product.stock) {
      throw new BadRequestException('Quantity exceeds available stock');
    }

    await this.prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: dto.quantity },
    });

    await this.invalidateCartCache(userId);
    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!cart) {
      throw new NotFoundException('Cart not found');
    }

    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cartId: cart.id },
      select: { id: true },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    await this.prisma.cartItem.delete({ where: { id: itemId } });

    await this.invalidateCartCache(userId);
    return this.getCart(userId);
  }

  async clearCart(userId: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!cart) {
      return {
        id: null,
        userId,
        items: [],
        totalItems: 0,
        totalAmount: 0,
      };
    }

    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    await this.invalidateCartCache(userId);
    return this.getCart(userId);
  }

  async invalidateCartCache(userId: string) {
    await this.redisService.del(this.getCacheKey(userId));
  }

  private getCacheKey(userId: string) {
    return `${CART_CACHE_PREFIX}${userId}`;
  }
}
