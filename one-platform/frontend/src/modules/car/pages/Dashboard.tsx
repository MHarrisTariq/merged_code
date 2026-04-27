import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DualLineChartCard, LineChartCard } from "../components/Chart";
import { ListingCard } from "../components/ListingCard";
import type { ListingSummary } from "../types";
import { formatCurrency, formatPercent } from "../utils/format";

type DemandPoint = { date: string; demandScore: number; bookings?: number; searchVolume?: number };

export function DashboardPage() {
  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [revenueRows, setRevenueRows] = useState<Record<string, unknown>[]>([]);
  const [demandRows, setDemandRows] = useState<Record<string, unknown>[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string>("");

  const load = useCallback(async () => {
    const r = await fetch("/api/listings");
    if (!r.ok) return;
    const data = await r.json();
    if (!Array.isArray(data)) return;

    const mapped: ListingSummary[] = data.map((x: Record<string, unknown>) => ({
      id: String(x.id ?? ""),
      title: String(x.title ?? x.id),
      location: String(x.location ?? x.city ?? ""),
      revenue: x.revenue != null ? Number(x.revenue) : undefined,
      occupancyRate: x.occupancyRate != null ? Number(x.occupancyRate) : undefined,
      avgPrice: x.avgPrice != null ? Number(x.avgPrice) : undefined,
      currency: x.currency != null ? String(x.currency) : "GBP",
    }));
    const valid = mapped.filter((x) => x.id);
    setListings(valid);

    setRevenueRows(
      data.slice(0, 20).map((x: Record<string, unknown>) => ({
        name: String(x.title ?? x.id),
        revenue: Number(x.revenue ?? 0),
      })),
    );

    const lead = valid[0]?.id;
    if (lead) {
      const dRes = await fetch(`/api/demand-data?listingId=${encodeURIComponent(lead)}`);
      if (dRes.ok) {
        const dj = (await dRes.json()) as { points?: DemandPoint[] };
        const points = Array.isArray(dj.points) ? dj.points.slice(-30) : [];
        setDemandRows(
          points.map((p) => ({
            date: p.date.slice(5),
            demand: Number(p.demandScore ?? 0) * 100,
            bookings: Number(p.bookings ?? 0),
          })),
        );
      }
    }

    setUpdatedAt(new Date().toLocaleTimeString());
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [load]);

  const revenue = listings.reduce((s, x) => s + (x.revenue ?? 0), 0);
  const avgOcc = listings.length
    ? listings.reduce((s, x) => s + (x.occupancyRate ?? 0), 0) / listings.length
    : 0;
  const avgPrice = listings.length
    ? listings.reduce((s, x) => s + (x.avgPrice ?? 0), 0) / listings.length
    : 0;

  const activeBookingsProxy = useMemo(
    () => Math.round(listings.reduce((s, x) => s + (x.occupancyRate ?? 0), 0) * 10),
    [listings],
  );

  return (
    <section className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-600">Real-time host analytics and portfolio performance.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">Updated: {updatedAt || "�"}</span>
          <Link to="/car/search" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">
            Guest search
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Projected Revenue" value={formatCurrency(revenue)} />
        <StatCard title="Estimated Occupancy" value={formatPercent(avgOcc)} />
        <StatCard title="Average Daily Rate" value={formatCurrency(avgPrice)} />
        <StatCard title="Active Bookings (proxy)" value={String(activeBookingsProxy)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <LineChartCard title="Revenue by listing (sample)" data={revenueRows} xKey="name" yKey="revenue" />
        <DualLineChartCard
          title="Demand vs bookings (last 30 days)"
          data={demandRows}
          xKey="date"
          lines={[
            { key: "demand", label: "Demand %", color: "#0ea5e9" },
            { key: "bookings", label: "Bookings", color: "#22c55e" },
          ]}
        />
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-900">Listings</h2>
        {listings.length === 0 ? (
          <p className="text-sm text-slate-500">No listings loaded (is the car API running?).</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {listings.map((listing, idx) => (
              <ListingCard key={`${listing.id}-${idx}`} listing={listing} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
