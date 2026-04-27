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
exports.BookingMemoryService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const ai_client_service_1 = require("../ai/ai-client.service");
const availability_memory_service_1 = require("../availability/availability-memory.service");
const dev_booking_store_1 = require("../dev/dev-booking.store");
const decision_engine_service_1 = require("../decision/decision-engine.service");
const kafka_service_1 = require("../kafka/kafka.service");
const topics_1 = require("../kafka/topics");
const lock_service_1 = require("../lock/lock.service");
const redis_service_1 = require("../redis/redis.service");
const sync_orchestrator_service_1 = require("../sync/sync-orchestrator.service");
let BookingMemoryService = class BookingMemoryService {
    constructor(availability, lock, kafka, redis, decision, ai, sync) {
        this.availability = availability;
        this.lock = lock;
        this.kafka = kafka;
        this.redis = redis;
        this.decision = decision;
        this.ai = ai;
        this.sync = sync;
    }
    async findById(id) {
        return dev_booking_store_1.devBookings.find((b) => b._id === id) ?? null;
    }
    async listForListing(listingId) {
        return [...dev_booking_store_1.devBookings]
            .filter((b) => b.listingId === listingId)
            .sort((a, b) => a.startDate.localeCompare(b.startDate));
    }
    async create(dto) {
        const idemKey = `idem:${dto.idempotencyKey}`;
        const existingId = await this.redis.client.get(idemKey);
        if (existingId) {
            const b = dev_booking_store_1.devBookings.find((x) => x._id === existingId);
            if (b)
                return { booking: { ...b }, idempotent: true };
        }
        if (dto.startDate >= dto.endDate) {
            throw new common_1.ConflictException('invalid_date_range');
        }
        const hour = new Date(dto.startDate).getUTCHours();
        const decision = await this.decision.evaluate({
            listingId: dto.listingId,
            platform: dto.platform,
            hourOfDay: hour,
        });
        if (decision.outcome === 'block') {
            throw new common_1.ConflictException({
                reason: decision.reason,
                availabilityProb: decision.availabilityProb,
                risk: decision.risk,
            });
        }
        if (decision.outcome === 'delay') {
            throw new common_1.HttpException({
                reason: decision.reason,
                retryAfterSeconds: 5,
                risk: decision.risk,
            }, common_1.HttpStatus.TOO_MANY_REQUESTS);
        }
        const lockResource = `${dto.listingId}:${dto.startDate}:${dto.endDate}`;
        const token = (0, crypto_1.randomUUID)();
        const ttl = decision.risk.lock_duration_sec ?? 30;
        const gotLock = await this.lock.acquire(lockResource, ttl, token);
        if (!gotLock) {
            throw new common_1.ConflictException('lock_not_acquired');
        }
        try {
            const conflict = await this.availability.hasConflict(dto.listingId, dto.startDate, dto.endDate);
            if (conflict) {
                throw new common_1.ConflictException('dates_not_available');
            }
            const row = {
                _id: (0, crypto_1.randomUUID)(),
                listingId: dto.listingId,
                guestId: dto.guestId,
                startDate: dto.startDate,
                endDate: dto.endDate,
                idempotencyKey: dto.idempotencyKey,
                status: 'confirmed',
                platform: dto.platform,
                price: dto.price,
                currency: 'USD',
                version: 1,
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            dev_booking_store_1.devBookings.push(row);
            await this.redis.client.set(idemKey, row._id, 'EX', 86400 * 7);
            await this.kafka.send(topics_1.TOPICS.BOOKING_CREATED, {
                bookingId: row._id,
                listingId: row.listingId,
                event: 'booking.created',
            }, row.listingId);
            await this.kafka.send(topics_1.TOPICS.RISK_EVALUATED, {
                bookingId: row._id,
                riskScore: decision.risk.risk_score,
                action: decision.risk.action,
            }, row.listingId);
            const syncPlan = await this.ai.safeSyncInterval({
                demand_score: decision.demandScore,
                risk_score: decision.risk.risk_score,
                platform_reliability: 0.93,
                traffic_volume: 1,
            });
            await this.sync.requestSync(row.listingId, row._id, {
                priority: 'booking',
                suggestedIntervalSec: syncPlan.sync_interval_seconds,
            });
            return { booking: { ...row }, idempotent: false };
        }
        finally {
            await this.lock.release(lockResource, token);
        }
    }
};
exports.BookingMemoryService = BookingMemoryService;
exports.BookingMemoryService = BookingMemoryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [availability_memory_service_1.AvailabilityMemoryService,
        lock_service_1.LockService,
        kafka_service_1.KafkaService,
        redis_service_1.RedisService,
        decision_engine_service_1.DecisionEngineService,
        ai_client_service_1.AiClientService,
        sync_orchestrator_service_1.SyncOrchestratorService])
], BookingMemoryService);
//# sourceMappingURL=booking-memory.service.js.map