import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
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
export declare class AiClientService {
    private readonly http;
    private readonly base;
    private readonly timeoutMs;
    private readonly retries;
    constructor(http: HttpService, config: ConfigService);
    private postWithRetry;
    health(): Promise<{
        status: string;
        risk_model_loaded?: boolean;
    }>;
    riskScore(body: {
        listing_id: string;
        platform?: string;
        time_to_sync?: number;
        platform_latency?: number;
        demand_score?: number;
        concurrent_requests?: number;
        platform_reliability?: number;
    }): Promise<RiskResponse>;
    safeRiskScore(body: {
        listing_id: string;
        platform?: string;
        time_to_sync?: number;
        platform_latency?: number;
        demand_score?: number;
        concurrent_requests?: number;
        platform_reliability?: number;
    }): Promise<RiskResponse>;
    availabilityProbability(body: {
        listing_id: string;
        last_sync_seconds_ago?: number;
        platform_latency?: number;
        api_success_rate?: number;
        booking_frequency?: number;
        listing_popularity?: number;
        traffic_spike?: number;
    }): Promise<AvailabilityProbResponse>;
    safeAvailabilityProbability(body: {
        listing_id: string;
        last_sync_seconds_ago?: number;
        platform_latency?: number;
        api_success_rate?: number;
        booking_frequency?: number;
        listing_popularity?: number;
        traffic_spike?: number;
    }): Promise<AvailabilityProbResponse>;
    demandForecast(body: {
        listing_id: string;
        hour_of_day?: number;
        seasonality?: number;
        traffic?: number;
    }): Promise<DemandForecastResponse>;
    safeDemandForecast(body: {
        listing_id: string;
        hour_of_day?: number;
        seasonality?: number;
        traffic?: number;
    }): Promise<DemandForecastResponse>;
    syncInterval(body: {
        demand_score: number;
        risk_score: number;
        platform_reliability?: number;
        traffic_volume?: number;
    }): Promise<SyncIntervalResponse>;
    safeSyncInterval(body: {
        demand_score: number;
        risk_score: number;
        platform_reliability?: number;
        traffic_volume?: number;
    }): Promise<SyncIntervalResponse>;
}
