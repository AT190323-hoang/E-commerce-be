import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { RedisService } from '@/redis/redis.service';

const ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET ?? 'secretKey';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private redisService: RedisService) {
    super({
      passReqToCallback: true,
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: ACCESS_TOKEN_SECRET,
    });
  }

  async validate(req: Request, payload: any) {
    const token = this.extractBearerToken(req.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Missing access token');
    }

    const tokenState = await this.redisService.get<{ userId: string }>(
      `auth:token:${token}`,
    );

    if (!tokenState) {
      throw new UnauthorizedException('Token is no longer valid');
    }

    return payload;
  }

  private extractBearerToken(authHeader?: string) {
    if (!authHeader) {
      return undefined;
    }

    const matched = authHeader.trim().match(/^Bearer\s+(.+)$/i);
    return matched?.[1]?.trim() || undefined;
  }
}