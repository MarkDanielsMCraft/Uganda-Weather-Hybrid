import { createHash } from "node:crypto";
import { getDistrictBySlug } from "@/lib/districts";
import { createPlaceLocation, districtFromPlace } from "@/lib/places/district-from-place";
import { placeWeatherCacheKey } from "@/lib/places/types";
import { districtQuerySchema, placeWeatherQuerySchema } from "@/lib/validation/schemas";
import type { District } from "@/types/weather";

export type ResolvedWeatherTarget =
  | { ok: true; district: District; cacheKey: string }
  | { ok: false; code: "BAD_REQUEST" | "NOT_FOUND"; message: string };

export const BUNDLE_CACHE_VERSION = "v6";

export function weatherBundleCacheKey(slugOrPlaceKey: string): string {
  return `ug:weather:${slugOrPlaceKey}:bundle:${BUNDLE_CACHE_VERSION}`;
}

/** The saved forecast for a place holds its name, label, and point, all sent
    in the address. Putting every one of them in the key means a request with
    made up values only ever fills its own entry, never the one real visitors
    read, so nobody can plant text or a wrong location for other people. */
function placeFingerprint(place: {
  name: string;
  label?: string;
  lat: number;
  lon: number;
  parentDistrictSlug?: string;
}): string {
  const canonical = JSON.stringify([
    place.name,
    place.label ?? "",
    place.lat.toFixed(4),
    place.lon.toFixed(4),
    place.parentDistrictSlug ?? "",
  ]);
  return createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

export function resolveWeatherTarget(searchParams: URLSearchParams): ResolvedWeatherTarget {
  const placeParsed = placeWeatherQuerySchema.safeParse({
    place: searchParams.get("place") ?? "",
    name: searchParams.get("name") ?? "",
    lat: searchParams.get("lat") ?? "",
    lon: searchParams.get("lon") ?? "",
    label: searchParams.get("label") ?? undefined,
    parent: searchParams.get("parent") ?? undefined,
  });

  if (placeParsed.success) {
    const place = createPlaceLocation({
      key: placeParsed.data.place,
      name: placeParsed.data.name,
      lat: placeParsed.data.lat,
      lon: placeParsed.data.lon,
      label: placeParsed.data.label,
      parentDistrictSlug: placeParsed.data.parent,
    });

    return {
      ok: true,
      district: districtFromPlace(place),
      cacheKey: weatherBundleCacheKey(`${placeWeatherCacheKey(place)}:${placeFingerprint(place)}`),
    };
  }

  const parsed = districtQuerySchema.safeParse({
    district: searchParams.get("district") ?? "",
  });

  if (!parsed.success) {
    return {
      ok: false,
      code: "BAD_REQUEST",
      message: "Invalid district or place parameters",
    };
  }

  const district = getDistrictBySlug(parsed.data.district);
  if (!district) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: `District '${parsed.data.district}' not found`,
    };
  }

  return {
    ok: true,
    district,
    cacheKey: weatherBundleCacheKey(district.slug),
  };
}
