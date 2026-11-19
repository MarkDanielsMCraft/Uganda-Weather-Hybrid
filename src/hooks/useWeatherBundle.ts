"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { loadWeatherCache, saveWeatherCache } from "@/lib/offline/weather-cache";
import { syncWidgetData } from "@/lib/native/widget";
import type { PlaceLocation } from "@/lib/places/types";
import type { ApiMeta, WeatherBundle } from "@/types/weather";
import { usePreferencesStore } from "@/stores/preferencesStore";

interface WeatherBundleResponse {
  data: WeatherBundle;
  meta: ApiMeta;
}

function weatherRequestUrl(input: {
  districtSlug: string;
  activePlace: PlaceLocation | null;
}) {
  if (input.activePlace) {
    const params = new URLSearchParams({
      place: input.activePlace.key,
      name: input.activePlace.name,
      lat: String(input.activePlace.lat),
      lon: String(input.activePlace.lon),
      label: input.activePlace.label,
      parent: input.activePlace.parentDistrictSlug,
    });
    return `/api/v1/weather/current?${params.toString()}`;
  }

  return `/api/v1/weather/current?district=${encodeURIComponent(input.districtSlug)}`;
}

export function useWeatherBundle(
  districtSlug: string,
  enabled = true,
  activePlace: PlaceLocation | null = null,
) {
  const ready = usePreferencesStore((state) => state._hasHydrated);
  const weatherKey = activePlace?.key ?? districtSlug;
  const queryEnabled = enabled && ready && weatherKey.length >= 2;

  const query = useQuery({
    queryKey: ["weather", "bundle", weatherKey],
    enabled: queryEnabled,
    queryFn: async () => {
      const response = await fetch(weatherRequestUrl({ districtSlug, activePlace }));

      if (!response.ok) {
        throw new Error(`Weather request failed (${response.status})`);
      }

      const payload = (await response.json()) as WeatherBundleResponse;
      if (!payload?.data?.district?.slug || !payload?.data?.temperature) {
        throw new Error("Weather response missing required fields");
      }

      saveWeatherCache(weatherKey, payload);
      void syncWidgetData(payload.data);
      return payload;
    },
    placeholderData: () => {
      if (!ready) return undefined;
      return loadWeatherCache(weatherKey) ?? undefined;
    },
    staleTime: 5 * 60 * 1000,
    // Matches the server's own cache freshness window (CACHE_TTL_CURRENT,
    // 600s default), so a poll lands right around when the server side
    // cache would have rotated in new data anyway. React Query pauses
    // this automatically while the tab is in the background and resumes
    // (with an immediate catch up fetch) on refocus, so this never polls
    // a hidden tab.
    refetchInterval: 10 * 60 * 1000,
    retry: 1,
  });

  // `placeholderData` covers the pending state only: once the query settles
  // into an error React Query stops returning it, so a reader with a
  // perfectly good cached bundle was shown "Could not load weather" instead
  // of the weather they already had. That was survivable while a failed
  // request still came back with a locally generated bundle. Now that the
  // server refuses to invent one and answers 503, this is the difference
  // between showing yesterday's reading and showing nothing at all.
  //
  // Marked stale so the status line says the data is not current, rather
  // than passing an old reading off as a fresh one.
  const fallback = useMemo(() => {
    if (!query.isError || query.data || !ready) return undefined;
    const cached = loadWeatherCache(weatherKey);
    if (!cached) return undefined;
    return { ...cached, data: { ...cached.data, stale: true } };
  }, [query.isError, query.data, ready, weatherKey]);

  if (!fallback) return query;
  return { ...query, data: fallback } as typeof query;
}
