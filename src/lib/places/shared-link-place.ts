// Browser safe. No server imports.
import { getDistrictBySlug, findNearestDistrict } from "@/lib/districts";
import { SHARED_PLACE_FALLBACK_NAME } from "./place-text";
import { trustedPlace, trustedPlaceOrNull } from "./trusted-place";
import type { PlaceLocation } from "./types";

/** A shared link can carry any name the sender typed, and no word filter can
    catch every trick. So the name in the link is never shown. The place opens
    as "Shared place" near its district, and the name is then asked from our
    own server, which looks it up from the point on the map. */
export function provisionalSharedPlace(input: {
  key: string;
  lat: number;
  lon: number;
  parentDistrictSlug?: string;
}): PlaceLocation {
  const parent = (input.parentDistrictSlug && getDistrictBySlug(input.parentDistrictSlug))
    || findNearestDistrict(input.lat, input.lon);
  return trustedPlace({
    key: input.key,
    name: SHARED_PLACE_FALLBACK_NAME,
    label: parent.name,
    lat: input.lat,
    lon: input.lon,
    parentDistrictSlug: parent.slug,
    region: parent.region,
  });
}

export async function lookUpSharedPlaceName(
  place: PlaceLocation,
  fetcher: typeof fetch = fetch,
): Promise<PlaceLocation | null> {
  try {
    const response = await fetcher(
      `/api/v1/locations/reverse?lat=${encodeURIComponent(place.lat)}&lon=${encodeURIComponent(place.lon)}`,
    );
    if (!response.ok) return null;
    const body = (await response.json()) as { data?: { place?: unknown } };
    const found = trustedPlaceOrNull(body.data?.place);
    if (!found || found.name === SHARED_PLACE_FALLBACK_NAME) return null;
    return { ...place, name: found.name, label: found.label || place.label };
  } catch {
    return null;
  }
}

type PlaceStore = {
  getState: () => {
    activePlace: PlaceLocation | null;
    recentPlaces: PlaceLocation[];
    selectPlace: (place: PlaceLocation) => void;
  };
};

function samePoint(a: PlaceLocation, lat: number, lon: number): boolean {
  return Math.abs(a.lat - lat) < 0.0005 && Math.abs(a.lon - lon) < 0.0005;
}

/** Opens a place from a web address. A place the person already chose in the
    app (the active one or a recent one) keeps its name. Anything else is
    treated as a link from someone else. */
export async function openPlaceFromLink(
  input: { key: string; lat: number; lon: number; parentDistrictSlug?: string },
  store: PlaceStore,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const state = store.getState();
  const known = [state.activePlace, ...state.recentPlaces].find(
    (place): place is PlaceLocation => Boolean(place && place.key === input.key && samePoint(place, input.lat, input.lon)),
  );
  if (known) {
    state.selectPlace(known);
    return;
  }

  const provisional = provisionalSharedPlace(input);
  state.selectPlace(provisional);
  const named = await lookUpSharedPlaceName(provisional, fetcher);
  if (named && store.getState().activePlace?.key === provisional.key) {
    store.getState().selectPlace(named);
  }
}
