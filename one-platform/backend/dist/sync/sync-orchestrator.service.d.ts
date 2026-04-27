import { KafkaService } from '../kafka/kafka.service';
export declare class SyncOrchestratorService {
    private readonly kafka;
    private readonly log;
    constructor(kafka: KafkaService);
    requestSync(listingId: string, bookingId: string, meta: {
        priority: string;
        suggestedIntervalSec?: number;
    }): Promise<void>;
}
