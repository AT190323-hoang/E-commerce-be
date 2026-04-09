import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Role } from '@/common/enums/role.enum';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '@/redis/redis.service';
import { randomUUID } from 'crypto';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET ?? 'secretKey';
const REFRESH_TOKEN_SECRET =
  process.env.JWT_REFRESH_SECRET ?? 'refreshSecretKey';

interface AuthPayload {
  sub: string;
  role: Role;
  type: 'access' | 'refresh';
  jti?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private redisService: RedisService,
  ) { }

  async register(dto: RegisterDto) {
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
        role: 'USER',
      },
    });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  }

  private async validateUser(dto: LoginDto) {
    const cacheKey = `auth:user:email:${dto.email}`;
    let user = await this.redisService.get<{
      id: string;
      email: string;
      password: string;
      role: string;
    }>(cacheKey);

    if (!user) {
      const prismaUser = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });

      if (prismaUser) {
        user = {
          id: prismaUser.id,
          email: prismaUser.email,
          password: prismaUser.password,
          role: prismaUser.role,
        };

        await this.redisService.set(cacheKey, user, 60 * 5);
      }
    }

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password);

    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }

  async login(dto: LoginDto) {
    const user = await this.validateUser(dto);

    return this.issueTokenPair(user.id, user.role as Role);
  }

  async refresh(dto: RefreshTokenDto) {
    const payload = this.verifyRefreshToken(dto.refreshToken);

    const refreshTokenKey = this.getRefreshTokenKey(payload.sub, payload.jti!);
    const tokenState = await this.redisService.get<string>(refreshTokenKey);
    if (!tokenState) {
      throw new UnauthorizedException('Refresh token is no longer valid');
    }

    await this.redisService.del(refreshTokenKey);

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true },
    });

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    return this.issueTokenPair(user.id, user.role as Role);
  }

  async logout(accessToken?: string, refreshToken?: string) {
    if (!accessToken && !refreshToken) {
      throw new UnauthorizedException('Missing access token or refresh token');
    }

    if (accessToken) {
      await this.redisService.del(`auth:token:${accessToken}`);
    }

    if (refreshToken) {
      const payload = this.verifyRefreshToken(refreshToken);
      await this.redisService.del(
        this.getRefreshTokenKey(payload.sub, payload.jti!),
      );
    }

    return { message: 'Logout successful' };
  }

  private async issueTokenPair(userId: string, role: Role) {
    const refreshJti = randomUUID();

    const accessPayload: AuthPayload = {
      sub: userId,
      role,
      type: 'access',
    };
    const refreshPayload: AuthPayload = {
      sub: userId,
      role,
      type: 'refresh',
      jti: refreshJti,
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      secret: ACCESS_TOKEN_SECRET,
      expiresIn: `${ACCESS_TOKEN_TTL_SECONDS}s`,
    });
    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: REFRESH_TOKEN_SECRET,
      expiresIn: `${REFRESH_TOKEN_TTL_SECONDS}s`,
    });

    await this.redisService.set(
      `auth:token:${accessToken}`,
      { userId },
      ACCESS_TOKEN_TTL_SECONDS,
    );
    await this.redisService.set(
      this.getRefreshTokenKey(userId, refreshJti),
      '1',
      REFRESH_TOKEN_TTL_SECONDS,
    );

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SECONDS,
    };
  }

  private verifyRefreshToken(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Missing refresh token');
    }

    try {
      const payload = this.jwtService.verify<AuthPayload>(refreshToken, {
        secret: REFRESH_TOKEN_SECRET,
      });

      if (
        payload.type !== 'refresh' ||
        !payload.sub ||
        !payload.jti
      ) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private getRefreshTokenKey(userId: string, jti: string) {
    return `auth:refresh:${userId}:${jti}`;
  }
}