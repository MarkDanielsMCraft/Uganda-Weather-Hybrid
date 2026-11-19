"use client";

import { useAppReady } from "@/hooks/useAppReady";
import { useAlerts } from "@/hooks/useAlerts";
import { useAppLocation } from "@/hooks/useAppLocation";
import { useWeatherBundle } from "@/hooks/useWeatherBundle";
import type { WeatherAlert } from "@/types/weather";

export function useActiveAlerts() {
  const ready = useAppReady();
  const { alertsDistrictSlug, districtSlug, activePlace } = useAppLocation();
  const weatherQuery = useWeatherBundle(districtSlug, ready, activePlace);
  const alertsQuery = useAlerts(alertsDistrictSlug, ready);

  const alerts: WeatherAlert[] =
    alertsQuery.data?.data.alerts ?? weatherQuery.data?.data?.alerts ?? [];

  return {
    alerts,
    count: alerts.length,
    topAlert: alerts[0] ?? null,
    isLoading: ready && alertsQuery.isPending && !alertsQuery.data && !weatherQuery.data?.data,
  };
}

export function useActiveAlertsCount() {
  return useActiveAlerts().count;
}
