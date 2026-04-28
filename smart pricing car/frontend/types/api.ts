export type DemandLevel = "low" | "medium" | "high";

export interface ListingSummary {
  id: string;
  title: string;
  location: string;
  revenue?: number;
  occupancyRate?: number;
  avgPrice?: number;
  thumbnailUrl?: string;
  currency?: string;
}

export interface ListingDetail extends ListingSummary {
  description?: string;
  amenities?: string[];
  hostName?: string;
  basePrice?: number;
  minPrice?: number;
  maxPrice?: number;
  smartPricingEnabled?: boolean;
  discounts?: {
    weekly?: number;
    monthly?: number;
  };
}

export interface ListingSettings {
  listingId: string;
  minPrice: number;
  maxPrice: number;
  smartPricingEnabled: boolean;
  discounts?: {
    weekly?: number;
    monthly?: number;
  };
}

export interface TryValuesResponse {
  listingId: string;
  suggested: {
    minPrice: number;
    maxPrice: number;
  };
}

export interface PricingCalendarDay {
  date: string;
  price: number;
  demandLevel: DemandLevel;
  confidenceScore: number;
  overridden?: boolean;
  currency?: string;
}

export interface DemandDataPoint {
  date: string;
  demandScore: number;
  searchVolume?: number;
  bookings?: number;
}

export interface OverridePricePayload {
  listingId: string;
  date: string;
  price: number;
  reason?: string;
}

export interface OverridePriceResponse {
  success: boolean;
  message?: string;
  updated?: PricingCalendarDay;
}

export interface PricingSignals {
  listingId: string;
  date: string;
  price: number;
  hostGuardrails: {
    minPrice: number;
    maxPrice: number;
    applied: boolean;
  };
  demandSignals: {
    views: number;
    clicks: number;
    favorites: number;
    inquiries: number;
    bookings: number;
    conversionRate: number;
  };
  supplySignals: {
    similarCarsAvailable: number;
  };
  seasonality: {
    isWeekend: boolean;
    isPeakSeason: boolean;
    seasonalityFactor: number;
  };
  leadTime: {
    daysAhead: number;
    strategy: string;
  };
  explanationTags: string[];
}

export interface AuditLogItem {
  listingId: string;
  date: string;
  oldPrice: number;
  newPrice: number;
  reason?: string;
}

export interface ApiErrorPayload {
  message: string;
  status?: number;
  details?: unknown;
}
