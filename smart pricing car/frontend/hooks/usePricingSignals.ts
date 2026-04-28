"use client";

import { useQuery } from "@tanstack/react-query";

import { pricingService } from "@/services/pricing";

export function usePricingSignals(listingId: string, dateValue?: string) {
  return useQuery({
    queryKey: ["pricingSignals", listingId, dateValue ?? ""],
    queryFn: () => pricingService.getPricingSignals(listingId, dateValue),
    enabled: Boolean(listingId),
    retry: 2,
    staleTime: 30_000,
  });
}

export function useAuditLogs(listingId: string) {
  return useQuery({
    queryKey: ["auditLogs", listingId],
    queryFn: () => pricingService.getAuditLogs(listingId),
    enabled: Boolean(listingId),
    retry: 2,
    refetchInterval: 30_000,
  });
}
