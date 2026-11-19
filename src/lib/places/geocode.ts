import { findNearestDistrict, getDistrictBySlug } from "@/lib/districts";
import { getCached } from "@/lib/cache";
import { fetchWithTimeout } from "@/lib/http/fetch-with-timeout";

const NOMINATIM_TIMEOUT_MS = 2_500;
/**
 * Ceiling on the whole multi-attempt geocode for one locality. Each
 * attempt is already timeout-guarded individually, but up to 4 attempts
 * at 2.5s apiece can still sum to 10s for a single item — this bounds the
 * total regardless of how many attempts run, falling back to the
 * district centroid once it's exceeded.
 */
const GEOCODE_BUDGET_MS = 4_000;

interface NominatimHit {
  lat: string;
  lon: string;
  class?: string;
  type?: string;
  name?: string;
}

const PLACE_TYPES = new Set(["village", "hamlet", "town", "suburb", "neighbourhood", "locality"]);

async function nominatimSearch(query: string, limit = 5): Promise<NominatimHit[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("countrycodes", "ug");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(limit));

  try {
    const response = await fetchWithTimeout(
      (signal) =>
        fetch(url, {
          headers: { "User-Agent": "uganda-weather/1.0" },
          next: { revalidate: 86400 },
          signal,
        }),
      NOMINATIM_TIMEOUT_MS,
    );

    if (!response.ok) return [];
    const payload = (await response.json()) as NominatimHit[];
    return Array.isArray(payload) ? payload : [];
  } catch (error) {
    // Geocoding is an enrichment step (approximate lat/lon for a named
    // locality), not the core search — a Nominatim outage or timeout
    // should degrade to "no coordinates found" rather than take down the
    // whole locality lookup.
    console.error("Nominatim search failed:", error);
    return [];
  }
}

function pickPlaceResult(results: NominatimHit[]) {
  return (
    results.find((result) => result.class === "place" && PLACE_TYPES.has(result.type ?? "")) ??
    results.find((result) => result.class === "place") ??
    results[0]
  );
}

function coordsFromResult(result: NominatimHit | undefined, districtSlug: string) {
  const lat = Number(result?.lat);
  const lon = Number(result?.lon);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return { lat, lon };
  }

  const district = getDistrictBySlug(districtSlug);
  return {
    lat: district?.coordinates.lat ?? 0.356,
    lon: district?.coordinates.lon ?? 32.05,
  };
}

export async function geocodeOfficialLocality(input: {
  cacheKey: string;
  name: string;
  parish: string;
  subcounty: string;
  districtName: string;
  districtSlug: string;
}) {
  const { data } = await getCached(
    `ug:geocode:v2:${input.cacheKey}`,
    7 * 24 * 3600,
    async () => {
      const fallback = () => {
        const { lat, lon } = coordsFromResult(undefined, input.districtSlug);
        return { lat, lon, approximate: true };
      };

      const attemptAll = async () => {
        const attempts = [
          `${input.name}, ${input.parish}, ${input.districtName}, Uganda`,
          `${input.name}, ${input.subcounty}, ${input.districtName}, Uganda`,
          `${input.parish}, ${input.districtName}, Uganda`,
          `${input.subcounty}, ${input.districtName}, Uganda`,
        ];

        for (const [index, query] of attempts.entries()) {
          const results = await nominatimSearch(query, 5);
          const picked = pickPlaceResult(results);
          if (!picked) continue;

          const { lat, lon } = coordsFromResult(picked, input.districtSlug);
          return { lat, lon, approximate: index > 0 };
        }

        return fallback();
      };

      const budget = new Promise<ReturnType<typeof fallback>>((resolve) => {
        setTimeout(() => resolve(fallback()), GEOCODE_BUDGET_MS);
      });

      return Promise.race([attemptAll(), budget]);
    },
  );

  return data;
}

interface NominatimReverseAddress {
  village?: string;
  hamlet?: string;
  town?: string;
  suburb?: string;
  neighbourhood?: string;
  city?: string;
  county?: string;
  state?: string;
}

interface NominatimReverse {
  name?: string;
  display_name?: string;
  address?: NominatimReverseAddress;
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function localityNameFromReverse(payload: NominatimReverse) {
  const address = payload.address ?? {};
  const candidate =
    address.village ??
    address.hamlet ??
    address.town ??
    address.suburb ??
    address.neighbourhood ??
    payload.name;

  return candidate?.trim() ? titleCase(candidate.trim()) : null;
}

function labelFromReverse(payload: NominatimReverse, districtName: string) {
  const address = payload.address ?? {};
  const locality = [address.suburb, address.county, address.city]
    .filter((part): part is string => Boolean(part?.trim()))
    .map((part) => titleCase(part.trim()));

  const district = titleCase(districtName);
  if (locality.length > 0) {
    return `${locality.join(", ")}, ${district}`;
  }
  return `Near ${district}`;
}

export async function reverseGeocodeUganda(lat: number, lon: number) {
  const { data } = await getCached(
    `ug:reverse:v1:${lat.toFixed(3)}:${lon.toFixed(3)}`,
    7 * 24 * 3600,
    async () => {
      const url = new URL("https://nominatim.openstreetmap.org/reverse");
      url.searchParams.set("lat", String(lat));
      url.searchParams.set("lon", String(lon));
      url.searchParams.set("format", "json");
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("zoom", "14");

      let response: Response;
      try {
        response = await fetchWithTimeout(
          (signal) =>
            fetch(url, {
              headers: { "User-Agent": "uganda-weather/1.0" },
              next: { revalidate: 86400 },
              signal,
            }),
          NOMINATIM_TIMEOUT_MS,
        );
      } catch (error) {
        console.error("Nominatim reverse geocode failed:", error);
        const parent = findNearestDistrict(lat, lon);
        return { name: null as string | null, label: `Near ${parent.name}`, approximate: true };
      }

      if (!response.ok) {
        return { name: null as string | null, label: null as string | null, approximate: true };
      }

      const payload = (await response.json()) as NominatimReverse;
      const name = localityNameFromReverse(payload);
      const parent = findNearestDistrict(lat, lon);
      const districtName = parent.name;
      const label = name ? labelFromReverse(payload, districtName) : `Near ${districtName}`;

      return {
        name,
        label,
        approximate: !name,
      };
    },
  );

  return data;
}
