import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import MockRedis from 'ioredis-mock';

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor(config: ConfigService) {
    const useMemory = process.env.SWYFT_DEV_MEMORY === '1';
    const url = config.get<string>('redisUrl') ?? 'redis://127.0.0.1:6379';
    this.client = useMemory
      ? (new MockRedis() as unknown as Redis)
      : new Redis(url, { maxRetriesPerRequest: 3 });
  }

  async onModuleDestroy() {
    try {
      await this.client.quit();
    } catch {
      // ignore
    }
  }

  async connect() {
    try {
      await this.client.connect();
    } catch {
      // already connected
    }
  }
}
