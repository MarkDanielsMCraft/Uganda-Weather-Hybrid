// Deliberately free of server-only imports. Four client components use the
// pure helpers below, two of them (GeolocationBootstrap, DistrictQuerySync)
// from the root layout, so whatever is reachable from here lands in the
// first-load bundle of every page.
//
// This file used to import the reverse geocoder, which reaches the cache
// layer, which imports `crypto`. Webpack answered that by polyfilling Node's
// crypto for the browser: elliptic curves, ASN.1, a Buffer shim and a stream
// implementation, around 320 kB of parsed JavaScript on every page of a
// weather app that never calls any of it. The one function that needed the
// geocoder now lives in `resolve-place.ts`, imported only by the API route.
import { getDistrictBySlug, findNearestDistrict } from "@/lib/districts";
import type { District, Region } from "@/types/weather";
import type { PlaceLocation } from "./types";
import { buildGpsPlaceKey, buildPlaceKey } from "./types";

export function inferParentDistrictSlug(lat: number, lon: number, hint?: string) {
  if (hint && getDistrictBySlug(hint)) return hint;
  return findNearestDistrict(lat, lon).slug;
}

export function createPlaceLocation(input: {
  key?: string;
  name: string;
  lat: number;
  lon: number;
  label?: string;
  parentDistrictSlug?: string;
  region?: Region;
  approximate?: boolean;
}): PlaceLocation {
  const parentDistrictSlug = inferParentDistrictSlug(
    input.lat,
    input.lon,
    input.parentDistrictSlug,
  );
  const parent = getDistrictBySlug(parentDistrictSlug) ?? findNearestDistrict(input.lat, input.lon);
  const label = input.label?.trim() || parent.name;

  return {
    key: input.key?.trim() || buildPlaceKey(input.name, input.lat, input.lon),
    name: input.name.trim(),
    label,
    lat: input.lat,
    lon: input.lon,
    parentDistrictSlug: parent.slug,
    region: input.region ?? parent.region,
    approximate: input.approximate,
  };
}

export function districtFromPlace(place: PlaceLocation): District {
  const parent = getDistrictBySlug(place.parentDistrictSlug);

  return {
    id: `PLACE-${place.key}`,
    name: place.name,
    slug: place.key,
    region: place.region,
    coordinates: { lat: place.lat, lon: place.lon },
    rainfallPattern: parent?.rainfallPattern ?? "bimodal",
    agroZone: parent?.agroZone,
    hazards: parent?.hazards ?? ["lightning"],
    isPlace: true,
    placeLabel: place.label,
    parentDistrictSlug: place.parentDistrictSlug,
  };
}

export function createGpsPlaceLocation(lat: number, lon: number): PlaceLocation {
  const parent = findNearestDistrict(lat, lon);

  return createPlaceLocation({
    key: buildGpsPlaceKey(lat, lon),
    name: "Your location",
    label: `Near ${parent.name}`,
    lat,
    lon,
    parentDistrictSlug: parent.slug,
    region: parent.region,
  });
}
