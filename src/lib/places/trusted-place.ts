import {
  SHARED_PLACE_FALLBACK_NAME,
  safePlaceLabel,
  safePlaceName,
} from "@/lib/places/place-text";
import type { PlaceLocation } from "./types";

const PLACE_KEY = /^[A-Za-z0-9:_-]{2,120}$/;

/** A place can arrive from a shared link or from settings saved on the phone,
    and both can be written by someone else. Its name and label are checked
    here before the app shows, saves, shares, or sends them anywhere. */
export function trustedPlace(place: PlaceLocation): PlaceLocation {
  const name = safePlaceName(place.name) ?? SHARED_PLACE_FALLBACK_NAME;
  const label = safePlaceLabel(place.label);
  const key = typeof place.key === "string" && PLACE_KEY.test(place.key.trim())
    ? place.key.trim()
    : `shared-${place.lat.toFixed(2)}-${place.lon.toFixed(2)}`.replace(/\./g, "_");
  return { ...place, key, name, label: label ?? "" };
}

export function trustedPlaceOrNull(place: unknown): PlaceLocation | null {
  if (!place || typeof place !== "object") return null;
  const candidate = place as PlaceLocation;
  if (!Number.isFinite(candidate.lat) || !Number.isFinite(candidate.lon)) return null;
  return trustedPlace(candidate);
}
