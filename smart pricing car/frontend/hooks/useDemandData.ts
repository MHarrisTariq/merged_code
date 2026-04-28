"use client";

import { useQuery } from "@tanstack/react-query";

import { pricingService } from "@/services/pricing";

export function useDemandData(listingId: string) {
  return useQuery({
    queryKey: ["demandData", listingId],
    queryFn: () => pricingService.getDemandData(listingId),
    enabled: Boolean(listingId),
    retry: 2,
    refetchInterval: 30_000,
  });
}
