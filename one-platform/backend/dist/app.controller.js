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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppController = void 0;
const common_1 = require("@nestjs/common");
const ai_client_service_1 = require("./ai/ai-client.service");
const kafka_service_1 = require("./kafka/kafka.service");
const app_service_1 = require("./app.service");
let AppController = class AppController {
    constructor(appService, ai, kafka) {
        this.appService = appService;
        this.ai = ai;
        this.kafka = kafka;
    }
    root() {
        return {
            name: 'SwyftBooking API',
            layer: 'deterministic-core',
            docs: '/api',
        };
    }
    health() {
        return this.appService.health();
    }
    async aiHealth() {
        try {
            const data = await this.ai.health();
            return { status: 'ok', ai: data };
        }
        catch {
            return { status: 'degraded', ai: { status: 'unreachable' } };
        }
    }
    kafkaHealth() {
        return { status: this.kafka.isConnected() ? 'ok' : 'degraded' };
    }
    platforms() {
        return {
            oneBackend: true,
            oneFrontend: true,
            modules: [
                {
                    id: 'booking',
                    name: 'Booking Management',
                    runtime: 'nestjs',
                    status: 'active',
                    routes: ['/api/bookings', '/api/health'],
                },
                {
                    id: 'car',
                    name: 'Car Pricing',
                    runtime: 'merged-source',
                    status: 'integrated-source',
                    source: 'frontend/src/modules/car',
                },
                {
                    id: 'airbnb',
                    name: 'Airbnb Pricing',
                    runtime: 'merged-source',
                    status: 'integrated-source',
                    source: 'frontend/src/modules/airbnb, backend/src/modules/airbnb_python',
                },
                {
                    id: 'seo',
                    name: 'SEO Optimization',
                    runtime: 'merged-source',
                    status: 'integrated-source',
                    source: 'frontend/src/modules/seo, backend/src/modules/seo_gateway',
                },
                {
                    id: 'subplan',
                    name: 'Subscription Plan',
                    runtime: 'merged-source',
                    status: 'integrated-source',
                    source: 'backend/src/modules/subplan_python',
                },
            ],
        };
    }
    platformById(id) {
        const details = {
            booking: {
                title: 'Booking Management',
                liveApi: ['/api/bookings', '/api/health', '/api/ai-health', '/api/kafka-health'],
            },
            car: {
                title: 'Car Pricing',
                mergedSources: ['frontend/src/modules/car'],
            },
            airbnb: {
                title: 'Airbnb Pricing',
                mergedSources: [
                    'frontend/src/modules/airbnb',
                    'backend/src/modules/airbnb_python',
                ],
            },
            seo: {
                title: 'SEO Optimization',
                mergedSources: ['frontend/src/modules/seo', 'backend/src/modules/seo_gateway'],
            },
            subplan: {
                title: 'Subscription Plan',
                mergedSources: ['backend/src/modules/subplan_python'],
            },
        };
        if (!(id in details)) {
            return { status: 'not_found', id };
        }
        return { id, ...details[id] };
    }
    seoBySlug(slug) {
        const parsed = this.parseRouteSlug(slug);
        const from = parsed?.from ?? 'New York';
        const to = parsed?.to ?? 'Miami';
        return {
            slug,
            from,
            to,
            content: `Find the best flights from ${from} to ${to} with demand-aware pricing and booking insights.`,
            faqs: [
                { q: `When is the best time to book ${from} to ${to}?`, a: 'Book 2-6 weeks ahead for stable fares.' },
                { q: `Are prices for ${from} to ${to} expected to change soon?`, a: 'Short-term volatility is moderate; monitor daily trends.' },
            ],
            internal_links: [
                { href: '/seo/flights/flights-from-london-to-paris', label: 'Flights from London to Paris' },
                { href: '/seo/flights/flights-from-dubai-to-delhi', label: 'Flights from Dubai to Delhi' },
            ],
        };
    }
    pricingByRoute(route) {
        const code = String(route || '').toUpperCase();
        const baseline = 120 + (code.length % 5) * 15;
        return {
            route: code,
            current_price: baseline,
            currency: 'USD',
            trend_7d_pct: 3.2,
        };
    }
    predictByRoute(route) {
        const code = String(route || '').toUpperCase();
        return {
            route: code,
            trend: 'rising',
            confidence: 0.81,
            recommendation: `For ${code}, book soon — prices are likely to increase in the next 7 days.`,
        };
    }
    track(body) {
        return {
            ok: true,
            received: {
                event: body?.event ?? null,
                timestamp: body?.timestamp ?? new Date().toISOString(),
            },
        };
    }
    parseRouteSlug(slug) {
        const m = String(slug || '').match(/^flights-from-(.+)-to-(.+)$/);
        if (!m)
            return null;
        const toTitle = (s) => s
            .split('-')
            .filter(Boolean)
            .map((x) => x.charAt(0).toUpperCase() + x.slice(1))
            .join(' ');
        return { from: toTitle(m[1]), to: toTitle(m[2]) };
    }
};
exports.AppController = AppController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "root", null);
__decorate([
    (0, common_1.Get)('health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "health", null);
__decorate([
    (0, common_1.Get)('ai-health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AppController.prototype, "aiHealth", null);
__decorate([
    (0, common_1.Get)('kafka-health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "kafkaHealth", null);
__decorate([
    (0, common_1.Get)('platforms'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AppController.prototype, "platforms", null);
__decorate([
    (0, common_1.Get)('platforms/:id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "platformById", null);
__decorate([
    (0, common_1.Get)('seo/:slug'),
    __param(0, (0, common_1.Param)('slug')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "seoBySlug", null);
__decorate([
    (0, common_1.Get)('pricing/:route'),
    __param(0, (0, common_1.Param)('route')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "pricingByRoute", null);
__decorate([
    (0, common_1.Get)('predict/:route'),
    __param(0, (0, common_1.Param)('route')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "predictByRoute", null);
__decorate([
    (0, common_1.Post)('track'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AppController.prototype, "track", null);
exports.AppController = AppController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [app_service_1.AppService,
        ai_client_service_1.AiClientService,
        kafka_service_1.KafkaService])
], AppController);
//# sourceMappingURL=app.controller.js.map