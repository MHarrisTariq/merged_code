import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export declare class KafkaService implements OnModuleInit, OnModuleDestroy {
    private readonly config;
    private kafka;
    private producer;
    private connected;
    constructor(config: ConfigService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    isConnected(): boolean;
    send(topic: string, payload: Record<string, unknown>, key?: string): Promise<void>;
}
