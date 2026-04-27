import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AvailabilityMemoryModule } from '../availability/availability-memory.module';
import { DecisionModule } from '../decision/decision.module';
import { LockModule } from '../lock/lock.module';
import { SyncModule } from '../sync/sync.module';
import { BookingController } from './booking.controller';
import { BookingMemoryService } from './booking-memory.service';
import { BookingService } from './booking.service';

@Module({
  imports: [
    AvailabilityMemoryModule,
    LockModule,
    DecisionModule,
    AiModule,
    SyncModule,
  ],
  controllers: [BookingController],
  providers: [
    BookingMemoryService,
    { provide: BookingService, useExisting: BookingMemoryService },
  ],
  exports: [BookingService],
})
export class BookingMemoryModule {}
