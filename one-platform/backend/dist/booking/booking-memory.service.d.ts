import { AiClientService } from '../ai/ai-client.service';
import { AvailabilityMemoryService } from '../availability/availability-memory.service';
import { DevBookingRow } from '../dev/dev-booking.store';
import { DecisionEngineService } from '../decision/decision-engine.service';
import { KafkaService } from '../kafka/kafka.service';
import { LockService } from '../lock/lock.service';
import { RedisService } from '../redis/redis.service';
import { SyncOrchestratorService } from '../sync/sync-orchestrator.service';
import { CreateBookingDto } from './dto/create-booking.dto';
export declare class BookingMemoryService {
    private readonly availability;
    private readonly lock;
    private readonly kafka;
    private readonly redis;
    private readonly decision;
    private readonly ai;
    private readonly sync;
    constructor(availability: AvailabilityMemoryService, lock: LockService, kafka: KafkaService, redis: RedisService, decision: DecisionEngineService, ai: AiClientService, sync: SyncOrchestratorService);
    findById(id: string): Promise<DevBookingRow | null>;
    listForListing(listingId: string): Promise<DevBookingRow[]>;
    create(dto: CreateBookingDto): Promise<{
        booking: {
            _id: string;
            listingId: string;
            guestId: string;
            startDate: string;
            endDate: string;
            idempotencyKey: string;
            status: string;
            platform?: string;
            price?: number;
            currency: string;
            version: number;
            createdAt?: Date;
            updatedAt?: Date;
        };
        idempotent: boolean;
    }>;
}
