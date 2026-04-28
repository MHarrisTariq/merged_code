"use client";

import { useMemo, useState } from "react";

import type { PricingCalendarDay } from "@/types/api";

import { EmptyState } from "./uiStates";
import { PriceCell } from "./PriceCell";
import { PriceEditModal } from "./PriceEditModal";

interface PriceCalendarProps {
  listingId: string;
  days: PricingCalendarDay[];
  submitting?: boolean;
  onOverride: (input: { listingId: string; date: string; price: number; reason?: string }) => void;
}

export function PriceCalendar({ listingId, days, onOverride, submitting }: PriceCalendarProps) {
  const [selected, setSelected] = useState<PricingCalendarDay | null>(null);

  const first365 = useMemo(() => days.slice(0, 365), [days]);

  if (!first365.length) {
    return <EmptyState title="No pricing data" description="This listing has no calendar data yet." />;
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
        {first365.map((day) => (
          <PriceCell key={day.date} day={day} onClick={setSelected} />
        ))}
      </div>

      <PriceEditModal
        key={selected?.date ?? "closed"}
        listingId={listingId}
        day={selected}
        open={Boolean(selected)}
        submitting={submitting}
        onClose={() => setSelected(null)}
        onSubmit={(payload) => {
          onOverride(payload);
          setSelected(null);
        }}
      />
    </>
  );
}
