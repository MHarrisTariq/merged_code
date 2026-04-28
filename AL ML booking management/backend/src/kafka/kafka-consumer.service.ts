import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Consumer, Kafka, KafkaMessage, logLevel } from 'kafkajs';
import { KafkaService } from './kafka.service';
import { RedisService } from '../redis/redis.service';
import { SyncOrchestratorService } from '../sync/sync-orchestrator.service';
import { TOPICS } from './topics';

type BookingCreatedEvent = {
  event?: string;
  eventId?: string;
  bookingId?: string;
  listingId?: string;
  attempts?: number;
};

@Injectable()
export class KafkaConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(KafkaConsumerService.name);
  private consumer?: Consumer;

  constructor(
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly sync: SyncOrchestratorService,
    private readonly kafka: KafkaService,
  ) {}

  async onModuleInit() {
    const brokers = this.config.get<string[]>('kafkaBrokers') ?? [
      '127.0.0.1:9092',
    ];
    const enabled = (process.env.KAFKA_CONSUMERS_ENABLED ?? '1') === '1';
    if (!enabled) return;

    const kafka = new Kafka({
      clientId: 'swyftbooking-backend-consumers',
      brokers,
      logLevel: logLevel.NOTHING,
    });

    const groupId =
      process.env.KAFKA_CONSUMER_GROUP ?? 'swyftbooking-core-consumers';
    this.consumer = kafka.consumer({ groupId });

    try {
      await this.consumer.connect();
      await this.consumer.subscribe({
        topics: [TOPICS.BOOKING_CREATED, TOPICS.BOOKING_RETRY],
        fromBeginning: false,
      });

      await this.consumer.run({
        eachMessage: async ({ topic, message }) => {
          await this.handleMessage(topic, message);
        },
      });
      this.log.log('Kafka consumers started');
    } catch {
      // Kafka optional for local dev without broker
      this.consumer = undefined;
    }
  }

  async onModuleDestroy() {
    try {
      await this.consumer?.disconnect();
    } catch {
      // ignore
    }
  }

  private parseJson(message: KafkaMessage): unknown {
    try {
      const raw = message.value?.toString('utf-8') ?? '';
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private async isProcessedOnce(
    topic: string,
    eventId: string,
  ): Promise<boolean> {
    const key = `kafka:processed:${topic}:${eventId}`;
    const got = await this.redis.client.set(key, '1', 'NX', 'EX', 86400);
    return got !== 'OK';
  }

  private async handleMessage(topic: string, message: KafkaMessage) {
    const payload = this.parseJson(message) as BookingCreatedEvent;
    const eventId =
      payload.eventId ??
      (payload.bookingId ? `${topic}:${payload.bookingId}` : undefined);
    if (!eventId) return;

    const already = await this.isProcessedOnce(topic, eventId);
    if (already) return;

    try {
      if (topic === TOPICS.BOOKING_CREATED || topic === TOPICS.BOOKING_RETRY) {
        await this.handleBookingCreated(payload);
      }
    } catch (err) {
      const attempts = Number(payload.attempts ?? 0);
      await this.redis.client.del(`kafka:processed:${topic}:${eventId}`);

      if (attempts < 2) {
        await this.kafka.send(
          TOPICS.BOOKING_RETRY,
          {
            ...payload,
            attempts: attempts + 1,
            lastError: err instanceof Error ? err.message : String(err),
            eventId,
            event: payload.event ?? 'booking.created',
          },
          payload.listingId,
        );
        this.log.warn(`Retry queued topic=${topic} eventId=${eventId}`);
        return;
      }

      await this.kafka.send(
        TOPICS.BOOKING_DLQ,
        {
          ...payload,
          attempts,
          lastError: err instanceof Error ? err.message : String(err),
          eventId,
          event: payload.event ?? 'booking.created',
        },
        payload.listingId,
      );
      this.log.error(`Sent to DLQ topic=${topic} eventId=${eventId}`);
    }
  }

  private async handleBookingCreated(payload: BookingCreatedEvent) {
    const listingId = payload.listingId;
    const bookingId = payload.bookingId;
    if (!listingId || !bookingId) return;

    // 1) Sync consumer: trigger platform sync orchestration
    await this.sync.requestSync(listingId, bookingId, {
      priority: 'booking',
      suggestedIntervalSec: 5,
    });

    // 2) Analytics consumer: placeholder (log-only in starter)
    this.log.log(
      `Analytics event booking.created listing=${listingId} booking=${bookingId}`,
    );

    // 3) Notification consumer: placeholder (log-only in starter)
    this.log.log(
      `Notification event booking.created listing=${listingId} booking=${bookingId}`,
    );
  }
}
