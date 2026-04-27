import { AiClientService, RiskResponse } from '../ai/ai-client.service';
export type Decision = {
    outcome: 'approve';
    risk: RiskResponse;
    availabilityProb: number;
    demandScore: number;
} | {
    outcome: 'block';
    reason: string;
    risk?: RiskResponse;
    availabilityProb?: number;
} | {
    outcome: 'delay';
    reason: string;
    risk: RiskResponse;
    availabilityProb: number;
    demandScore: number;
};
export declare class DecisionEngineService {
    private readonly ai;
    constructor(ai: AiClientService);
    evaluate(params: {
        listingId: string;
        platform?: string;
        hourOfDay: number;
        concurrentHint?: number;
    }): Promise<Decision>;
}
