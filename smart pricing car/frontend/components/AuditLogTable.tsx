import type { AuditLogItem } from "@/types/api";
import { formatCurrency } from "@/utils/format";

type Props = {
  logs: AuditLogItem[];
  currency?: string;
};

export function AuditLogTable({ logs, currency }: Props) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">Audit logs</h2>
      {!logs.length ? (
        <p className="mt-3 text-sm text-slate-500">No manual price changes recorded yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-700">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Old</th>
                <th className="py-2 pr-4">New</th>
                <th className="py-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log, idx) => (
                <tr key={`${log.date}-${idx}`} className="border-b border-slate-100">
                  <td className="py-2 pr-4">{log.date}</td>
                  <td className="py-2 pr-4">{formatCurrency(log.oldPrice, currency)}</td>
                  <td className="py-2 pr-4">{formatCurrency(log.newPrice, currency)}</td>
                  <td className="py-2">{log.reason ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
