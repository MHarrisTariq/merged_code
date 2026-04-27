import { RedisService } from '../redis/redis.service';
export declare class LockService {
    private readonly redis;
    private readonly redlock?;
    private readonly locks;
    private readonly useMemory;
    constructor(redis: RedisService);
    acquire(resourceKey: string, ttlSeconds: number, token: string): Promise<boolean>;
    release(resourceKey: string, token: string): Promise<void>;
}
