"use client";

import { useCallback, useState } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { LAKE_SHORELINE_DISTRICTS } from "@/lib/marine/lake-victoria";
import { useAppLocation } from "@/hooks/useAppLocation";

export function useRefreshWeather() {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const { weatherKey, alertsDistrictSlug } = useAppLocation();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const invalidations: Promise<unknown>[] = [
        queryClient.invalidateQueries({ queryKey: ["weather", "bundle", weatherKey] }),
        queryClient.invalidateQueries({ queryKey: ["forecast", weatherKey] }),
        queryClient.invalidateQueries({ queryKey: ["alerts", alertsDistrictSlug] }),
        queryClient.invalidateQueries({ queryKey: ["air-quality", weatherKey] }),
        queryClient.invalidateQueries({ queryKey: ["agriculture", weatherKey] }),
        queryClient.invalidateQueries({ queryKey: ["location-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["radar", "frames"] }),
        queryClient.invalidateQueries({ queryKey: ["topbar-chip-weather"] }),
      ];

      if (pathname === "/lake-victoria") {
        for (const shore of LAKE_SHORELINE_DISTRICTS) {
          invalidations.push(
            queryClient.invalidateQueries({ queryKey: ["weather", "bundle", shore.slug] }),
          );
        }
      }

      await Promise.all(invalidations);
      await queryClient.refetchQueries({ queryKey: ["weather", "bundle", weatherKey] });

      if (pathname === "/map") {
        await queryClient.refetchQueries({ queryKey: ["radar", "frames"] });
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient, alertsDistrictSlug, weatherKey, pathname]);

  return { refresh, isRefreshing };
}
