import { api } from "@/services/api";
import type {
  AuditLogItem,
  DemandDataPoint,
  ListingDetail,
  ListingSettings,
  ListingSummary,
  OverridePricePayload,
  OverridePriceResponse,
  PricingSignals,
  PricingCalendarDay,
  TryValuesResponse,
} from "@/types/api";

type JsonRecord = Record<string, unknown>;

const asRecord = (value: unknown): JsonRecord =>
  typeof value === "object" && value !== null ? (value as JsonRecord) : {};

const toDemandLevel = (value: unknown): "low" | "medium" | "high" => {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "high" || raw === "medium" || raw === "low") return raw;
  const num = Number(value);
  if (!Number.isNaN(num)) {
    if (num >= 0.67) return "high";
    if (num >= 0.34) return "medium";
    return "low";
  }
  return "medium";
};

const mapCalendarDay = (input: unknown): PricingCalendarDay => {
  const day = asRecord(input);
  return {
    date: String(day.date ?? day.day ?? new Date().toISOString().slice(0, 10)),
    price: Number(day.price ?? day.recommended_price ?? day.amount ?? 0),
    demandLevel: toDemandLevel(day.demandLevel ?? day.demand_level ?? day.demand_score),
    confidenceScore: Number(day.confidenceScore ?? day.confidence_score ?? 0.75),
    overridden: Boolean(day.overridden ?? day.is_overridden),
    currency: String(day.currency ?? "GBP"),
  };
};

const mapListingSummary = (input: unknown): ListingSummary => {
  const listing = asRecord(input);
  return {
    id: String(listing.id ?? listing.listingId ?? listing._id ?? ""),
    title: String(listing.title ?? listing.name ?? "Untitled listing"),
    location: String(listing.location ?? listing.city ?? listing.country ?? "Unknown"),
    revenue: listing.revenue != null ? Number(listing.revenue) : undefined,
    occupancyRate:
      listing.occupancyRate != null
        ? Number(listing.occupancyRate)
        : listing.occupancy != null
        ? Number(listing.occupancy)
        : undefined,
    avgPrice:
      listing.avgPrice != null
        ? Number(listing.avgPrice)
        : listing.average_price != null
        ? Number(listing.average_price)
        : undefined,
    thumbnailUrl: (listing.thumbnailUrl as string | undefined) ?? (listing.thumbnail as string | undefined),
    currency: (listing.currency as string | undefined) ?? "GBP",
  };
};

export const pricingService = {
  async getListings(): Promise<ListingSummary[]> {
    const { data } = await api.get("/listings");
    const items = Array.isArray(data) ? data : data?.items ?? data?.listings ?? [];
    return items.map(mapListingSummary).filter((x: ListingSummary) => x.id);
  },

  async getListing(id: string): Promise<ListingDetail> {
    const { data } = await api.get(`/listing/${id}`);
    const details = asRecord(data);
    const summary = mapListingSummary(data);
    return {
      ...summary,
      description: details.description as string | undefined,
      amenities: Array.isArray(details.amenities) ? (details.amenities as string[]) : undefined,
      hostName: (details.hostName as string | undefined) ?? (details.host_name as string | undefined),
      basePrice: details.basePrice != null ? Number(details.basePrice) : undefined,
      minPrice: details.minPrice != null ? Number(details.minPrice) : undefined,
      maxPrice: details.maxPrice != null ? Number(details.maxPrice) : undefined,
      smartPricingEnabled:
        details.smartPricingEnabled != null
          ? Boolean(details.smartPricingEnabled)
          : details.smart_pricing_enabled != null
          ? Boolean(details.smart_pricing_enabled)
          : undefined,
      discounts: details.discounts as ListingDetail["discounts"],
    };
  },

  async getListingSettings(id: string): Promise<ListingSettings> {
    const { data } = await api.get(`/listing/${id}/settings`);
    return {
      listingId: String(data?.listingId ?? id),
      minPrice: Number(data?.minPrice ?? 0),
      maxPrice: Number(data?.maxPrice ?? 0),
      smartPricingEnabled: Boolean(data?.smartPricingEnabled ?? true),
      discounts: data?.discounts,
    };
  },

  async updateListingSettings(id: string, payload: Omit<ListingSettings, "listingId">): Promise<ListingSettings> {
    const { data } = await api.put(`/listing/${id}/settings`, payload);
    return {
      listingId: String(data?.listingId ?? id),
      minPrice: Number(data?.minPrice ?? 0),
      maxPrice: Number(data?.maxPrice ?? 0),
      smartPricingEnabled: Boolean(data?.smartPricingEnabled ?? true),
      discounts: data?.discounts,
    };
  },

  async getTryValues(listingId: string): Promise<TryValuesResponse> {
    const { data } = await api.get("/pricing-try-values", { params: { listingId } });
    return {
      listingId: String(data?.listingId ?? listingId),
      suggested: {
        minPrice: Number(data?.suggested?.minPrice ?? 0),
        maxPrice: Number(data?.suggested?.maxPrice ?? 0),
      },
    };
  },

  async getPricingCalendar(listingId: string): Promise<PricingCalendarDay[]> {
    const { data } = await api.get("/pricing-calendar", { params: { listingId } });
    const days = Array.isArray(data) ? data : data?.days ?? data?.calendar ?? [];
    return days.map(mapCalendarDay);
  },

  async getDemandData(listingId: string): Promise<DemandDataPoint[]> {
    const { data } = await api.get("/demand-data", { params: { listingId } });
    const points = Array.isArray(data) ? data : data?.points ?? data?.data ?? [];
    return points.map((input: unknown) => {
      const p = asRecord(input);
      return {
        date: String(p.date ?? p.day ?? new Date().toISOString().slice(0, 10)),
        demandScore: Number(p.demandScore ?? p.demand_score ?? p.score ?? 0),
        searchVolume: p.searchVolume != null ? Number(p.searchVolume) : undefined,
        bookings: p.bookings != null ? Number(p.bookings) : undefined,
      };
    });
  },

  async overridePrice(payload: OverridePricePayload): Promise<OverridePriceResponse> {
    const { data } = await api.post("/override-price", payload);
    return {
      success: Boolean(data?.success ?? true),
      message: data?.message,
      updated: data?.updated ? mapCalendarDay(data.updated) : undefined,
    };
  },

  async getPricingSignals(listingId: string, dateValue?: string): Promise<PricingSignals> {
    const { data } = await api.get("/pricing-signals", { params: { listingId, dateValue } });
    return {
      listingId: String(data?.listingId ?? listingId),
      date: String(data?.date ?? new Date().toISOString().slice(0, 10)),
      price: Number(data?.price ?? 0),
      hostGuardrails: {
        minPrice: Number(data?.hostGuardrails?.minPrice ?? 0),
        maxPrice: Number(data?.hostGuardrails?.maxPrice ?? 0),
        applied: Boolean(data?.hostGuardrails?.applied),
      },
      demandSignals: {
        views: Number(data?.demandSignals?.views ?? 0),
        clicks: Number(data?.demandSignals?.clicks ?? 0),
        favorites: Number(data?.demandSignals?.favorites ?? 0),
        inquiries: Number(data?.demandSignals?.inquiries ?? 0),
        bookings: Number(data?.demandSignals?.bookings ?? 0),
        conversionRate: Number(data?.demandSignals?.conversionRate ?? 0),
      },
      supplySignals: {
        similarCarsAvailable: Number(data?.supplySignals?.similarCarsAvailable ?? 0),
      },
      seasonality: {
        isWeekend: Boolean(data?.seasonality?.isWeekend),
        isPeakSeason: Boolean(data?.seasonality?.isPeakSeason),
        seasonalityFactor: Number(data?.seasonality?.seasonalityFactor ?? 1),
      },
      leadTime: {
        daysAhead: Number(data?.leadTime?.daysAhead ?? 0),
        strategy: String(data?.leadTime?.strategy ?? "standard"),
      },
      explanationTags: Array.isArray(data?.explanationTags) ? data.explanationTags.map(String) : [],
    };
  },

  async getAuditLogs(listingId: string): Promise<AuditLogItem[]> {
    const { data } = await api.get("/audit-logs", { params: { listingId } });
    const items = Array.isArray(data?.items) ? data.items : [];
    return items.map((item: unknown) => {
      const row = asRecord(item);
      return {
        listingId: String(row.listingId ?? listingId),
        date: String(row.date ?? ""),
        oldPrice: Number(row.oldPrice ?? 0),
        newPrice: Number(row.newPrice ?? 0),
        reason: row.reason != null ? String(row.reason) : undefined,
      };
    });
  },
};
