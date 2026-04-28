import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";

export function PricingControlPage() {
  const { apiFetch, token } = useAuth();
  const [minP, setMinP] = useState(5);
  const [maxP, setMaxP] = useState(8000);
  const [kill, setKill] = useState(false);
  const [region, setRegion] = useState("gb");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      const key = prompt("Admin API key for /admin/config (X-Admin-Key)") || "";
      const r = await apiFetch("/api/admin/config", { headers: { "X-Admin-Key": key } });
      if (r.ok) {
        const j = await r.json();
        setKill(Boolean(j.kill_switch));
      }
    })();
  }, [apiFetch, token]);

  async function saveCaps() {
    const key = prompt("X-Admin-Key") || "";
    const r = await apiFetch("/api/admin/global-caps", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Key": key },
      body: JSON.stringify({
        min_price_gbp: minP,
        max_price_gbp: maxP,
        max_pct_change: 0.2,
        smoothing_alpha: 0.8,
      }),
    });
    setMsg(r.ok ? "Saved global caps" : "Failed — check admin key");
  }

  async function saveKill() {
    const key = prompt("X-Admin-Key") || "";
    const r = await apiFetch("/api/admin/kill-switch", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Key": key },
      body: JSON.stringify({ enabled: kill }),
    });
    setMsg(r.ok ? "Kill switch updated" : "Failed");
  }

  async function saveRegion() {
    const key = prompt("X-Admin-Key") || "";
    const r = await apiFetch("/api/admin/region-override", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Key": key },
      body: JSON.stringify({
        region,
        min_price_gbp: minP,
        max_price_gbp: maxP,
        max_pct_change: 0.2,
        smoothing_alpha: 0.8,
        multiplier: 1.0,
      }),
    });
    setMsg(r.ok ? "Region override saved" : "Failed");
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Pricing control</h1>
      <div className="max-w-xl space-y-4 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
        <label className="block text-sm text-slate-300">
          Min price (GBP): {minP}
          <input type="range" min={5} max={500} value={minP} onChange={(e) => setMinP(Number(e.target.value))} className="w-full" />
        </label>
        <label className="block text-sm text-slate-300">
          Max price (GBP): {maxP}
          <input type="range" min={50} max={12000} value={maxP} onChange={(e) => setMaxP(Number(e.target.value))} className="w-full" />
        </label>
        <button onClick={saveCaps} className="rounded-md bg-sky-600 px-3 py-2 text-sm">
          Save global caps
        </button>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={kill} onChange={(e) => setKill(e.target.checked)} />
            Kill switch
          </label>
          <button onClick={saveKill} className="rounded-md bg-amber-600 px-3 py-2 text-sm">
            Apply
          </button>
        </div>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="region code"
          />
          <button onClick={saveRegion} className="rounded-md bg-slate-700 px-3 py-2 text-sm">
            Regional override
          </button>
        </div>
        {msg && <p className="text-sm text-slate-300">{msg}</p>}
      </div>
    </div>
  );
}
