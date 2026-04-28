"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { ListingCard } from "@/components/ListingCard";
import { EmptyState, ErrorState, SkeletonCard } from "@/components/uiStates";
import { useListings } from "@/hooks/useListings";

export default function SearchPage() {
  const [q, setQ] = useState("");
  const { data = [], isLoading, isError, error } = useListings();

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return data;
    return data.filter((item) => `${item.title} ${item.location}`.toLowerCase().includes(needle));
  }, [q, data]);

  if (isError) {
    return <ErrorState message={(error as { message?: string }).message ?? "Unable to load search data."} />;
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">Guest Listing Search</h1>
        <Link href="/dashboard" className="text-sm text-blue-700 hover:underline">
          Back to dashboard
        </Link>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by title or location"
        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2"
      />

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <SkeletonCard key={idx} />
          ))}
        </div>
      )}

      {!isLoading && !filtered.length && (
        <EmptyState title="No results" description="Try a different search term." />
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((listing, idx) => (
            <ListingCard key={`${listing.id}-${idx}`} listing={listing} />
          ))}
        </div>
      )}
    </section>
  );
}
