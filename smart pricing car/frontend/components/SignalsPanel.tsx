import type { PricingSignals } from "@/types/api";
import { formatPercent } from "@/utils/format";

type Props = {
  signals: PricingSignals;
};

export function SignalsPanel({ signals }: Props) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Demand signals</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-700">
          <p>Views: {signals.demandSignals.views}</p>
          <p>Clicks: {signals.demandSignals.clicks}</p>
          <p>Favorites: {signals.demandSignals.favorites}</p>
          <p>Inquiries: {signals.demandSignals.inquiries}</p>
          <p>Bookings: {signals.demandSignals.bookings}</p>
          <p>Conversion: {formatPercent(signals.demandSignals.conversionRate)}</p>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Supply, seasonality, lead time</h2>
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          <p>Similar cars nearby: {signals.supplySignals.similarCarsAvailable}</p>
          <p>Seasonality factor: {signals.seasonality.seasonalityFactor.toFixed(2)}</p>
          <p>Weekend: {signals.seasonality.isWeekend ? "Yes" : "No"}</p>
          <p>Peak season: {signals.seasonality.isPeakSeason ? "Yes" : "No"}</p>
          <p>Days ahead: {signals.leadTime.daysAhead}</p>
          <p>Lead-time strategy: {signals.leadTime.strategy.replaceAll("_", " ")}</p>
        </div>
      </section>
    </div>
  );
}
