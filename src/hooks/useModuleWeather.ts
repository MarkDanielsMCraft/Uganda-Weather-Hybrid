"use client";

import { useAppReady } from "@/hooks/useAppReady";
import { useAppLocation } from "@/hooks/useAppLocation";
import { useWeatherBundle } from "@/hooks/useWeatherBundle";
import { usePreferencesStore } from "@/stores/preferencesStore";

/** Shared weather query for module pages. */
export function useModuleWeather(districtSlug?: string) {
  const ready = useAppReady();
  const storedSlug = usePreferencesStore((state) => state.districtSlug);
  const activePlace = usePreferencesStore((state) => state.activePlace);
  const slug = districtSlug ?? storedSlug;
  const query = useWeatherBundle(slug, ready, districtSlug ? null : activePlace);
  const weather = query.data?.data;
  const { isPlace, displayName, displaySubtitle } = useAppLocation();

  return {
    ready,
    slug,
    weather,
    meta: query.data?.meta,
    waiting: !ready || (query.isPending && !weather),
    isError: query.isError,
    isFetching: query.isFetching,
    refetch: query.refetch,
    isPlace: districtSlug ? false : isPlace,
    displayName: districtSlug ? undefined : displayName,
    displaySubtitle: districtSlug ? undefined : displaySubtitle,
  };
}
