"use client";

import { useState } from "react";

import type { PricingCalendarDay } from "@/types/api";
import { formatCurrency, formatDate } from "@/utils/format";

interface PriceEditModalProps {
  listingId: string;
  day: PricingCalendarDay | null;
  open: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (input: { listingId: string; date: string; price: number; reason?: string }) => void;
}

export function PriceEditModal({ listingId, day, open, submitting, onClose, onSubmit }: PriceEditModalProps) {
  const [price, setPrice] = useState<number>(day?.price ?? 0);
  const [reason, setReason] = useState<string>("");

  if (!open || !day) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">Override price</h3>
        <p className="mt-1 text-sm text-slate-500">
          {formatDate(day.date)} • Current: {formatCurrency(day.price, day.currency)}
        </p>

        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            New price
            <input
              type="number"
              min={1}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Reason
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Optional reason"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting || !price}
            onClick={() => onSubmit({ listingId, date: day.date, price, reason })}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {submitting ? "Saving..." : "Save Override"}
          </button>
        </div>
      </div>
    </div>
  );
}
