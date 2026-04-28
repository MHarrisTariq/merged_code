"use client";

import type { DemandDataPoint } from "@/types/api";
import { formatDate } from "@/utils/format";

interface DemandChartProps {
  points: DemandDataPoint[];
}

export function DemandChart({ points }: DemandChartProps) {
  if (!points.length) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">No demand data available.</div>;
  }

  const max = Math.max(...points.map((p) => p.demandScore), 1);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="mb-4 text-base font-semibold text-slate-900">Demand Trend</h3>
      <div className="flex h-56 items-end gap-2 overflow-x-auto">
        {points.map((point) => (
          <div key={point.date} className="flex min-w-10 flex-col items-center gap-1">
            <div
              className="w-8 rounded-t bg-blue-500"
              style={{ height: `${Math.max(6, (point.demandScore / max) * 180)}px` }}
              title={`Demand: ${point.demandScore.toFixed(2)}`}
            />
            <span className="text-[10px] text-slate-500">{formatDate(point.date)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
