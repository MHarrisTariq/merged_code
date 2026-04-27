import { useState } from "react";
import { useAuth } from "../auth/AuthContext";

export function AuditLogPage() {
  const { apiFetch, token } = useAuth();
  const [listingId, setListingId] = useState("");
  const [items, setItems] = useState<Record<string, unknown>[]>([]);

  async function load() {
    if (!token || !listingId) return;
    const r = await apiFetch(`/api/audit-logs?listingId=${encodeURIComponent(listingId)}`);
    if (!r.ok) return;
    const j = await r.json();
    setItems((j.items as Record<string, unknown>[]) || []);
  }

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Audit log</h1>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
          placeholder="listingId"
          value={listingId}
          onChange={(e) => setListingId(e.target.value)}
        />
        <button onClick={load} className="rounded-md bg-slate-200 text-slate-900 px-3 py-2 text-sm">
          Load
        </button>
      </div>
      <div className="overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Old</th>
              <th className="px-3 py-2">New</th>
              <th className="px-3 py-2">Reason</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row, i) => (
              <tr key={i} className="border-t border-slate-200">
                <td className="px-3 py-2">{String(row.date ?? "")}</td>
                <td className="px-3 py-2">{String(row.oldPrice ?? "")}</td>
                <td className="px-3 py-2">{String(row.newPrice ?? "")}</td>
                <td className="px-3 py-2">{String(row.reason ?? "")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
