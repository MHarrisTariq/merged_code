import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BookingMemoryModule } from './booking/booking-memory.module';
import { BookingModule } from './booking/booking.module';
import configuration from './config/configuration';
import { KafkaModule } from './kafka/kafka.module';
import { RedisModule } from './redis/redis.module';

const memoryMode = process.env.SWYFT_DEV_MEMORY === '1';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ...(memoryMode
      ? []
      : [
          MongooseModule.forRootAsync({
            useFactory: () => ({
              uri:
                process.env.MONGODB_URI ??
                'mongodb://127.0.0.1:27017/swyftbooking',
            }),
          }),
        ]),
    RedisModule,
    KafkaModule,
    ...(memoryMode ? [BookingMemoryModule] : [BookingModule]),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
