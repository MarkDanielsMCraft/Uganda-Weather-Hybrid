import { searchDistricts } from "@/lib/districts";
import type {
  DistrictSearchHit,
  LocationSearchHit,
  PlaceSearchHit,
} from "@/lib/places/types";

const OFFLINE_PLACES_KEY = "uw:offline-places:v1";
const MAX_CACHED_PLACES = 120;

/**
 * Curated offline directory of major Ugandan towns, border crossings,
 * trading centres, and rural hubs across all four regions so users without
 * internet can still resolve common non-district places alongside all 152
 * districts and any parishes they previously searched online.
 */
const BUNDLED_UGANDA_PLACES: Omit<PlaceSearchHit, "kind" | "matchScore">[] = [
  { key: "entebbe", name: "Entebbe", label: "Wakiso, Central", lat: 0.0512, lon: 32.4637, parentDistrictSlug: "wakiso", region: "central" },
  { key: "kira", name: "Kira", label: "Wakiso, Central", lat: 0.3972, lon: 32.6406, parentDistrictSlug: "wakiso", region: "central" },
  { key: "nansana", name: "Nansana", label: "Wakiso, Central", lat: 0.3639, lon: 32.5286, parentDistrictSlug: "wakiso", region: "central" },
  { key: "bweyogerere", name: "Bweyogerere", label: "Wakiso, Central", lat: 0.3547, lon: 32.6606, parentDistrictSlug: "wakiso", region: "central" },
  { key: "gayaza", name: "Gayaza", label: "Wakiso, Central", lat: 0.4519, lon: 32.6119, parentDistrictSlug: "wakiso", region: "central" },
  { key: "matugga", name: "Matugga", label: "Wakiso, Central", lat: 0.4592, lon: 32.5247, parentDistrictSlug: "wakiso", region: "central" },
  { key: "lugazi", name: "Lugazi", label: "Buikwe, Central", lat: 0.3775, lon: 32.9311, parentDistrictSlug: "buikwe", region: "central" },
  { key: "njeru", name: "Njeru", label: "Buikwe, Central", lat: 0.4417, lon: 33.1731, parentDistrictSlug: "buikwe", region: "central" },
  { key: "mutukula", name: "Mutukula", label: "Kyotera, Central", lat: -0.9978, lon: 31.4158, parentDistrictSlug: "kyotera", region: "central" },
  { key: "kalisizo", name: "Kalisizo", label: "Kyotera, Central", lat: -0.5358, lon: 31.6228, parentDistrictSlug: "kyotera", region: "central" },
  { key: "malaba", name: "Malaba", label: "Tororo, Eastern", lat: 0.6358, lon: 34.2747, parentDistrictSlug: "tororo", region: "eastern" },
  { key: "busia-town", name: "Busia", label: "Busia, Eastern", lat: 0.4667, lon: 34.0922, parentDistrictSlug: "busia", region: "eastern" },
  { key: "bwera", name: "Bwera", label: "Kasese, Western", lat: 0.0369, lon: 29.7547, parentDistrictSlug: "kasese", region: "western" },
  { key: "mpondwe", name: "Mpondwe", label: "Kasese, Western", lat: 0.0411, lon: 29.7261, parentDistrictSlug: "kasese", region: "western" },
  { key: "ishaka", name: "Ishaka", label: "Bushenyi, Western", lat: -0.5444, lon: 30.1378, parentDistrictSlug: "bushenyi", region: "western" },
  { key: "katuna", name: "Katuna", label: "Kabale, Western", lat: -1.4256, lon: 30.0117, parentDistrictSlug: "kabale", region: "western" },
  { key: "hima", name: "Hima", label: "Kasese, Western", lat: 0.2892, lon: 30.1753, parentDistrictSlug: "kasese", region: "western" },
  { key: "elegu", name: "Elegu", label: "Amuru, Northern", lat: 3.5625, lon: 32.0653, parentDistrictSlug: "amuru", region: "northern" },
  { key: "atiak", name: "Atiak", label: "Amuru, Northern", lat: 3.2583, lon: 32.1256, parentDistrictSlug: "amuru", region: "northern" },
  { key: "karuma", name: "Karuma", label: "Kiryandongo, Western", lat: 2.2442, lon: 32.2406, parentDistrictSlug: "kiryandongo", region: "western" },
  { key: "paidha", name: "Paidha", label: "Zombo, Northern", lat: 2.4167, lon: 30.9856, parentDistrictSlug: "zombo", region: "northern" },
  { key: "pakwach-town", name: "Pakwach", label: "Pakwach, Northern", lat: 2.4619, lon: 31.4983, parentDistrictSlug: "pakwach", region: "northern" },
  { key: "oraba", name: "Oraba", label: "Koboko, Northern", lat: 3.5356, lon: 30.8922, parentDistrictSlug: "koboko", region: "northern" },
  { key: "kapelebyong-town", name: "Kapelebyong", label: "Kapelebyong, Eastern", lat: 2.1375, lon: 33.8617, parentDistrictSlug: "kapelebyong", region: "eastern" },
];

function readCachedPlaces(): Omit<PlaceSearchHit, "kind" | "matchScore">[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(OFFLINE_PLACES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is Omit<PlaceSearchHit, "kind" | "matchScore"> =>
        Boolean(
          item &&
            typeof item.key === "string" &&
            typeof item.name === "string" &&
            typeof item.lat === "number" &&
            typeof item.lon === "number",
        ),
    );
  } catch {
    return [];
  }
}

export function cachePlaceSearchHits(hits: LocationSearchHit[]): void {
  if (typeof window === "undefined") return;
  const incoming = hits.filter(
    (hit): hit is PlaceSearchHit => hit.kind === "place",
  );
  if (incoming.length === 0) return;

  try {
    const existing = readCachedPlaces();
    const byKey = new Map<string, Omit<PlaceSearchHit, "kind" | "matchScore">>();
    for (const hit of incoming) {
      byKey.set(hit.key, {
        key: hit.key,
        name: hit.name,
        label: hit.label,
        lat: hit.lat,
        lon: hit.lon,
        parentDistrictSlug: hit.parentDistrictSlug,
        region: hit.region,
        approximate: hit.approximate,
      });
    }
    for (const item of existing) {
      if (!byKey.has(item.key)) {
        byKey.set(item.key, item);
      }
    }
    const bounded = [...byKey.values()].slice(0, MAX_CACHED_PLACES);
    window.localStorage.setItem(OFFLINE_PLACES_KEY, JSON.stringify(bounded));
  } catch {
    // Ignore storage quota errors on basic devices
  }
}

function scorePlaceMatch(name: string, label: string, q: string): number {
  const lowerName = name.toLowerCase();
  const lowerLabel = label.toLowerCase();
  if (lowerName === q) return 95;
  if (lowerName.startsWith(q)) return 75;
  if (lowerName.includes(q)) return 55;
  if (lowerLabel.includes(q)) return 35;
  return 0;
}

/**
 * Synchronous offline location search across all 152 Uganda districts,
 * previously cached parishes/villages, and bundled major Ugandan towns.
 */
export function searchOfflineLocations(
  query: string,
  limit = 10,
): LocationSearchHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const districtHits: DistrictSearchHit[] = searchDistricts(q, limit).map(
    (result) => ({
      kind: "district",
      name: result.name,
      slug: result.slug,
      region: result.region,
      matchScore: result.matchScore,
    }),
  );
  const districtNames = new Set(
    districtHits.map((hit) => hit.name.toLowerCase()),
  );

  const combinedPlaces = [...readCachedPlaces(), ...BUNDLED_UGANDA_PLACES];
  const seenKeys = new Set<string>();
  const placeHits: PlaceSearchHit[] = [];

  for (const place of combinedPlaces) {
    if (seenKeys.has(place.key)) continue;
    seenKeys.add(place.key);
    if (districtNames.has(place.name.toLowerCase())) continue;
    const score = scorePlaceMatch(place.name, place.label, q);
    if (score > 0) {
      placeHits.push({
        ...place,
        kind: "place",
        matchScore: score,
      });
    }
  }

  return [...districtHits, ...placeHits]
    .sort((a, b) => b.matchScore - a.matchScore || a.name.localeCompare(b.name))
    .slice(0, limit);
}
