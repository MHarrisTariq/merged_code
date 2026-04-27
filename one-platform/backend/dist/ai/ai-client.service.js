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
exports.AiClientService = void 0;
const axios_1 = require("@nestjs/axios");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const rxjs_1 = require("rxjs");
let AiClientService = class AiClientService {
    constructor(http, config) {
        this.http = http;
        this.base = config.get('aiServicesUrl') ?? 'http://127.0.0.1:8000';
        this.timeoutMs = Number(process.env.AI_TIMEOUT_MS ?? 500);
        this.retries = Number(process.env.AI_RETRIES ?? 2);
    }
    async postWithRetry(path, body) {
        let lastErr;
        for (let attempt = 0; attempt <= this.retries; attempt++) {
            try {
                const { data } = await (0, rxjs_1.firstValueFrom)(this.http.post(`${this.base}${path}`, body, {
                    timeout: this.timeoutMs,
                }));
                return data;
            }
            catch (err) {
                lastErr = err;
            }
        }
        throw lastErr;
    }
    async health() {
        return this.postWithRetry('/health', undefined);
    }
    async riskScore(body) {
        return this.postWithRetry('/risk-score', body);
    }
    async safeRiskScore(body) {
        try {
            return await this.riskScore(body);
        }
        catch {
            return { risk_score: 0.5, action: 'ALLOW', lock_duration_sec: 20 };
        }
    }
    async availabilityProbability(body) {
        return this.postWithRetry('/availability-probability', body);
    }
    async safeAvailabilityProbability(body) {
        try {
            return await this.availabilityProbability(body);
        }
        catch {
            return {
                availability_probability: 0.99,
                block_temporarily: false,
                trigger_priority_sync: false,
            };
        }
    }
    async demandForecast(body) {
        return this.postWithRetry('/demand-forecast', body);
    }
    async safeDemandForecast(body) {
        try {
            return await this.demandForecast(body);
        }
        catch {
            return { demand_score: 0.5 };
        }
    }
    async syncInterval(body) {
        return this.postWithRetry('/sync-interval', body);
    }
    async safeSyncInterval(body) {
        try {
            return await this.syncInterval(body);
        }
        catch {
            return { sync_interval_seconds: 60 };
        }
    }
};
exports.AiClientService = AiClientService;
exports.AiClientService = AiClientService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService,
        config_1.ConfigService])
], AiClientService);
//# sourceMappingURL=ai-client.service.js.map