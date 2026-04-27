import { Injectable } from '@nestjs/common';
import { AiClientService, RiskResponse } from '../ai/ai-client.service';

export type Decision =
  | {
      outcome: 'approve';
      risk: RiskResponse;
      availabilityProb: number;
      demandScore: number;
    }
  | {
      outcome: 'block';
      reason: string;
      risk?: RiskResponse;
      availabilityProb?: number;
    }
  | {
      outcome: 'delay';
      reason: string;
      risk: RiskResponse;
      availabilityProb: number;
      demandScore: number;
    };

@Injectable()
export class DecisionEngineService {
  constructor(private readonly ai: AiClientService) {}

  async evaluate(params: {
    listingId: string;
    platform?: string;
    hourOfDay: number;
    concurrentHint?: number;
  }): Promise<Decision> {
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

    if (
      availability.block_temporarily ||
      availability.availability_probability < 0.85
    ) {
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
}
