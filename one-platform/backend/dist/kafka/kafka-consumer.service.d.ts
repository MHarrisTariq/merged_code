import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KafkaService } from './kafka.service';
import { RedisService } from '../redis/redis.service';
import { SyncOrchestratorService } from '../sync/sync-orchestrator.service';
export declare class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
    private readonly config;
    private readonly redis;
    private readonly sync;
    private readonly kafka;
    private readonly log;
    private consumer?;
    constructor(config: ConfigService, redis: RedisService, sync: SyncOrchestratorService, kafka: KafkaService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    private parseJson;
    private isProcessedOnce;
    private handleMessage;
    private handleBookingCreated;
}
