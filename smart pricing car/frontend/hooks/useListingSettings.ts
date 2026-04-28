"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { pricingService } from "@/services/pricing";
import type { ListingSettings } from "@/types/api";

export function listingSettingsQueryKey(listingId: string) {
  return ["listingSettings", listingId] as const;
}

export function useListingSettings(listingId: string) {
  return useQuery({
    queryKey: listingSettingsQueryKey(listingId),
    queryFn: () => pricingService.getListingSettings(listingId),
    enabled: Boolean(listingId),
    retry: 2,
    staleTime: 60_000,
  });
}

export function useTryValues(listingId: string) {
  return useQuery({
    queryKey: ["pricingTryValues", listingId],
    queryFn: () => pricingService.getTryValues(listingId),
    enabled: Boolean(listingId),
    retry: 2,
    staleTime: 60_000,
  });
}

export function useUpdateListingSettings(listingId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<ListingSettings, "listingId">) => pricingService.updateListingSettings(listingId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listingSettingsQueryKey(listingId) });
      queryClient.invalidateQueries({ queryKey: ["listing", listingId] });
      queryClient.invalidateQueries({ queryKey: ["pricingCalendar", listingId] });
    },
  });
}
