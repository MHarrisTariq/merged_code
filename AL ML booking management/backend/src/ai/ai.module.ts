import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { AiClientService } from './ai-client.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects: 3,
    }),
  ],
  providers: [AiClientService],
  exports: [AiClientService],
})
export class AiModule {}
