import { Controller, Get } from '@nestjs/common';
import { AiClientService } from './ai/ai-client.service';
import { KafkaService } from './kafka/kafka.service';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly ai: AiClientService,
    private readonly kafka: KafkaService,
  ) {}

  @Get()
  root() {
    return {
      name: 'SwyftBooking API',
      layer: 'deterministic-core',
      docs: '/api',
    };
  }

  @Get('health')
  health() {
    return this.appService.health();
  }

  @Get('ai-health')
  async aiHealth() {
    try {
      const data = await this.ai.health();
      return { status: 'ok', ai: data };
    } catch {
      return { status: 'degraded', ai: { status: 'unreachable' } };
    }
  }

  @Get('kafka-health')
  kafkaHealth() {
    return { status: this.kafka.isConnected() ? 'ok' : 'degraded' };
  }
}
