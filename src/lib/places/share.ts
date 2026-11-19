import type { PlaceLocation } from "@/lib/places/types";
import { LAKE_SHORELINE_DISTRICTS } from "@/lib/marine/lake-victoria";
import type { WeatherBundle } from "@/types/weather";

const LAKE_SHORE_SLUGS = new Set(LAKE_SHORELINE_DISTRICTS.map((shore) => shore.slug));

export function isLakeShoreSlug(slug: string | null | undefined): slug is string {
  return Boolean(slug && LAKE_SHORE_SLUGS.has(slug as (typeof LAKE_SHORELINE_DISTRICTS)[number]["slug"]));
}

export function lakeVictoriaHref(shoreSlug: string) {
  return `/lake-victoria?shore=${encodeURIComponent(shoreSlug)}`;
}

export function sharePathForLakeVictoria(shoreSlug: string) {
  return lakeVictoriaHref(shoreSlug);
}

export function sharePathForModule(modulePath: string, homePath: string) {
  const queryIndex = homePath.indexOf("?");
  const query = queryIndex >= 0 ? homePath.slice(queryIndex) : "";
  return `${modulePath}${query}`;
}

export function districtHomeHref(slug: string) {
  return `/district/${encodeURIComponent(slug)}`;
}

export function placeHomeHref(
  place: Pick<PlaceLocation, "key" | "name" | "lat" | "lon" | "label" | "parentDistrictSlug">,
) {
  const params = new URLSearchParams({
    place: place.key,
    name: place.name,
    lat: String(place.lat),
    lon: String(place.lon),
    label: place.label,
    parent: place.parentDistrictSlug,
  });
  return `/?${params.toString()}`;
}

export function sharePathForWeather(
  weather: WeatherBundle,
  activePlace: PlaceLocation | null,
): string {
  if (activePlace) return placeHomeHref(activePlace);

  if (weather.district.isPlace) {
    return placeHomeHref({
      key: weather.district.slug,
      name: weather.district.name,
      lat: weather.district.coordinates.lat,
      lon: weather.district.coordinates.lon,
      label: weather.district.placeLabel ?? weather.district.name,
      parentDistrictSlug: weather.district.parentDistrictSlug ?? "kampala",
    });
  }

  return districtHomeHref(weather.district.slug);
}
