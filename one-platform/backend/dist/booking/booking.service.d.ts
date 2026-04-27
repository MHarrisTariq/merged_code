import { Model } from 'mongoose';
import { AiClientService } from '../ai/ai-client.service';
import { AvailabilityService } from '../availability/availability.service';
import { DecisionEngineService } from '../decision/decision-engine.service';
import { KafkaService } from '../kafka/kafka.service';
import { LockService } from '../lock/lock.service';
import { RedisService } from '../redis/redis.service';
import { SyncOrchestratorService } from '../sync/sync-orchestrator.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { Booking, BookingDocument } from './schemas/booking.schema';
export declare class BookingService {
    private bookingModel;
    private readonly availability;
    private readonly lock;
    private readonly kafka;
    private readonly redis;
    private readonly decision;
    private readonly ai;
    private readonly sync;
    constructor(bookingModel: Model<BookingDocument>, availability: AvailabilityService, lock: LockService, kafka: KafkaService, redis: RedisService, decision: DecisionEngineService, ai: AiClientService, sync: SyncOrchestratorService);
    findById(id: string): Promise<(import("mongoose").Document<unknown, {}, Booking, {}, import("mongoose").DefaultSchemaOptions> & Booking & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    } & {
        id: string;
    } & Required<{
        _id: import("mongoose").Types.ObjectId;
    }>) | null>;
    listForListing(listingId: string): Promise<(import("mongoose").Document<unknown, {}, Booking, {}, import("mongoose").DefaultSchemaOptions> & Booking & {
        _id: import("mongoose").Types.ObjectId;
    } & {
        __v: number;
    } & {
        id: string;
    } & Required<{
        _id: import("mongoose").Types.ObjectId;
    }>)[]>;
    create(dto: CreateBookingDto): Promise<{
        booking: import("mongoose").Document<unknown, {}, Booking, {}, import("mongoose").DefaultSchemaOptions> & Booking & {
            _id: import("mongoose").Types.ObjectId;
        } & {
            __v: number;
        } & {
            id: string;
        } & Required<{
            _id: import("mongoose").Types.ObjectId;
        }>;
        idempotent: boolean;
    }>;
}
