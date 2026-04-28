"use client";

import { useState } from "react";
import { useParams } from "next/navigation";

import { PriceRangeSlider } from "@/components/PriceRangeSlider";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { useToast } from "@/components/ToastProvider";
import { ErrorState } from "@/components/uiStates";
import { useListing } from "@/hooks/useListing";
import { useListingSettings, useTryValues, useUpdateListingSettings } from "@/hooks/useListingSettings";

export default function SettingsPage() {
  const params = useParams<{ listingId: string }>();
  const listingId = params.listingId;
  const { pushToast } = useToast();

  const { data, isLoading, isError } = useListing(listingId);
  const settingsQuery = useListingSettings(listingId);
  const tryValuesQuery = useTryValues(listingId);
  const updateSettingsMutation = useUpdateListingSettings(listingId);

  const [draft, setDraft] = useState<{
    minPrice: number;
    maxPrice: number;
    enabled: boolean;
    weeklyDiscount: number;
    monthlyDiscount: number;
  } | null>(null);

  if (isError || settingsQuery.isError) {
    return <ErrorState message="Unable to load listing settings." />;
  }

  const minPrice = draft?.minPrice ?? Number(settingsQuery.data?.minPrice ?? 0);
  const maxPrice = draft?.maxPrice ?? Number(settingsQuery.data?.maxPrice ?? 0);
  const enabled = draft?.enabled ?? Boolean(settingsQuery.data?.smartPricingEnabled ?? true);
  const weeklyDiscount = draft?.weeklyDiscount ?? Number(settingsQuery.data?.discounts?.weekly ?? 10);
  const monthlyDiscount = draft?.monthlyDiscount ?? Number(settingsQuery.data?.discounts?.monthly ?? 20);

  const updateDraft = (patch: Partial<NonNullable<typeof draft>>) => {
    setDraft({
      minPrice,
      maxPrice,
      enabled,
      weeklyDiscount,
      monthlyDiscount,
      ...patch,
    });
  };

  const saveSettings = () => {
    updateSettingsMutation.mutate(
      {
        minPrice,
        maxPrice,
        smartPricingEnabled: enabled,
        discounts: {
          weekly: weeklyDiscount,
          monthly: monthlyDiscount,
        },
      },
      {
        onSuccess: () => pushToast("Settings synced with pricing backend", "success"),
        onError: (error) =>
          pushToast((error as { message?: string }).message ?? "Failed to save settings", "error"),
      }
    );
  };

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Pricing Rules {data ? `• ${data.title}` : ""}</h1>

      <div className="grid gap-4 md:grid-cols-2">
        <PriceRangeSlider
          min={minPrice}
          max={maxPrice}
          onMinChange={(val) => updateDraft({ minPrice: val })}
          onMaxChange={(val) => updateDraft({ maxPrice: val })}
        />


        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <ToggleSwitch checked={enabled} onChange={(val) => updateDraft({ enabled: val })} label="Enable smart pricing" />
          <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
            <p className="font-medium text-slate-700">Suggested try values</p>
            {tryValuesQuery.data ? (
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="rounded border border-slate-300 px-2 py-1"
                  onClick={() => updateDraft({ minPrice: tryValuesQuery.data!.suggested.minPrice })}
                >
                  Try min {tryValuesQuery.data.suggested.minPrice}
                </button>
                <button
                  type="button"
                  className="rounded border border-slate-300 px-2 py-1"
                  onClick={() => updateDraft({ maxPrice: tryValuesQuery.data!.suggested.maxPrice })}
                >
                  Try max {tryValuesQuery.data.suggested.maxPrice}
                </button>
              </div>
            ) : (
              <p className="mt-1">Loading suggestions...</p>
            )}
          </div>
          <label className="block text-sm font-medium text-slate-700">
            Weekly discount (%)
            <input
              type="number"
              min={0}
              max={50}
              value={weeklyDiscount}
              onChange={(e) => updateDraft({ weeklyDiscount: Number(e.target.value) })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Monthly discount (%)
            <input
              type="number"
              min={0}
              max={80}
              value={monthlyDiscount}
              onChange={(e) => updateDraft({ monthlyDiscount: Number(e.target.value) })}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </label>
          <button
            type="button"
            onClick={saveSettings}
            disabled={isLoading || settingsQuery.isLoading || updateSettingsMutation.isPending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {updateSettingsMutation.isPending ? "Saving..." : "Save Rules"}
          </button>
        </div>
      </div>
    </section>
  );
}
