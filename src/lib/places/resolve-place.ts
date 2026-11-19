// Server only. Kept apart from `district-from-place.ts` because it reaches
// the reverse geocoder, and through it the cache layer and `crypto`. That
// chain is fine on the server and ruinous in the browser: bundled for the
// client it drags in a Node crypto polyfill worth roughly 320 kB of parsed
// JavaScript. Keeping it in its own module means the client components that
// need the pure place helpers cannot pull it in by accident.
import { findNearestDistrict } from "@/lib/districts";
import { reverseGeocodeUganda } from "@/lib/places/geocode";
import { createGpsPlaceLocation, createPlaceLocation } from "./district-from-place";
import type { PlaceLocation } from "./types";
import { buildGpsPlaceKey } from "./types";

export async function resolvePlaceFromCoordinates(lat: number, lon: number): Promise<PlaceLocation> {
  const reversed = await reverseGeocodeUganda(lat, lon);
  const parent = findNearestDistrict(lat, lon);

  if (reversed.name) {
    return createPlaceLocation({
      key: buildGpsPlaceKey(lat, lon),
      name: reversed.name,
      label: reversed.label ?? `Near ${parent.name}`,
      lat,
      lon,
      parentDistrictSlug: parent.slug,
      region: parent.region,
      approximate: reversed.approximate,
    });
  }

  return createGpsPlaceLocation(lat, lon);
}
