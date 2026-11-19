"use client";

import { useMemo } from "react";
import { getDistrictBySlug } from "@/lib/districts";
import { referenceLakeDistrictSlug, type LakeConfig } from "@/lib/marine/lake-conditions";
import { useAppReady } from "@/hooks/useAppReady";
import { useWeatherBundle } from "@/hooks/useWeatherBundle";
import { usePreferencesStore } from "@/stores/preferencesStore";

/** Generic version of `useLakeVictoriaConditions` for Kyoga, Albert, and
    Edward — Victoria keeps its own hook (many existing call sites, and
    its own `isLakeVictoriaZone` boolean rather than the generic
    `lakeZone` field), this is for the lakes added on top of that
    pattern. Same shape: resolves the user's own district if it's already
    a shoreline district of this lake, otherwise a fixed reference point,
    with an optional shoreline override for shared/bookmarked links. */
export function useLakeConditions(config: LakeConfig, shoreOverride: string | null = null) {
  const ready = useAppReady();
  const districtSlug = usePreferencesStore((state) => state.districtSlug);
  const district = getDistrictBySlug(districtSlug);

  const isShoreSlug = (slug: string | null) =>
    Boolean(slug && config.shorelineDistricts.some((shore) => shore.slug === slug));

  const lakeSlug = useMemo(() => {
    if (isShoreSlug(shoreOverride)) return shoreOverride as string;
    return district ? referenceLakeDistrictSlug(district, config) : config.shorelineDistricts[0].slug;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [district, shoreOverride, config]);

  const usingLakeReference = isShoreSlug(shoreOverride)
    ? false
    : district
      ? !config.shorelineDistricts.some((shore) => shore.slug === district.slug)
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
