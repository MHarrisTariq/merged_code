import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { LineChartCard } from "../components/Chart";

export function SimulationPage() {
  const { apiFetch, token } = useAuth();
  const [curve, setCurve] = useState<Record<string, unknown>[]>([]);

  async function run() {
    if (!token) return;
    const key = prompt("Quote API key (X-API-Key) if required") || "";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (key) headers["X-API-Key"] = key;
    const r = await apiFetch("/api/simulate", {
      method: "POST",
      headers,
      body: JSON.stringify({}),
    });
    if (!r.ok) return;
    const j = await r.json();
    const c = (j.curve as Array<{ price_gbp: number; expected_revenue: number }>) || [];
    setCurve(c.map((x) => ({ price: x.price_gbp, revenue: x.expected_revenue })));
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Simulation</h1>
      <button onClick={run} className="rounded-md bg-sky-600 px-3 py-2 text-sm">
        Run /simulate (default body)
      </button>
      <LineChartCard title="Revenue vs price" data={curve} xKey="price" yKey="revenue" />
    </div>
  );
}
