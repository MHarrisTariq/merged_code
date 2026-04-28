import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export type RiskResponse = {
  risk_score: number;
  action: string;
  lock_duration_sec: number;
};

export type AvailabilityProbResponse = {
  availability_probability: number;
  block_temporarily: boolean;
  trigger_priority_sync: boolean;
};

export type DemandForecastResponse = {
  demand_score: number;
};

export type SyncIntervalResponse = {
  sync_interval_seconds: number;
};

@Injectable()
export class AiClientService {
  private readonly base: string;
  private readonly timeoutMs: number;
  private readonly retries: number;

  constructor(
    private readonly http: HttpService,
    config: ConfigService,
  ) {
    this.base = config.get<string>('aiServicesUrl') ?? 'http://127.0.0.1:8000';
    this.timeoutMs = Number(process.env.AI_TIMEOUT_MS ?? 500);
    this.retries = Number(process.env.AI_RETRIES ?? 2);
  }

  private async postWithRetry<T>(path: string, body: unknown): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const { data } = await firstValueFrom(
          this.http.post<T>(`${this.base}${path}`, body, {
            timeout: this.timeoutMs,
          }),
        );
        return data;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr;
  }

  async health(): Promise<{ status: string; risk_model_loaded?: boolean }> {
    return this.postWithRetry('/health', undefined);
  }

  async riskScore(body: {
    listing_id: string;
    platform?: string;
    time_to_sync?: number;
    platform_latency?: number;
    demand_score?: number;
    concurrent_requests?: number;
    platform_reliability?: number;
  }): Promise<RiskResponse> {
    return this.postWithRetry('/risk-score', body);
  }

  async safeRiskScore(body: {
    listing_id: string;
    platform?: string;
    time_to_sync?: number;
    platform_latency?: number;
    demand_score?: number;
    concurrent_requests?: number;
    platform_reliability?: number;
  }): Promise<RiskResponse> {
    try {
      return await this.riskScore(body);
    } catch {
      return { risk_score: 0.5, action: 'ALLOW', lock_duration_sec: 20 };
    }
  }

  async availabilityProbability(body: {
    listing_id: string;
    last_sync_seconds_ago?: number;
    platform_latency?: number;
    api_success_rate?: number;
    booking_frequency?: number;
    listing_popularity?: number;
    traffic_spike?: number;
  }): Promise<AvailabilityProbResponse> {
    return this.postWithRetry('/availability-probability', body);
  }

  async safeAvailabilityProbability(body: {
    listing_id: string;
    last_sync_seconds_ago?: number;
    platform_latency?: number;
    api_success_rate?: number;
    booking_frequency?: number;
    listing_popularity?: number;
    traffic_spike?: number;
  }): Promise<AvailabilityProbResponse> {
    try {
      return await this.availabilityProbability(body);
    } catch {
      return {
        availability_probability: 0.99,
        block_temporarily: false,
        trigger_priority_sync: false,
      };
    }
  }

  async demandForecast(body: {
    listing_id: string;
    hour_of_day?: number;
    seasonality?: number;
    traffic?: number;
  }): Promise<DemandForecastResponse> {
    return this.postWithRetry('/demand-forecast', body);
  }

  async safeDemandForecast(body: {
    listing_id: string;
    hour_of_day?: number;
    seasonality?: number;
    traffic?: number;
  }): Promise<DemandForecastResponse> {
    try {
      return await this.demandForecast(body);
    } catch {
      return { demand_score: 0.5 };
    }
  }

  async syncInterval(body: {
    demand_score: number;
    risk_score: number;
    platform_reliability?: number;
    traffic_volume?: number;
  }): Promise<SyncIntervalResponse> {
    return this.postWithRetry('/sync-interval', body);
  }

  async safeSyncInterval(body: {
    demand_score: number;
    risk_score: number;
    platform_reliability?: number;
    traffic_volume?: number;
  }): Promise<SyncIntervalResponse> {
    try {
      return await this.syncInterval(body);
    } catch {
      return { sync_interval_seconds: 60 };
    }
  }
}
