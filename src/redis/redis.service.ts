import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly redisClient: Redis;

  constructor() {
    this.redisClient = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD || undefined,
      db: Number(process.env.REDIS_DB ?? 0),
      maxRetriesPerRequest: 2,
    });

    this.redisClient.on('error', (error) => {
      this.logger.error(`Redis connection error: ${error.message}`);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redisClient.get(key);

    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized =
      typeof value === 'string' ? value : JSON.stringify(value);

    if (ttlSeconds) {
      await this.redisClient.set(key, serialized, 'EX', ttlSeconds);
      return;
    }

    await this.redisClient.set(key, serialized);
  }

  async setIfNotExists(
    key: string,
    value: unknown,
    ttlSeconds: number,
  ): Promise<boolean> {
    const serialized =
      typeof value === 'string' ? value : JSON.stringify(value);

    const result = await this.redisClient.set(
      key,
      serialized,
      'EX',
      ttlSeconds,
      'NX',
    );

    return result === 'OK';
  }

  async del(...keys: string[]): Promise<void> {
    if (!keys.length) {
      return;
    }

    await this.redisClient.del(...keys);
  }

  async delByPattern(pattern: string): Promise<void> {
    const stream = this.redisClient.scanStream({ match: pattern, count: 100 });

    for await (const keys of stream) {
      const keyList = keys as string[];
      if (keyList.length) {
        await this.redisClient.del(...keyList);
      }
    }
  }

  async onModuleDestroy() {
    await this.redisClient.quit();
  }
}
