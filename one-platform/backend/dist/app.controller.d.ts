import { AiClientService } from './ai/ai-client.service';
import { KafkaService } from './kafka/kafka.service';
import { AppService } from './app.service';
export declare class AppController {
    private readonly appService;
    private readonly ai;
    private readonly kafka;
    constructor(appService: AppService, ai: AiClientService, kafka: KafkaService);
    root(): {
        name: string;
        layer: string;
        docs: string;
    };
    health(): {
        status: string;
        service: string;
    };
    aiHealth(): Promise<{
        status: string;
        ai: {
            status: string;
            risk_model_loaded?: boolean;
        };
    }>;
    kafkaHealth(): {
        status: string;
    };
    platforms(): {
        oneBackend: boolean;
        oneFrontend: boolean;
        modules: ({
            id: string;
            name: string;
            runtime: string;
            status: string;
            routes: string[];
            source?: undefined;
        } | {
            id: string;
            name: string;
            runtime: string;
            status: string;
            source: string;
            routes?: undefined;
        })[];
    };
    platformById(id: string): {
        status: string;
        id: string;
    } | {
        id: string;
        status?: undefined;
    };
    seoBySlug(slug: string): {
        slug: string;
        from: string;
        to: string;
        content: string;
        faqs: {
            q: string;
            a: string;
        }[];
        internal_links: {
            href: string;
            label: string;
        }[];
    };
    pricingByRoute(route: string): {
        route: string;
        current_price: number;
        currency: string;
        trend_7d_pct: number;
    };
    predictByRoute(route: string): {
        route: string;
        trend: string;
        confidence: number;
        recommendation: string;
    };
    track(body: Record<string, unknown>): {
        ok: boolean;
        received: {
            event: {} | null;
            timestamp: {};
        };
    };
    private parseRouteSlug;
}
