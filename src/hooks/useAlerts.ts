"use client";

import { useQuery } from "@tanstack/react-query";
import type { ApiMeta, WeatherAlert } from "@/types/weather";

interface AlertsResponse {
  data: {
    district: { slug: string; name: string; region: string };
    alerts: WeatherAlert[];
    updatedAt: string;
    source: string;
  };
  meta: ApiMeta;
}

export function useAlerts(districtSlug: string, enabled = true) {
  return useQuery({
    queryKey: ["alerts", districtSlug],
    enabled,
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/alerts?district=${encodeURIComponent(districtSlug)}`,
      );
      if (!response.ok) throw new Error("Failed to load alerts");
      return (await response.json()) as AlertsResponse;
    },
    staleTime: 5 * 60 * 1000,
    // Alerts are safety critical, so they poll on the server's own
    // ALERTS_TTL_SECONDS cadence (5 minutes) rather than waiting for the
    // slower general weather refresh. Paused automatically while the tab
    // is backgrounded, same as the main weather bundle.
    refetchInterval: 5 * 60 * 1000,
  });
}
