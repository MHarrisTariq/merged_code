import { Test, TestingModule } from '@nestjs/testing';
import { AiClientService } from './ai/ai-client.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { KafkaService } from './kafka/kafka.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: AiClientService,
          useValue: { health: jest.fn(async () => ({ status: 'ok' })) },
        },
        { provide: KafkaService, useValue: { isConnected: () => true } },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('returns API metadata', () => {
      expect(appController.root()).toMatchObject({
        name: 'SwyftBooking API',
        layer: 'deterministic-core',
      });
    });
  });

  describe('health', () => {
    it('returns ok status', () => {
      expect(appController.health()).toEqual({
        status: 'ok',
        service: 'swyftbooking-backend',
      });
    });
  });
});
