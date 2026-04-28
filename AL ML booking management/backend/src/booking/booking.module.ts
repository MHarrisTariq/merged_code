import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AiModule } from '../ai/ai.module';
import { AvailabilityModule } from '../availability/availability.module';
import { DecisionModule } from '../decision/decision.module';
import { LockModule } from '../lock/lock.module';
import { SyncModule } from '../sync/sync.module';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { Booking, BookingSchema } from './schemas/booking.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Booking.name, schema: BookingSchema }]),
    AvailabilityModule,
    LockModule,
    DecisionModule,
    AiModule,
    SyncModule,
  ],
  controllers: [BookingController],
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingModule {}
