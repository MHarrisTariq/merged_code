import { Module } from '@nestjs/common';
import { AvailabilityMemoryService } from './availability-memory.service';

@Module({
  providers: [AvailabilityMemoryService],
  exports: [AvailabilityMemoryService],
})
export class AvailabilityMemoryModule {}
