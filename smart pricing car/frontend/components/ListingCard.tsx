"use client";

import Link from "next/link";

import type { ListingSummary } from "@/types/api";
import { formatCurrency, formatPercent } from "@/utils/format";

interface ListingCardProps {
  listing: ListingSummary;
}

export function ListingCard({ listing }: ListingCardProps) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{listing.title}</h3>
          <p className="text-sm text-slate-500">{listing.location}</p>
        </div>
        {listing.avgPrice != null && <p className="text-sm font-semibold text-blue-700">{formatCurrency(listing.avgPrice, listing.currency)}</p>}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-slate-600">
        <div>Revenue: {listing.revenue != null ? formatCurrency(listing.revenue, listing.currency) : "-"}</div>
        <div>Occupancy: {listing.occupancyRate != null ? formatPercent(listing.occupancyRate) : "-"}</div>
      </div>

      <div className="mt-4 flex gap-2">
        <Link href={`/pricing/${listing.id}`} className="rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white">Pricing</Link>
        <Link href={`/settings/${listing.id}`} className="rounded-md border border-blue-300 px-3 py-2 text-xs font-medium text-blue-700">
          Settings
        </Link>
        <Link href={`/insights/${listing.id}`} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700">Insights</Link>
      </div>
    </article>
  );
}
