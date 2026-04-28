"use client";

import { useParams } from "next/navigation";

import { DemandChart } from "@/components/DemandChart";
import { EmptyState, ErrorState, SkeletonCard } from "@/components/uiStates";
import { useDemandData } from "@/hooks/useDemandData";
import { useListing } from "@/hooks/useListing";

export default function InsightsPage() {
  const params = useParams<{ listingId: string }>();
  const listingId = params.listingId;

  const listing = useListing(listingId);
  const demand = useDemandData(listingId);

  if (listing.isError || demand.isError) {
    return <ErrorState message="Unable to load insights data." />;
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Demand Insights {listing.data ? `• ${listing.data.title}` : ""}</h1>
      {(listing.isLoading || demand.isLoading) && <SkeletonCard />}

      {!demand.isLoading && (demand.data?.length ?? 0) === 0 ? (
        <EmptyState title="No demand data" description="Demand API returned no points for this listing." />
      ) : (
        <DemandChart points={demand.data ?? []} />
      )}
    </section>
  );
}
