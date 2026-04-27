"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KafkaService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const kafkajs_1 = require("kafkajs");
let KafkaService = class KafkaService {
    constructor(config) {
        this.config = config;
        this.connected = false;
        const brokers = this.config.get('kafkaBrokers') ?? [
            '127.0.0.1:9092',
        ];
        this.kafka = new kafkajs_1.Kafka({
            clientId: 'swyftbooking-backend',
            brokers,
            logLevel: kafkajs_1.logLevel.NOTHING,
        });
        this.producer = this.kafka.producer();
    }
    async onModuleInit() {
        try {
            await this.producer.connect();
            this.connected = true;
        }
        catch {
            this.connected = false;
        }
    }
    async onModuleDestroy() {
        try {
            await this.producer.disconnect();
            this.connected = false;
        }
        catch {
        }
    }
    isConnected() {
        return this.connected;
    }
    async send(topic, payload, key) {
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
        }
        catch {
        }
    }
};
exports.KafkaService = KafkaService;
exports.KafkaService = KafkaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], KafkaService);
//# sourceMappingURL=kafka.service.js.map