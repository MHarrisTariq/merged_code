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
var SyncOrchestratorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncOrchestratorService = void 0;
const common_1 = require("@nestjs/common");
const kafka_service_1 = require("../kafka/kafka.service");
const topics_1 = require("../kafka/topics");
let SyncOrchestratorService = SyncOrchestratorService_1 = class SyncOrchestratorService {
    constructor(kafka) {
        this.kafka = kafka;
        this.log = new common_1.Logger(SyncOrchestratorService_1.name);
    }
    async requestSync(listingId, bookingId, meta) {
        this.log.log(`Sync requested listing=${listingId} booking=${bookingId} meta=${JSON.stringify(meta)}`);
        await this.kafka.send(topics_1.TOPICS.SYNC_REQUESTED, {
            listingId,
            bookingId,
            priority: meta.priority,
            suggestedIntervalSec: meta.suggestedIntervalSec,
        }, listingId);
    }
};
exports.SyncOrchestratorService = SyncOrchestratorService;
exports.SyncOrchestratorService = SyncOrchestratorService = SyncOrchestratorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [kafka_service_1.KafkaService])
], SyncOrchestratorService);
//# sourceMappingURL=sync-orchestrator.service.js.map