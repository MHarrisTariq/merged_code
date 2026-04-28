import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AiClientService } from '../ai/ai-client.service';
import { AvailabilityMemoryService } from '../availability/availability-memory.service';
import { devBookings, DevBookingRow } from '../dev/dev-booking.store';
import { DecisionEngineService } from '../decision/decision-engine.service';
import { KafkaService } from '../kafka/kafka.service';
import { TOPICS } from '../kafka/topics';
import { LockService } from '../lock/lock.service';
import { RedisService } from '../redis/redis.service';
import { SyncOrchestratorService } from '../sync/sync-orchestrator.service';
import { CreateBookingDto } from './dto/create-booking.dto';

@Injectable()
export class BookingMemoryService {
  constructor(
    private readonly availability: AvailabilityMemoryService,
    private readonly lock: LockService,
    private readonly kafka: KafkaService,
    private readonly redis: RedisService,
    private readonly decision: DecisionEngineService,
    private readonly ai: AiClientService,
    private readonly sync: SyncOrchestratorService,
  ) {}

  async findById(id: string) {
    return devBookings.find((b) => b._id === id) ?? null;
  }

  async listForListing(listingId: string) {
    return [...devBookings]
      .filter((b) => b.listingId === listingId)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }

  async create(dto: CreateBookingDto) {
    const idemKey = `idem:${dto.idempotencyKey}`;
    const existingId = await this.redis.client.get(idemKey);
    if (existingId) {
      const b = devBookings.find((x) => x._id === existingId);
      if (b) return { booking: { ...b }, idempotent: true };
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

      const row: DevBookingRow = {
        _id: randomUUID(),
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
      devBookings.push(row);

      await this.redis.client.set(idemKey, row._id, 'EX', 86400 * 7);

      await this.kafka.send(
        TOPICS.BOOKING_CREATED,
        {
          bookingId: row._id,
          listingId: row.listingId,
          event: 'booking.created',
        },
        row.listingId,
      );

      await this.kafka.send(
        TOPICS.RISK_EVALUATED,
        {
          bookingId: row._id,
          riskScore: decision.risk.risk_score,
          action: decision.risk.action,
        },
        row.listingId,
      );

      const syncPlan = await this.ai.syncInterval({
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
    } finally {
      await this.lock.release(lockResource, token);
    }
  }
}
