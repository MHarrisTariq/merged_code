"use client";

import { useParams } from "next/navigation";

import { PriceBreakdown } from "@/components/PriceBreakdown";
import { TooltipExplain } from "@/components/TooltipExplain";
import { EmptyState, ErrorState, SkeletonCard } from "@/components/uiStates";
import { useListing } from "@/hooks/useListing";
import { usePricingCalendar } from "@/hooks/usePricingCalendar";
import { formatCurrency } from "@/utils/format";

export default function ListingDetailsPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const listing = useListing(id);
  const calendar = usePricingCalendar(id);

  if (listing.isError || calendar.isError) {
    return <ErrorState message="Unable to load listing details." />;
  }

  if (listing.isLoading || calendar.isLoading) {
    return <SkeletonCard />;
  }

  if (!listing.data) {
    return <EmptyState title="Listing not found" description="Listing API returned no data." />;
  }

  const firstDay = calendar.data?.[0];
  const basePrice = firstDay?.price ?? listing.data.basePrice ?? listing.data.avgPrice ?? 0;
  const recommended = firstDay?.price ?? basePrice;

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">{listing.data.title}</h1>
          <TooltipExplain text="Price recommendation reflects current backend dynamic pricing calculations." />
        </div>
        <p className="text-sm text-slate-500">{listing.data.location}</p>
        <p className="mt-4 text-sm text-slate-700">{listing.data.description ?? "No description provided."}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Current price</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(recommended, listing.data.currency)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Average price</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(listing.data.avgPrice ?? 0, listing.data.currency)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Base price</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(basePrice, listing.data.currency)}</p>
        </div>
      </div>

      <PriceBreakdown
        baseModelPrice={basePrice}
        recommendedPrice={recommended}
        components={{
          demand_factor: 1,
          seasonality_factor: 1,
          lead_time_factor: 1,
          quality_factor: 1,
          supply_factor: 1,
        }}
        currency={listing.data.currency}
      />
    </section>
  );
}
