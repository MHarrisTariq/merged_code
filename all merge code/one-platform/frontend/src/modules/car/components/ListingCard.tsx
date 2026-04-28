import { Link } from "react-router-dom";
import type { ListingSummary } from "../types";
import { formatCurrency, formatPercent } from "../utils/format";

export function ListingCard({ listing }: { listing: ListingSummary }) {
  const cur = listing.currency ?? "GBP";
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{listing.title}</h3>
          <p className="text-sm text-slate-500">{listing.location}</p>
        </div>
        {listing.avgPrice != null && (
          <p className="text-sm font-semibold text-blue-700">{formatCurrency(listing.avgPrice, cur)}</p>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-slate-600">
        <div>Revenue: {listing.revenue != null ? formatCurrency(listing.revenue, cur) : "—"}</div>
        <div>Occupancy: {listing.occupancyRate != null ? formatPercent(listing.occupancyRate) : "—"}</div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to={`/car/listing/${encodeURIComponent(listing.id)}/calendar`}
          className="rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white"
        >
          Pricing calendar
        </Link>
        <Link
          to={`/car/listing/${encodeURIComponent(listing.id)}/settings`}
          className="rounded-md border border-blue-300 px-3 py-2 text-xs font-medium text-blue-700"
        >
          Settings
        </Link>
        <Link
          to={`/car/listing/${encodeURIComponent(listing.id)}/insights`}
          className="rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700"
        >
          Insights
        </Link>
        <Link
          to={`/car/listing/${encodeURIComponent(listing.id)}`}
          className="rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600"
        >
          Details
        </Link>
      </div>
    </article>
  );
}
