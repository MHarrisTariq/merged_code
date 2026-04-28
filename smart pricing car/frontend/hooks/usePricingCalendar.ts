"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { pricingService } from "@/services/pricing";
import type { OverridePricePayload, PricingCalendarDay } from "@/types/api";

export function pricingCalendarQueryKey(listingId: string) {
  return ["pricingCalendar", listingId] as const;
}

export function usePricingCalendar(listingId: string) {
  return useQuery({
    queryKey: pricingCalendarQueryKey(listingId),
    queryFn: () => pricingService.getPricingCalendar(listingId),
    enabled: Boolean(listingId),
    retry: 2,
    refetchInterval: 20_000,
  });
}

export function useOverridePrice(listingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: OverridePricePayload) => pricingService.overridePrice(payload),
    onMutate: async (payload) => {
      const key = pricingCalendarQueryKey(listingId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<PricingCalendarDay[]>(key);

      queryClient.setQueryData<PricingCalendarDay[]>(key, (old = []) =>
        old.map((day) =>
          day.date === payload.date
            ? {
                ...day,
                price: payload.price,
                overridden: true,
              }
            : day
        )
      );

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(pricingCalendarQueryKey(listingId), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: pricingCalendarQueryKey(listingId) });
      queryClient.invalidateQueries({ queryKey: ["pricingSignals", listingId] });
      queryClient.invalidateQueries({ queryKey: ["auditLogs", listingId] });
    },
  });
}
