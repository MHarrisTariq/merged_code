"use client";

import { useQuery } from "@tanstack/react-query";

import { pricingService } from "@/services/pricing";

export function useListing(id: string) {
  return useQuery({
    queryKey: ["listing", id],
    queryFn: () => pricingService.getListing(id),
    enabled: Boolean(id),
    staleTime: 60_000,
    retry: 2,
  });
}
