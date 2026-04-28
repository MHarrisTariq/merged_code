"use client";

import type { PricingCalendarDay } from "@/types/api";
import { formatCurrency, formatDate } from "@/utils/format";

import { ConfidenceBadge } from "./ConfidenceBadge";

interface PriceCellProps {
  day: PricingCalendarDay;
  onClick: (day: PricingCalendarDay) => void;
}

const demandTone: Record<string, string> = {
  low: "bg-emerald-50",
  medium: "bg-amber-50",
  high: "bg-rose-50",
};

export function PriceCell({ day, onClick }: PriceCellProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(day)}
      className={`rounded-lg border border-slate-200 p-2 text-left transition hover:border-blue-400 ${
        demandTone[day.demandLevel] ?? "bg-white"
      }`}
    >
      <div className="text-xs text-slate-500">{formatDate(day.date)}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{formatCurrency(day.price, day.currency)}</div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] capitalize text-slate-500">{day.demandLevel}</span>
        <ConfidenceBadge score={day.confidenceScore} />
      </div>
    </button>
  );
}
