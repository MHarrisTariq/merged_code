import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AiClientService } from './ai/ai-client.service';
import { KafkaService } from './kafka/kafka.service';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly ai: AiClientService,
    private readonly kafka: KafkaService,
  ) {}

  @Get()
  root() {
    return {
      name: 'SwyftBooking API',
      layer: 'deterministic-core',
      docs: '/api',
    };
  }

  @Get('health')
  health() {
    return this.appService.health();
  }

  @Get('ai-health')
  async aiHealth() {
    try {
      const data = await this.ai.health();
      return { status: 'ok', ai: data };
    } catch {
      return { status: 'degraded', ai: { status: 'unreachable' } };
    }
  }

  @Get('kafka-health')
  kafkaHealth() {
    return { status: this.kafka.isConnected() ? 'ok' : 'degraded' };
  }

  @Get('platforms')
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

  @Get('platforms/:id')
  platformById(@Param('id') id: string) {
    const details: Record<string, unknown> = {
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
    return { id, ...(details[id] as object) };
  }

  @Get('seo/:slug')
  seoBySlug(@Param('slug') slug: string) {
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

  @Get('pricing/:route')
  pricingByRoute(@Param('route') route: string) {
    const code = String(route || '').toUpperCase();
    const baseline = 120 + (code.length % 5) * 15;
    return {
      route: code,
      current_price: baseline,
      currency: 'USD',
      trend_7d_pct: 3.2,
    };
  }

  @Get('predict/:route')
  predictByRoute(@Param('route') route: string) {
    const code = String(route || '').toUpperCase();
    return {
      route: code,
      trend: 'rising',
      confidence: 0.81,
      recommendation: `For ${code}, book soon — prices are likely to increase in the next 7 days.`,
    };
  }

  @Post('track')
  track(@Body() body: Record<string, unknown>) {
    return {
      ok: true,
      received: {
        event: body?.event ?? null,
        timestamp: body?.timestamp ?? new Date().toISOString(),
      },
    };
  }

  private parseRouteSlug(slug: string): { from: string; to: string } | null {
    const m = String(slug || '').match(/^flights-from-(.+)-to-(.+)$/);
    if (!m) return null;
    const toTitle = (s: string) =>
      s
        .split('-')
        .filter(Boolean)
        .map((x) => x.charAt(0).toUpperCase() + x.slice(1))
        .join(' ');
    return { from: toTitle(m[1]), to: toTitle(m[2]) };
  }
}
