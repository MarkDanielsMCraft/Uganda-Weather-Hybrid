import { getDistrictBySlug } from "@/lib/districts";
import { createPlaceLocation, districtFromPlace } from "@/lib/places/district-from-place";
import { districtQuerySchema, placeWeatherQuerySchema } from "@/lib/validation/schemas";
import type { District } from "@/types/weather";

export type ResolvedWeatherTarget =
  | { ok: true; district: District; cacheKey: string; isPlace: boolean }
  | { ok: false; code: "BAD_REQUEST" | "NOT_FOUND"; message: string };

export const BUNDLE_CACHE_VERSION = "v6";

export function weatherBundleCacheKey(slugOrPlaceKey: string): string {
  return `ug:weather:${slugOrPlaceKey}:bundle:${BUNDLE_CACHE_VERSION}`;
}

/** Weather for a place is saved by its point, rounded to about 1 km, and
    never by its name or label. Made up names therefore cannot create new
    saved copies (each one a paid weather call), and they cannot change what
    other visitors see. The name asked for is added back after the cache by
    withRequestedPlace. */
function placePointKey(lat: number, lon: number): string {
  return `place-point:${lat.toFixed(2)}:${lon.toFixed(2)}`;
}

export function withRequestedPlace<T>(data: T, target: { isPlace: boolean; district: District }): T {
  if (!target.isPlace || !data || typeof data !== "object" || !("district" in data)) return data;
  const cached = (data as { district?: Record<string, unknown> }).district;
  if (!cached || typeof cached !== "object") return data;
  const district = "coordinates" in cached
    ? target.district
    : { ...cached, slug: target.district.slug, name: target.district.name };
  return { ...data, district };
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
      cacheKey: weatherBundleCacheKey(placePointKey(place.lat, place.lon)),
      isPlace: true,
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
    isPlace: false,
  };
}
