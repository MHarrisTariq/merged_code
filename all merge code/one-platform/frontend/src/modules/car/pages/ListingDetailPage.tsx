import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatCurrency } from "../utils/format";

type ListingRow = Record<string, unknown>;

export function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [row, setRow] = useState<ListingRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const r = await fetch(`/api/listing/${encodeURIComponent(id)}`);
      if (r.ok) setRow((await r.json()) as ListingRow);
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="p-6 text-sm text-slate-500">Loading…</div>;
  if (!row) {
    return (
      <div className="p-6">
        <p className="text-red-600">Listing not found.</p>
        <Link to="/car/search" className="mt-2 inline-block text-sm text-blue-700">
          Back to search
        </Link>
      </div>
    );
  }

  const title = String(row.title ?? "Listing");
  const loc = String(row.location ?? row.city ?? "");
  const cur = String(row.currency ?? "GBP");
  const avg = Number(row.avgPrice ?? 0);
  const base = Number(row.basePrice ?? row.avgPrice ?? 0);

  return (
    <section className="space-y-6 p-6">
      <div className="flex flex-wrap gap-3">
        <Link to="/car/search" className="text-sm text-blue-700 hover:underline">
          ← Search
        </Link>
        <Link to={`/car/listing/${encodeURIComponent(String(id))}/calendar`} className="text-sm text-blue-700 hover:underline">
          Pricing calendar
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500">{loc}</p>
        <p className="mt-4 text-sm text-slate-700">{String(row.description ?? "No description.")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Average price</p>
          <p className="mt-2 text-2xl font-semibold">{formatCurrency(avg, cur)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Base price</p>
          <p className="mt-2 text-2xl font-semibold">{formatCurrency(base, cur)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Smart pricing</p>
          <p className="mt-2 text-2xl font-semibold">{row.smartPricingEnabled ? "On" : "Off"}</p>
        </div>
      </div>
    </section>
  );
}
