import { Injectable } from '@nestjs/common';
import Redlock, { Lock } from 'redlock';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class LockService {
  private readonly redlock?: Redlock;
  private readonly locks = new Map<string, Lock>();
  private readonly useMemory = process.env.SWYFT_DEV_MEMORY === '1';

  constructor(private readonly redis: RedisService) {
    if (!this.useMemory) {
      this.redlock = new Redlock([this.redis.client as any], {
        retryCount: 2,
        retryDelay: 100,
        retryJitter: 50,
      });
    }
  }

  async acquire(
    resourceKey: string,
    ttlSeconds: number,
    token: string,
  ): Promise<boolean> {
    const key = `lock:${resourceKey}`;

    if (this.redlock) {
      try {
        const lock = await this.redlock.acquire([key], ttlSeconds * 1000);
        this.locks.set(`${key}:${token}`, lock);
        return true;
      } catch {
        return false;
      }
    }

    const res = await this.redis.client.set(key, token, 'EX', ttlSeconds, 'NX');
    return res === 'OK';
  }

  async release(resourceKey: string, token: string): Promise<void> {
    const key = `lock:${resourceKey}`;

    if (this.redlock) {
      const lock = this.locks.get(`${key}:${token}`);
      this.locks.delete(`${key}:${token}`);
      try {
        await lock?.release();
      } catch {
        // ignore
      }
      return;
    }

    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    await this.redis.client.eval(script, 1, key, token);
  }
}
