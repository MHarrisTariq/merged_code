import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ListingCard } from "../components/ListingCard";
import type { ListingSummary } from "../types";

export function SearchPage() {
  const [q, setQ] = useState("");
  const [data, setData] = useState<ListingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setErr(null);
      try {
        const r = await fetch("/api/listings");
        if (!r.ok) throw new Error(String(r.status));
        const raw = (await r.json()) as unknown;
        const items = Array.isArray(raw) ? raw : [];
        const mapped: ListingSummary[] = items.map((row: Record<string, unknown>) => ({
          id: String(row.id ?? ""),
          title: String(row.title ?? row.name ?? "Listing"),
          location: String(row.location ?? row.city ?? ""),
          revenue: row.revenue != null ? Number(row.revenue) : undefined,
          occupancyRate: row.occupancyRate != null ? Number(row.occupancyRate) : undefined,
          avgPrice: row.avgPrice != null ? Number(row.avgPrice) : undefined,
          currency: row.currency != null ? String(row.currency) : "GBP",
        }));
        setData(mapped.filter((x) => x.id));
      } catch {
        setErr("Unable to load listings.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return data;
    return data.filter((item) => `${item.title} ${item.location}`.toLowerCase().includes(needle));
  }, [q, data]);

  return (
    <section className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Guest listing search</h1>
        <Link to="/car" className="text-sm text-blue-700 hover:underline">
          Back to dashboard
        </Link>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by title or location"
        className="w-full max-w-xl rounded-lg border border-slate-300 bg-white px-4 py-2"
      />

      {err && <p className="text-sm text-red-600">{err}</p>}

      {loading && <p className="text-sm text-slate-500">Loading…</p>}

      {!loading && !filtered.length && (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">No results.</p>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((listing, idx) => (
            <ListingCard key={`${listing.id}-${idx}`} listing={listing} />
          ))}
        </div>
      )}
    </section>
  );
}
