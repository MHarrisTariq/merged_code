"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { AuditLogTable } from "@/components/AuditLogTable";
import { PriceCalendar } from "@/components/PriceCalendar";
import { SignalsPanel } from "@/components/SignalsPanel";
import { TooltipExplain } from "@/components/TooltipExplain";
import { useToast } from "@/components/ToastProvider";
import { EmptyState, ErrorState, SkeletonCard } from "@/components/uiStates";
import { useListing } from "@/hooks/useListing";
import { useOverridePrice, usePricingCalendar } from "@/hooks/usePricingCalendar";
import { useAuditLogs, usePricingSignals } from "@/hooks/usePricingSignals";

export default function PricingPage() {
  const params = useParams<{ listingId: string }>();
  const listingId = params.listingId;
  const { pushToast } = useToast();

  const listingQuery = useListing(listingId);
  const calendarQuery = usePricingCalendar(listingId);
  const overrideMutation = useOverridePrice(listingId);
  const firstDate = calendarQuery.data?.[0]?.date;
  const signalsQuery = usePricingSignals(listingId, firstDate);
  const auditQuery = useAuditLogs(listingId);

  if (listingQuery.isError || calendarQuery.isError || signalsQuery.isError || auditQuery.isError) {
    return <ErrorState message="Unable to load pricing data. Please try again." />;
  }

  const days = calendarQuery.data ?? [];

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">
            Pricing Calendar {listingQuery.data ? `• ${listingQuery.data.title}` : ""}
          </h1>
          <TooltipExplain text="Click any date to override price. Changes are saved immediately and reflected optimistically." />
        </div>
        <Link
          href={`/settings/${listingId}`}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Open Settings
        </Link>
      </div>

      {(listingQuery.isLoading || calendarQuery.isLoading) && (
        <div className="grid gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <SkeletonCard key={idx} />
          ))}
        </div>
      )}

      {!calendarQuery.isLoading && !days.length && (
        <EmptyState title="No calendar entries" description="Pricing calendar API returned empty data for this listing." />
      )}

      {!calendarQuery.isLoading && days.length > 0 && (
        <PriceCalendar
          listingId={listingId}
          days={days}
          submitting={overrideMutation.isPending}
          onOverride={(payload) => {
            overrideMutation.mutate(payload, {
              onSuccess: () => pushToast("Price override saved", "success"),
              onError: (error) =>
                pushToast((error as { message?: string }).message ?? "Failed to save override", "error"),
            });
          }}
        />
      )}

      {signalsQuery.data && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Why this price</h2>
          <div className="flex flex-wrap gap-2">
            {signalsQuery.data.explanationTags.map((tag) => (
              <span key={tag} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                {tag}
              </span>
            ))}
          </div>
          <SignalsPanel signals={signalsQuery.data} />
        </section>
      )}

      <AuditLogTable logs={auditQuery.data ?? []} currency={listingQuery.data?.currency} />
    </section>
  );
}
