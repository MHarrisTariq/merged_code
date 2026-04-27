"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LockService = void 0;
const common_1 = require("@nestjs/common");
const redlock_1 = require("redlock");
const redis_service_1 = require("../redis/redis.service");
let LockService = class LockService {
    constructor(redis) {
        this.redis = redis;
        this.locks = new Map();
        this.useMemory = process.env.SWYFT_DEV_MEMORY === '1';
        if (!this.useMemory) {
            this.redlock = new redlock_1.default([this.redis.client], {
                retryCount: 2,
                retryDelay: 100,
                retryJitter: 50,
            });
        }
    }
    async acquire(resourceKey, ttlSeconds, token) {
        const key = `lock:${resourceKey}`;
        if (this.redlock) {
            try {
                const lock = await this.redlock.acquire([key], ttlSeconds * 1000);
                this.locks.set(`${key}:${token}`, lock);
                return true;
            }
            catch {
                return false;
            }
        }
        const res = await this.redis.client.set(key, token, 'EX', ttlSeconds, 'NX');
        return res === 'OK';
    }
    async release(resourceKey, token) {
        const key = `lock:${resourceKey}`;
        if (this.redlock) {
            const lock = this.locks.get(`${key}:${token}`);
            this.locks.delete(`${key}:${token}`);
            try {
                await lock?.release();
            }
            catch {
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
};
exports.LockService = LockService;
exports.LockService = LockService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_service_1.RedisService])
], LockService);
//# sourceMappingURL=lock.service.js.map