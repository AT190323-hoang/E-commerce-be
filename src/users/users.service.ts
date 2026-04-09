import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { RedisService } from '@/redis/redis.service';

const USERS_LIST_CACHE_KEY = 'users:list';
const USER_CACHE_PREFIX = 'users:id:';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
  ) {}

  async create(dto: CreateUserDto) {
    const existedUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });

    if (existedUser) {
      throw new ConflictException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(
      dto.password,
      Number(process.env.BCRYPT_SALT),
    );

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        role: dto.role ?? 'USER',
        profile:
          dto.fullName || dto.phone || dto.address
            ? {
                create: {
                  fullName: dto.fullName,
                  phone: dto.phone,
                  address: dto.address,
                },
              }
            : undefined,
      },
      include: { profile: true },
    });

    const sanitized = this.sanitize(user);
    await this.redisService.set(`${USER_CACHE_PREFIX}${user.id}`, sanitized, 300);
    await this.redisService.del(USERS_LIST_CACHE_KEY);
    await this.redisService.del(`auth:user:email:${dto.email}`);

    return sanitized;
  }

  async findAll() {
    const cachedUsers = await this.redisService.get<ReturnType<typeof this.sanitize>[]>(
      USERS_LIST_CACHE_KEY,
    );

    if (cachedUsers) {
      return cachedUsers;
    }

    const users = await this.prisma.user.findMany({
      include: { profile: true },
      orderBy: { createdAt: 'desc' },
    });

    const sanitizedUsers = users.map((user) => this.sanitize(user));
    await this.redisService.set(USERS_LIST_CACHE_KEY, sanitizedUsers, 300);

    return sanitizedUsers;
  }

  async findOne(id: string) {
    const cacheKey = `${USER_CACHE_PREFIX}${id}`;
    const cachedUser = await this.redisService.get<ReturnType<typeof this.sanitize>>(cacheKey);

    if (cachedUser) {
      return cachedUser;
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const sanitizedUser = this.sanitize(user);
    await this.redisService.set(cacheKey, sanitizedUser, 300);

    return sanitizedUser;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.ensureUserExists(id);

    if (dto.email) {
      const existing = await this.prisma.user.findUnique({
        where: { email: dto.email },
        select: { id: true },
      });

      if (existing && existing.id !== id) {
        throw new ConflictException('Email already exists');
      }
    }

    const password = dto.password
      ? await bcrypt.hash(dto.password, Number(process.env.BCRYPT_SALT))
      : undefined;

    const profilePayload =
      dto.fullName !== undefined ||
      dto.phone !== undefined ||
      dto.address !== undefined
        ? {
            upsert: {
              create: {
                fullName: dto.fullName,
                phone: dto.phone,
                address: dto.address,
              },
              update: {
                ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
                ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
                ...(dto.address !== undefined ? { address: dto.address } : {}),
              },
            },
          }
        : undefined;

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(password ? { password } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(profilePayload ? { profile: profilePayload } : {}),
      },
      include: { profile: true },
    });

    const sanitized = this.sanitize(user);

    await this.redisService.set(`${USER_CACHE_PREFIX}${id}`, sanitized, 300);
    await this.redisService.del(USERS_LIST_CACHE_KEY);
    await this.redisService.delByPattern('auth:user:email:*');

    return sanitized;
  }

  async remove(id: string) {
    await this.ensureUserExists(id);

    const removed = await this.prisma.user.delete({
      where: { id },
      include: { profile: true },
    });

    await this.redisService.del(`${USER_CACHE_PREFIX}${id}`, USERS_LIST_CACHE_KEY);
    await this.redisService.delByPattern('auth:user:email:*');

    return {
      message: 'User deleted successfully',
      user: this.sanitize(removed),
    };
  }

  private async ensureUserExists(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }
  }

  private sanitize(user: {
    id: string;
    email: string;
    role: string;
    createdAt: Date;
    profile: {
      id: string;
      userId: string;
      fullName: string | null;
      phone: string | null;
      address: string | null;
    } | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      profile: user.profile,
    };
  }
}
