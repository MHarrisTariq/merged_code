import { Injectable, Logger } from '@nestjs/common';
import { KafkaService } from '../kafka/kafka.service';
import { TOPICS } from '../kafka/topics';

/** Priority: availability > booking > pricing (doc). */
@Injectable()
export class SyncOrchestratorService {
  private readonly log = new Logger(SyncOrchestratorService.name);

  constructor(private readonly kafka: KafkaService) {}

  async requestSync(
    listingId: string,
    bookingId: string,
    meta: { priority: string; suggestedIntervalSec?: number },
  ) {
    this.log.log(
      `Sync requested listing=${listingId} booking=${bookingId} meta=${JSON.stringify(meta)}`,
    );
    await this.kafka.send(
      TOPICS.SYNC_REQUESTED,
      {
        listingId,
        bookingId,
        priority: meta.priority,
        suggestedIntervalSec: meta.suggestedIntervalSec,
      },
      listingId,
    );
  }
}
