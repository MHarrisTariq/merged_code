import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatCurrency } from "../utils/format";

export function ListingInsightsPage() {
  const { id } = useParams<{ id: string }>();
  const [dateVal, setDateVal] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      const u = new URL("/api/pricing-signals", window.location.origin);
      u.searchParams.set("listingId", id);
      u.searchParams.set("dateValue", dateVal);
      const r = await fetch(u.toString());
      if (r.ok) setData((await r.json()) as Record<string, unknown>);
    })();
  }, [id, dateVal]);

  return (
    <section className="space-y-6 p-6">
      <Link to="/car/search" className="text-sm text-blue-700 hover:underline">
        ← Search
      </Link>
      <h1 className="text-2xl font-bold text-slate-900">Demand & pricing signals</h1>
      <label className="block max-w-xs text-sm">
        Date
        <input type="date" className="mt-1 w-full rounded border px-2 py-1" value={dateVal} onChange={(e) => setDateVal(e.target.value)} />
      </label>

      {!data && <p className="text-sm text-slate-500">Loading…</p>}

      {data && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase text-slate-500">Recommended price</p>
            <p className="mt-2 text-2xl font-semibold">{formatCurrency(Number(data.price ?? 0))}</p>
            <p className="mt-2 text-sm text-slate-600">{String(data.date ?? "")}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Explanation tags</p>
            <ul className="mt-2 list-disc pl-5">
              {Array.isArray(data.explanationTags)
                ? (data.explanationTags as string[]).map((t) => <li key={t}>{t}</li>)
                : null}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
