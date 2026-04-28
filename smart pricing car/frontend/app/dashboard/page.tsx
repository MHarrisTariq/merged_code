"use client";

import Link from "next/link";

import { ListingCard } from "@/components/ListingCard";
import { EmptyState, ErrorState, SkeletonCard } from "@/components/uiStates";
import { useListings } from "@/hooks/useListings";
import { formatCurrency, formatPercent } from "@/utils/format";

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { data = [], isLoading, isError, error } = useListings();

  if (isError) {
    return <ErrorState message={(error as { message?: string })?.message ?? "Unable to load dashboard data."} />;
  }

  const revenue = data.reduce((sum, item) => sum + (item.revenue ?? 0), 0);
  const avgOccupancy = data.length
    ? data.reduce((sum, item) => sum + (item.occupancyRate ?? 0), 0) / data.length
    : 0;
  const avgPrice = data.length
    ? data.reduce((sum, item) => sum + (item.avgPrice ?? 0), 0) / data.length
    : 0;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-600">Live portfolio metrics powered by backend APIs.</p>
        </div>
        <Link href="/search" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">
          Guest Search
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Revenue" value={formatCurrency(revenue)} />
        <StatCard title="Occupancy" value={formatPercent(avgOccupancy)} />
        <StatCard title="Average Price" value={formatCurrency(avgPrice)} />
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Listings</h2>
        {isLoading && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <SkeletonCard key={idx} />
            ))}
          </div>
        )}

        {!isLoading && !data.length && (
          <EmptyState title="No listings found" description="Listings API returned no records." />
        )}

        {!isLoading && data.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.map((listing, idx) => (
              <ListingCard key={`${listing.id}-${idx}`} listing={listing} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
