"use client";

import { useQuery } from "@tanstack/react-query";

import { pricingService } from "@/services/pricing";

export const listingsQueryKey = ["listings"] as const;

export function useListings() {
  return useQuery({
    queryKey: listingsQueryKey,
    queryFn: pricingService.getListings,
    staleTime: 60_000,
    retry: 2,
    refetchOnWindowFocus: true,
  });
}
