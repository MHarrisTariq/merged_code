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
exports.DecisionEngineService = void 0;
const common_1 = require("@nestjs/common");
const ai_client_service_1 = require("../ai/ai-client.service");
let DecisionEngineService = class DecisionEngineService {
    constructor(ai) {
        this.ai = ai;
    }
    async evaluate(params) {
        const demand = await this.ai.safeDemandForecast({
            listing_id: params.listingId,
            hour_of_day: params.hourOfDay,
            seasonality: 0.5,
            traffic: 1,
        });
        const availability = await this.ai.safeAvailabilityProbability({
            listing_id: params.listingId,
            last_sync_seconds_ago: 45,
            platform_latency: 1.2,
            api_success_rate: 0.96,
            booking_frequency: demand.demand_score,
            listing_popularity: 0.5,
            traffic_spike: demand.demand_score > 0.85 ? 0.4 : 0,
        });
        if (availability.block_temporarily ||
            availability.availability_probability < 0.85) {
            return {
                outcome: 'block',
                reason: 'availability_probability_below_threshold',
                availabilityProb: availability.availability_probability,
            };
        }
        const demandScore = demand.demand_score;
        const risk = await this.ai.safeRiskScore({
            listing_id: params.listingId,
            platform: params.platform ?? 'generic',
            time_to_sync: 2.3,
            platform_latency: 1.8,
            demand_score: demand.demand_score,
            concurrent_requests: params.concurrentHint ?? 3,
            platform_reliability: 0.92,
        });
        if (risk.action === 'HARD_LOCK' && risk.risk_score > 0.8) {
            return {
                outcome: 'delay',
                reason: 'high_risk_hard_lock',
                risk,
                availabilityProb: availability.availability_probability,
                demandScore,
            };
        }
        if (risk.action === 'HARD_LOCK') {
            return {
                outcome: 'block',
                reason: 'risk_hard_lock',
                risk,
                availabilityProb: availability.availability_probability,
            };
        }
        return {
            outcome: 'approve',
            risk,
            availabilityProb: availability.availability_probability,
            demandScore,
        };
    }
};
exports.DecisionEngineService = DecisionEngineService;
exports.DecisionEngineService = DecisionEngineService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ai_client_service_1.AiClientService])
], DecisionEngineService);
//# sourceMappingURL=decision-engine.service.js.map