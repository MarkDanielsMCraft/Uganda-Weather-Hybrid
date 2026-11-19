import { searchDistricts } from "@/lib/districts";
import { searchOfficialLocalities } from "@/lib/places/uganda-localities";
import type { DistrictSearchHit, LocationSearchHit } from "./types";

export async function searchPlaces(query: string, limit = 6) {
  return searchOfficialLocalities(query, limit);
}

// This is a live-typing autocomplete endpoint — even a "successful" 4s
// response (the geocoding chain's own worst-case budget) reads as broken
// to a user who's already typed more characters or given up waiting. The
// search box has no reason to block on village/parish geocoding at all
// when the (instant, synchronous, no-network) district search already
// found a confident match — "Kampala" was taking 5-6s end to end because
// the place search always ran and was always awaited, even though the
// district hit alone was already the obviously correct answer.
const PLACE_SEARCH_BUDGET_MS = 1200;
const HIGH_CONFIDENCE_DISTRICT_SCORE = 80;

export async function searchLocations(query: string, limit = 10): Promise<LocationSearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const districtHits: DistrictSearchHit[] = searchDistricts(q, limit).map((result) => ({
    kind: "district" as const,
    name: result.name,
    slug: result.slug,
    region: result.region,
    matchScore: result.matchScore,
  }));

  const hasConfidentDistrictMatch = districtHits.some(
    (hit) => hit.matchScore >= HIGH_CONFIDENCE_DISTRICT_SCORE,
  );

  const districtNames = new Set(districtHits.map((hit) => hit.name.toLowerCase()));
  const placeLimit = Math.max(limit - districtHits.length, 3);
  // Village/parish geocoding depends on two external services (Nominatim,
  // opendata.ssmusoke.dev). Both are individually timeout-guarded, but if
  // something still goes wrong, degrade to district-only results instead
  // of failing the whole search. Bounded by a much shorter budget than
  // the geocoding chain's own worst case — this endpoint returns
  // whatever's ready in time rather than blocking on it; the geocode
  // itself keeps running and populates the cache for next time either way.
  const placeHits = hasConfidentDistrictMatch
    ? await Promise.race([
        searchPlaces(q, placeLimit).catch(() => []),
        new Promise<[]>((resolve) => setTimeout(() => resolve([]), PLACE_SEARCH_BUDGET_MS)),
      ])
    : await searchPlaces(q, placeLimit).catch((error) => {
        console.error("Place search failed, falling back to district-only results:", error);
        return [];
      });

  const merged: LocationSearchHit[] = [...districtHits];

  for (const place of placeHits) {
    if (districtNames.has(place.name.toLowerCase())) continue;
    merged.push(place);
  }

  return merged
    .sort((a, b) => b.matchScore - a.matchScore || a.name.localeCompare(b.name))
    .slice(0, limit);
}
