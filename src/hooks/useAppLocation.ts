"use client";

import { usePreferencesStore } from "@/stores/preferencesStore";
import type { PlaceLocation } from "@/lib/places/types";
import { placeWeatherCacheKey } from "@/lib/places/types";

export function locationWeatherKey(input: {
  districtSlug: string;
  activePlace: PlaceLocation | null;
}) {
  if (input.activePlace) {
    return placeWeatherCacheKey(input.activePlace);
  }
  return input.districtSlug;
}

export function useAppLocation() {
  const districtSlug = usePreferencesStore((state) => state.districtSlug);
  const activePlace = usePreferencesStore((state) => state.activePlace);

  return {
    districtSlug,
    activePlace,
    weatherKey: locationWeatherKey({ districtSlug, activePlace }),
    alertsDistrictSlug: activePlace?.parentDistrictSlug ?? districtSlug,
    isPlace: Boolean(activePlace),
    displayName: activePlace?.name,
    displaySubtitle: activePlace?.label,
  };
}
