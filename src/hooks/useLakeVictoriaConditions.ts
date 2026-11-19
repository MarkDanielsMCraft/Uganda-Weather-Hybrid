"use client";

import { useMemo } from "react";
import { getDistrictBySlug } from "@/lib/districts";
import { isLakeShoreSlug } from "@/lib/places/share";
import { referenceLakeDistrictSlug } from "@/lib/marine/lake-victoria";
import { useAppReady } from "@/hooks/useAppReady";
import { useWeatherBundle } from "@/hooks/useWeatherBundle";
import { usePreferencesStore } from "@/stores/preferencesStore";

/** Resolves which district's weather represents "Lake Victoria" for the
    current user — their own district if it's already a shoreline
    district, otherwise a fixed reference point per lake zone (central,
    eastern, western) — and optionally honours a shoreline override so a
    shared or bookmarked link always lands on the exact shoreline chosen,
    independent of the visitor's own selected place.

    Doesn't read the `?shore=` query param itself (that would force every
    caller, including the home tile, into a Suspense boundary just for
    useSearchParams) — pass the resolved value in as `shoreOverride`
    instead; the thin page wrapper that needs the query param reads it
    itself, same as before. */
export function useLakeVictoriaConditions(shoreOverride: string | null = null) {
  const ready = useAppReady();
  const districtSlug = usePreferencesStore((state) => state.districtSlug);
  const district = getDistrictBySlug(districtSlug);

  const lakeSlug = useMemo(() => {
    if (isLakeShoreSlug(shoreOverride)) return shoreOverride;
    return district ? referenceLakeDistrictSlug(district) : "kalangala";
  }, [district, shoreOverride]);

  const usingLakeReference = isLakeShoreSlug(shoreOverride)
    ? false
    : district
      ? !district.isLakeVictoriaZone
      : true;

  const { data, isPending, isError } = useWeatherBundle(lakeSlug, ready);
  const weather = data?.data;
  const waiting = !ready || (isPending && !weather);

  return {
    weather,
    meta: data?.meta,
    waiting,
    isError,
    usingLakeReference,
    homeDistrictName: district?.name,
    lakeDistrictSlug: lakeSlug,
  };
}
