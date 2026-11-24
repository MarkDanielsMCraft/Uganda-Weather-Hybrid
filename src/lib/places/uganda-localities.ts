import { getCached } from "@/lib/cache";
import { findNearestDistrict, getDistrictBySlug } from "@/lib/districts";
import type { Region } from "@/types/weather";
import { districtSlugFromOfficialName } from "@/lib/places/district-match";
import { geocodeOfficialLocality } from "@/lib/places/geocode";
import { MapServiceBusyError } from "@/lib/places/nominatim-pacer";
import { buildOfficialPlaceKey, type PlaceSearchHit } from "@/lib/places/types";
import { fetchWithTimeout } from "@/lib/http/fetch-with-timeout";

const API_BASE = "https://opendata.ssmusoke.dev/api/v1";
const LOCALITIES_TIMEOUT_MS = 4_000;

interface UgandaDataPathEntry {
  type?: string;
  id?: string | number;
  slug?: string;
  name?: string;
}

interface UgandaDataDistrict {
  attributes?: { name?: string };
}

interface UgandaDataSubcounty {
  attributes?: { name?: string };
  relationships?: {
    county?: {
      relationships?: {
        district?: UgandaDataDistrict;
      };
    };
  };
}

interface UgandaDataParish {
  id?: number | string;
  attributes?: { name?: string };
  relationships?: {
    subcounty?: UgandaDataSubcounty;
  };
}

interface UgandaDataRecord {
  id: number | string;
  type?: string;
  attributes?: {
    name?: string;
    displayName?: string;
    path?: UgandaDataPathEntry[];
  };
  relationships?: {
    parish?: UgandaDataParish;
    subcounty?: UgandaDataSubcounty;
  };
}

interface UgandaDataResponse {
  data?: UgandaDataRecord[];
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function extractHierarchy(record: UgandaDataRecord, type: "village" | "parish") {
  const path = record.attributes?.path;
  if (Array.isArray(path) && path.length > 0) {
    const districtEntry = path.find((entry) => entry.type === "districts");
    const subcountyEntry = path.find((entry) => entry.type === "sub-counties");
    const parishEntry = path.find((entry) => entry.type === "parishes");

    return {
      parish: (type === "parish" ? record.attributes?.name : parishEntry?.name)?.trim() ?? "",
      subcounty: subcountyEntry?.name?.trim() ?? "",
      districtName: districtEntry?.name?.trim() ?? "",
    };
  }

  if (type === "parish") {
    const subcounty = record.relationships?.subcounty;
    const district = subcounty?.relationships?.county?.relationships?.district;

    return {
      parish: record.attributes?.name?.trim() ?? "",
      subcounty: subcounty?.attributes?.name?.trim() ?? "",
      districtName: district?.attributes?.name?.trim() ?? "",
    };
  }

  const parish = record.relationships?.parish;
  const subcounty = parish?.relationships?.subcounty;
  const district = subcounty?.relationships?.county?.relationships?.district;

  return {
    parish: parish?.attributes?.name?.trim() ?? "",
    subcounty: subcounty?.attributes?.name?.trim() ?? "",
    districtName: district?.attributes?.name?.trim() ?? "",
  };
}

function parishIdFromVillage(record: UgandaDataRecord): number | string | undefined {
  const parishEntry = record.attributes?.path?.find((entry) => entry.type === "parishes");
  if (parishEntry?.id != null) return parishEntry.id;
  return record.relationships?.parish?.id;
}

function localityScore(name: string, query: string) {
  const normalizedName = name.toLowerCase();
  const q = query.toLowerCase();
  if (normalizedName === q) return 100;
  if (normalizedName.startsWith(q)) return 85;
  if (normalizedName.includes(q)) return 70;
  return 50;
}

function buildLabel(parts: { subcounty: string; parish: string; districtName: string }) {
  const district = titleCase(parts.districtName.replace(/\s+MUNICIPAL COUNCIL$/i, ""));
  const locality = [titleCase(parts.parish), titleCase(parts.subcounty)]
    .filter(Boolean)
    .join(", ");
  if (locality && district) return `${locality}, ${district}`;
  return district || locality || "Uganda";
}

async function fetchLocalities(path: "villages" | "parishes", query: string, limit: number) {
  const url = new URL(`${API_BASE}/${path}`);
  url.searchParams.set("filter[name]", query.toUpperCase());
  url.searchParams.set("per_page", String(limit));

  try {
    const response = await fetchWithTimeout(
      (signal) =>
        fetch(url, {
          headers: { Accept: "application/json" },
          next: { revalidate: 3600 },
          signal,
        }),
      LOCALITIES_TIMEOUT_MS,
    );

    if (!response.ok) return [];
    const payload = (await response.json()) as UgandaDataResponse;
    return payload.data ?? [];
  } catch (error) {
    console.error(`Uganda localities lookup failed for '${path}':`, error);
    return [];
  }
}

async function localityToPlaceHit(
  type: "village" | "parish",
  record: UgandaDataRecord,
  query: string,
): Promise<PlaceSearchHit | null> {
  const name = record.attributes?.name?.trim();
  if (!name) return null;

  const hierarchy = extractHierarchy(record, type);
  const districtSlug =
    districtSlugFromOfficialName(hierarchy.districtName) ??
    findNearestDistrict(0.35, 32.05).slug;
  const district = getDistrictBySlug(districtSlug);
  const region = (district?.region ?? "central") as Region;

  const geocoded = await geocodeOfficialLocality({
    cacheKey: `${type}-${record.id}`,
    name: titleCase(name),
    parish: titleCase(hierarchy.parish || name),
    subcounty: titleCase(hierarchy.subcounty),
    districtName: hierarchy.districtName,
    districtSlug,
  });

  const label = buildLabel(hierarchy);
  const placeName = titleCase(name);

  return {
    kind: "place",
    name: placeName,
    key: buildOfficialPlaceKey(type, record.id),
    label,
    lat: geocoded.lat,
    lon: geocoded.lon,
    parentDistrictSlug: districtSlug,
    region,
    placeType: type,
    approximate: geocoded.approximate,
    ...("busy" in geocoded && geocoded.busy ? { madeWhileMapBusy: true } : {}),
    matchScore: localityScore(name, query) + (type === "village" ? 2 : 0),
  };
}

function matchesQuery(name: string, query: string) {
  const normalizedName = name.toLowerCase();
  const q = query.toLowerCase();
  return normalizedName.includes(q);
}

async function searchOfficialLocalitiesUncached(query: string, limit = 8) {
  const q = query.trim();
  if (q.length < 2) return [];

  const filterToken = q.toUpperCase();

  const [villages, parishes] = await Promise.all([
    fetchLocalities("villages", filterToken, limit),
    fetchLocalities("parishes", filterToken, Math.max(4, Math.floor(limit / 2))),
  ]);

  // Filtering is synchronous and cheap; do it up front so the (slow,
  // network-bound) geocoding step below can run every matched record
  // concurrently instead of one geocode round-trip at a time.
  const coveredParishIds = new Set<string>();
  const matchedVillages = villages.filter((record) => {
    const villageName = record.attributes?.name?.trim() ?? "";
    if (!matchesQuery(villageName, q)) return false;
    const parishId = parishIdFromVillage(record);
    if (parishId != null) coveredParishIds.add(String(parishId));
    return true;
  });
  const matchedParishes = parishes.filter((record) => {
    if (coveredParishIds.has(String(record.id))) return false;
    const parishName = record.attributes?.name?.trim() ?? "";
    return matchesQuery(parishName, q);
  });

  const resolved = await Promise.all([
    ...matchedVillages.map((record) => localityToPlaceHit("village", record, q)),
    ...matchedParishes.map((record) => localityToPlaceHit("parish", record, q)),
  ]);

  const hits: PlaceSearchHit[] = [];
  const seen = new Set<string>();
  for (const hit of resolved) {
    if (!hit || seen.has(hit.key)) continue;
    seen.add(hit.key);
    hits.push(hit);
  }

  return hits
    .sort((a, b) => b.matchScore - a.matchScore || a.name.localeCompare(b.name))
    .slice(0, limit);
}

const UNSAVED_LIST_SECONDS = 10;
const unsavedLists = new Map<string, PlaceSearchHit[]>();

function rememberUnsavedList(key: string, hits: PlaceSearchHit[]) {
  unsavedLists.set(key, hits);
  setTimeout(() => unsavedLists.delete(key), UNSAVED_LIST_SECONDS * 1000).unref?.();
}

export async function searchOfficialLocalities(query: string, limit = 8) {
  const q = query.trim();
  if (q.length < 2) return [];

  // A list with a rough point made while the map service was busy is used
  // once and not saved, so the next search tries again for the real point.
  const listKey = `ug:localities:v4:${q.toLowerCase()}:${limit}`;
  try {
    const { data } = await getCached(
      listKey,
      3600,
      async () => {
        const hits = await searchOfficialLocalitiesUncached(q, limit);
        if (hits.some((hit) => "madeWhileMapBusy" in hit)) {
          rememberUnsavedList(listKey, hits);
          throw new MapServiceBusyError();
        }
        return hits;
      },
    );
    return data;
  } catch (error) {
    // Searches for the same words at the same moment share one lookup, so
    // they all read the unsaved list from here instead of failing.
    const unsaved = unsavedLists.get(listKey);
    if (unsaved && error instanceof MapServiceBusyError) return unsaved;
    throw error;
  }
}
