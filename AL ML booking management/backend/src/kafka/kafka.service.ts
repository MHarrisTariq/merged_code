import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kafka, logLevel, Producer } from 'kafkajs';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private kafka: Kafka;
  private producer: Producer;
  private connected = false;

  constructor(private readonly config: ConfigService) {
    const brokers = this.config.get<string[]>('kafkaBrokers') ?? [
      '127.0.0.1:9092',
    ];
    this.kafka = new Kafka({
      clientId: 'swyftbooking-backend',
      brokers,
      logLevel: logLevel.NOTHING,
    });
    this.producer = this.kafka.producer();
  }

  async onModuleInit() {
    try {
      await this.producer.connect();
      this.connected = true;
    } catch {
      // Kafka optional for local dev without broker
      this.connected = false;
    }
  }

  async onModuleDestroy() {
    try {
      await this.producer.disconnect();
      this.connected = false;
    } catch {
      // ignore
    }
  }

  isConnected() {
    return this.connected;
  }

  async send(topic: string, payload: Record<string, unknown>, key?: string) {
    try {
      await this.producer.send({
        topic,
        messages: [
          {
            key: key ?? undefined,
            value: JSON.stringify({
              ...payload,
              emittedAt: new Date().toISOString(),
              version: 1,
            }),
          },
        ],
      });
    } catch {
      // allow deterministic path without Kafka
    }
  }
}
