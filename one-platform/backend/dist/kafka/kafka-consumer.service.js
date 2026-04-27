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
var KafkaConsumerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.KafkaConsumerService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const kafkajs_1 = require("kafkajs");
const kafka_service_1 = require("./kafka.service");
const redis_service_1 = require("../redis/redis.service");
const sync_orchestrator_service_1 = require("../sync/sync-orchestrator.service");
const topics_1 = require("./topics");
let KafkaConsumerService = KafkaConsumerService_1 = class KafkaConsumerService {
    constructor(config, redis, sync, kafka) {
        this.config = config;
        this.redis = redis;
        this.sync = sync;
        this.kafka = kafka;
        this.log = new common_1.Logger(KafkaConsumerService_1.name);
    }
    async onModuleInit() {
        const brokers = this.config.get('kafkaBrokers') ?? [
            '127.0.0.1:9092',
        ];
        const enabled = (process.env.KAFKA_CONSUMERS_ENABLED ?? '1') === '1';
        if (!enabled)
            return;
        const kafka = new kafkajs_1.Kafka({
            clientId: 'swyftbooking-backend-consumers',
            brokers,
            logLevel: kafkajs_1.logLevel.NOTHING,
        });
        const groupId = process.env.KAFKA_CONSUMER_GROUP ?? 'swyftbooking-core-consumers';
        this.consumer = kafka.consumer({ groupId });
        try {
            await this.consumer.connect();
            await this.consumer.subscribe({
                topics: [topics_1.TOPICS.BOOKING_CREATED, topics_1.TOPICS.BOOKING_RETRY],
                fromBeginning: false,
            });
            await this.consumer.run({
                eachMessage: async ({ topic, message }) => {
                    await this.handleMessage(topic, message);
                },
            });
            this.log.log('Kafka consumers started');
        }
        catch {
            this.consumer = undefined;
        }
    }
    async onModuleDestroy() {
        try {
            await this.consumer?.disconnect();
        }
        catch {
        }
    }
    parseJson(message) {
        try {
            const raw = message.value?.toString('utf-8') ?? '';
            return raw ? JSON.parse(raw) : {};
        }
        catch {
            return {};
        }
    }
    async isProcessedOnce(topic, eventId) {
        const key = `kafka:processed:${topic}:${eventId}`;
        const got = await this.redis.client.set(key, '1', 'EX', 86400, 'NX');
        return got !== 'OK';
    }
    async handleMessage(topic, message) {
        const payload = this.parseJson(message);
        const eventId = payload.eventId ??
            (payload.bookingId ? `${topic}:${payload.bookingId}` : undefined);
        if (!eventId)
            return;
        const already = await this.isProcessedOnce(topic, eventId);
        if (already)
            return;
        try {
            if (topic === topics_1.TOPICS.BOOKING_CREATED || topic === topics_1.TOPICS.BOOKING_RETRY) {
                await this.handleBookingCreated(payload);
            }
        }
        catch (err) {
            const attempts = Number(payload.attempts ?? 0);
            await this.redis.client.del(`kafka:processed:${topic}:${eventId}`);
            if (attempts < 2) {
                await this.kafka.send(topics_1.TOPICS.BOOKING_RETRY, {
                    ...payload,
                    attempts: attempts + 1,
                    lastError: err instanceof Error ? err.message : String(err),
                    eventId,
                    event: payload.event ?? 'booking.created',
                }, payload.listingId);
                this.log.warn(`Retry queued topic=${topic} eventId=${eventId}`);
                return;
            }
            await this.kafka.send(topics_1.TOPICS.BOOKING_DLQ, {
                ...payload,
                attempts,
                lastError: err instanceof Error ? err.message : String(err),
                eventId,
                event: payload.event ?? 'booking.created',
            }, payload.listingId);
            this.log.error(`Sent to DLQ topic=${topic} eventId=${eventId}`);
        }
    }
    async handleBookingCreated(payload) {
        const listingId = payload.listingId;
        const bookingId = payload.bookingId;
        if (!listingId || !bookingId)
            return;
        await this.sync.requestSync(listingId, bookingId, {
            priority: 'booking',
            suggestedIntervalSec: 5,
        });
        this.log.log(`Analytics event booking.created listing=${listingId} booking=${bookingId}`);
        this.log.log(`Notification event booking.created listing=${listingId} booking=${bookingId}`);
    }
};
exports.KafkaConsumerService = KafkaConsumerService;
exports.KafkaConsumerService = KafkaConsumerService = KafkaConsumerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        redis_service_1.RedisService,
        sync_orchestrator_service_1.SyncOrchestratorService,
        kafka_service_1.KafkaService])
], KafkaConsumerService);
//# sourceMappingURL=kafka-consumer.service.js.map