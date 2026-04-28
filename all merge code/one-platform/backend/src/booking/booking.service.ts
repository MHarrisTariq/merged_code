import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Model } from 'mongoose';
import { AiClientService } from '../ai/ai-client.service';
import { AvailabilityService } from '../availability/availability.service';
import { DecisionEngineService } from '../decision/decision-engine.service';
import { KafkaService } from '../kafka/kafka.service';
import { TOPICS } from '../kafka/topics';
import { LockService } from '../lock/lock.service';
import { RedisService } from '../redis/redis.service';
import { SyncOrchestratorService } from '../sync/sync-orchestrator.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { Booking, BookingDocument } from './schemas/booking.schema';

@Injectable()
export class BookingService {
  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    private readonly availability: AvailabilityService,
    private readonly lock: LockService,
    private readonly kafka: KafkaService,
    private readonly redis: RedisService,
    private readonly decision: DecisionEngineService,
    private readonly ai: AiClientService,
    private readonly sync: SyncOrchestratorService,
  ) {}

  async findById(id: string) {
    return this.bookingModel.findById(id).lean().exec();
  }

  async listForListing(listingId: string) {
    return this.bookingModel.find({ listingId }).sort({ startDate: 1 }).lean();
  }

  async create(dto: CreateBookingDto) {
    const idemKey = `idem:${dto.idempotencyKey}`;
    const existingId = await this.redis.client.get(idemKey);
    if (existingId) {
      const b = await this.bookingModel.findById(existingId).lean();
      if (b) return { booking: b, idempotent: true };
    }

    if (dto.startDate >= dto.endDate) {
      throw new ConflictException('invalid_date_range');
    }

    const hour = new Date(dto.startDate).getUTCHours();
    const decision = await this.decision.evaluate({
      listingId: dto.listingId,
      platform: dto.platform,
      hourOfDay: hour,
    });

    if (decision.outcome === 'block') {
      throw new ConflictException({
        reason: decision.reason,
        availabilityProb: decision.availabilityProb,
        risk: decision.risk,
      });
    }

    if (decision.outcome === 'delay') {
      throw new HttpException(
        {
          reason: decision.reason,
          retryAfterSeconds: 5,
          risk: decision.risk,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const lockResource = `${dto.listingId}:${dto.startDate}:${dto.endDate}`;
    const token = randomUUID();
    const ttl = decision.risk.lock_duration_sec ?? 30;
    const gotLock = await this.lock.acquire(lockResource, ttl, token);
    if (!gotLock) {
      throw new ConflictException('lock_not_acquired');
    }

    try {
      const conflict = await this.availability.hasConflict(
        dto.listingId,
        dto.startDate,
        dto.endDate,
      );
      if (conflict) {
        throw new ConflictException('dates_not_available');
      }

      const doc = await this.bookingModel.create({
        ...dto,
        status: 'confirmed',
        currency: 'USD',
        version: 1,
      });

      await this.redis.client.set(idemKey, doc._id.toString(), 'EX', 86400 * 7);

      await this.kafka.send(
        TOPICS.BOOKING_CREATED,
        {
          bookingId: doc._id.toString(),
          listingId: doc.listingId,
          event: 'booking.created',
        },
        doc.listingId,
      );

      await this.kafka.send(
        TOPICS.RISK_EVALUATED,
        {
          bookingId: doc._id.toString(),
          riskScore: decision.risk.risk_score,
          action: decision.risk.action,
        },
        doc.listingId,
      );

      const syncPlan = await this.ai.safeSyncInterval({
        demand_score: decision.demandScore,
        risk_score: decision.risk.risk_score,
        platform_reliability: 0.93,
        traffic_volume: 1,
      });

      await this.sync.requestSync(doc.listingId, doc._id.toString(), {
        priority: 'booking',
        suggestedIntervalSec: syncPlan.sync_interval_seconds,
      });

      return { booking: doc.toObject(), idempotent: false };
    } finally {
      await this.lock.release(lockResource, token);
    }
  }
}
