import type { Region } from "@/types/weather";

export interface PlaceLocation {
  key: string;
  name: string;
  label: string;
  lat: number;
  lon: number;
  parentDistrictSlug: string;
  region: Region;
  approximate?: boolean;
}

export interface DistrictSearchHit {
  kind: "district";
  name: string;
  slug: string;
  region: Region;
  matchScore: number;
}

export interface PlaceSearchHit {
  kind: "place";
  name: string;
  key: string;
  label: string;
  lat: number;
  lon: number;
  parentDistrictSlug: string;
  region: Region;
  matchScore: number;
  placeType?: "village" | "parish";
  approximate?: boolean;
}

export type LocationSearchHit = DistrictSearchHit | PlaceSearchHit;

export function buildOfficialPlaceKey(type: "village" | "parish", id: number | string) {
  return `${type}-${id}`;
}

export function slugifyPlaceName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildPlaceKey(name: string, lat: number, lon: number) {
  return `${slugifyPlaceName(name)}-${lat.toFixed(2)}-${lon.toFixed(2)}`.replace(/\./g, "_");
}

export function buildGpsPlaceKey(lat: number, lon: number) {
  const roundedLat = lat.toFixed(3).replace(/\./g, "_");
  const roundedLon = lon.toFixed(3).replace(/\./g, "_");
  return `gps-${roundedLat}-${roundedLon}`;
}

export function placeWeatherCacheKey(place: Pick<PlaceLocation, "key">) {
  return `place:${place.key}`;
}
