import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { formatCurrency } from "../utils/format";

type Day = {
  date: string;
  price: number;
  demandLevel: string;
  overridden?: boolean;
};

export function ListingCalendarPage() {
  const { id } = useParams<{ id: string }>();
  const { apiFetch, token } = useAuth();
  const [days, setDays] = useState<Day[]>([]);
  const [pick, setPick] = useState<Day | null>(null);
  const [priceIn, setPriceIn] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const r = await fetch(`/api/pricing-calendar?listingId=${encodeURIComponent(id)}`);
    if (!r.ok) return;
    const j = (await r.json()) as { days?: Day[] };
    setDays(Array.isArray(j.days) ? j.days.slice(0, 120) : []);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveOverride() {
    if (!token || !id || !pick) return;
    const price = Number(priceIn);
    if (!Number.isFinite(price) || price <= 0) {
      setMsg("Enter a valid price");
      return;
    }
    const r = await apiFetch("/api/override-price", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listingId: id,
        date: pick.date,
        price,
        reason: "manual override",
      }),
    });
    setMsg(r.ok ? "Saved override" : "Override failed");
    if (r.ok) {
      setPick(null);
      void load();
    }
  }

  return (
    <section className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900">Pricing calendar</h1>
        <Link to={`/car/listing/${encodeURIComponent(String(id))}/settings`} className="text-sm text-blue-700 hover:underline">
          Settings
        </Link>
      </div>

      {!token && (
        <p className="text-sm text-amber-800">Sign in (dashboard login) to save price overrides.</p>
      )}

      {msg && <p className="text-sm text-slate-600">{msg}</p>}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
        {days.map((d) => (
          <button
            key={d.date}
            type="button"
            onClick={() => {
              setPick(d);
              setPriceIn(String(d.price));
              setMsg(null);
            }}
            className={`rounded-lg border p-2 text-left text-xs ${
              d.overridden ? "border-amber-400 bg-amber-50" : "border-slate-200 bg-white"
            }`}
          >
            <div className="font-medium text-slate-700">{d.date.slice(5)}</div>
            <div className="text-slate-900">{formatCurrency(d.price)}</div>
            <div className="text-slate-500">{d.demandLevel}</div>
          </button>
        ))}
      </div>

      {pick && (
        <div className="max-w-md space-y-3 rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold">Override {pick.date}</h2>
          <label className="block text-sm">
            Price (GBP)
            <input
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1"
              value={priceIn}
              onChange={(e) => setPriceIn(e.target.value)}
            />
          </label>
          <button type="button" className="rounded-md bg-sky-600 px-3 py-2 text-sm text-white" onClick={() => void saveOverride()}>
            Save override
          </button>
          <button type="button" className="ml-2 text-sm text-slate-600" onClick={() => setPick(null)}>
            Cancel
          </button>
        </div>
      )}
    </section>
  );
}
