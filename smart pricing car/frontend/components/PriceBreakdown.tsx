"use client";

import { formatCurrency } from "@/utils/format";

interface PriceBreakdownProps {
  baseModelPrice: number;
  recommendedPrice: number;
  components: Record<string, number>;
  currency?: string;
}

export function PriceBreakdown({ baseModelPrice, recommendedPrice, components, currency = "GBP" }: PriceBreakdownProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-base font-semibold text-slate-900">Price Breakdown</h3>
      <dl className="mt-3 space-y-1 text-sm text-slate-600">
        <div className="flex justify-between"><dt>Base model</dt><dd>{formatCurrency(baseModelPrice, currency)}</dd></div>
        {Object.entries(components)
          .filter(([k]) => k.endsWith("factor"))
          .map(([k, v]) => (
            <div key={k} className="flex justify-between"><dt>{k.replaceAll("_", " ")}</dt><dd>{v.toFixed(2)}</dd></div>
          ))}
        <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-semibold text-slate-900">
          <dt>Recommended</dt>
          <dd>{formatCurrency(recommendedPrice, currency)}</dd>
        </div>
      </dl>
    </div>
  );
}
