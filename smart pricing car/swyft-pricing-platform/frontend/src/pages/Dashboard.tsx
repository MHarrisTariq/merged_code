import { useEffect, useState } from "react";
import { LineChartCard } from "../components/Chart";

export function DashboardPage() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    void (async () => {
      const r = await fetch("/api/listings");
      if (!r.ok) return;
      const data = await r.json();
      if (Array.isArray(data)) {
        setRows(
          data.slice(0, 20).map((x: Record<string, unknown>) => ({
            name: String(x.title ?? x.id),
            revenue: Number(x.revenue ?? 0),
            occupancy: Number((x as { occupancyRate?: number }).occupancyRate ?? 0) * 100,
          }))
        );
      }
    })();
  }, []);

  const conv = rows.length
    ? rows.reduce((a, r) => a + Number(r.occupancy ?? 0), 0) / rows.length / 100
    : 0;

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-slate-400">Revenue, occupancy, conversion (sample from listings).</p>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Listings (sample)" value={String(rows.length)} />
        <Stat label="Avg occupancy %" value={`${(rows.reduce((a, r) => a + Number(r.occupancy ?? 0), 0) / Math.max(rows.length, 1)).toFixed(1)}%`} />
        <Stat label="Conversion proxy" value={conv.toFixed(3)} />
      </div>
      <LineChartCard title="Revenue by listing" data={rows} xKey="name" yKey="revenue" />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
