import { findNearestDistrict, getDistrictBySlug } from "@/lib/districts";
import { getCached } from "@/lib/cache";
import { fetchWithTimeout } from "@/lib/http/fetch-with-timeout";
import { MapServiceBusyError, waitForNominatimTurn } from "@/lib/places/nominatim-pacer";

const NOMINATIM_USER_AGENT = "uganda-weather/1.0 (+https://hybrid.uganda-weather.com)";

const NOMINATIM_TIMEOUT_MS = 2_500;
/** Ceiling on the whole lookup for one place, including the wait for a
    turn with the map service. Past it the district point is used instead. */
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
  await waitForNominatimTurn();
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("countrycodes", "ug");
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(limit));

  // Any failure (a refusal such as 429, an error, or a timeout) counts as
  // busy, so the rough fallback it leads to is never saved.
  let response: Response;
  try {
    response = await fetchWithTimeout(
      (signal) =>
        fetch(url, {
          headers: { "User-Agent": NOMINATIM_USER_AGENT },
          next: { revalidate: 86400 },
          signal,
        }),
      NOMINATIM_TIMEOUT_MS,
    );
  } catch {
    console.warn("[places] action blocked action=map_search code=MAP_UNREACHABLE");
    throw new MapServiceBusyError();
  }
  if (!response.ok) {
    console.warn(`[places] action blocked action=map_search code=MAP_STATUS_${response.status}`);
    throw new MapServiceBusyError();
  }
  const payload = (await response.json().catch(() => null)) as NominatimHit[] | null;
  return Array.isArray(payload) ? payload : [];
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
  try {
    return await geocodeOfficialLocalityCached(input);
  } catch (error) {
    if (!(error instanceof MapServiceBusyError)) throw error;
    const { lat, lon } = coordsFromResult(undefined, input.districtSlug);
    return { lat, lon, approximate: true, busy: true as const };
  }
}

async function geocodeOfficialLocalityCached(input: {
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
      // Two tries at most per place, because each try waits its turn for the
      // map service. A busy or slow answer is never saved, so a rough
      // location made under load does not stick for a week.
      const attemptAll = async (): Promise<{ lat: number; lon: number; approximate: boolean } | "busy"> => {
        const attempts = [
          `${input.name}, ${input.parish}, ${input.districtName}, Uganda`,
          `${input.parish}, ${input.districtName}, Uganda`,
        ];

        for (const [index, query] of attempts.entries()) {
          let results: NominatimHit[];
          try {
            results = await nominatimSearch(query, 5);
          } catch (error) {
            if (error instanceof MapServiceBusyError) return "busy";
            throw error;
          }
          const picked = pickPlaceResult(results);
          if (!picked) continue;

          const { lat, lon } = coordsFromResult(picked, input.districtSlug);
          return { lat, lon, approximate: index > 0 };
        }

        const { lat, lon } = coordsFromResult(undefined, input.districtSlug);
        return { lat, lon, approximate: true };
      };

      const budget = new Promise<"busy">((resolve) => {
        setTimeout(() => resolve("busy"), GEOCODE_BUDGET_MS);
      });

      const outcome = await Promise.race([attemptAll().catch(() => "busy" as const), budget]);
      if (outcome === "busy") throw new MapServiceBusyError();
      return outcome;
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
  try {
    return await reverseGeocodeUgandaCached(lat, lon);
  } catch (error) {
    if (!(error instanceof MapServiceBusyError)) throw error;
    const parent = findNearestDistrict(lat, lon);
    return { name: null as string | null, label: `Near ${parent.name}`, approximate: true };
  }
}

async function reverseGeocodeUgandaCached(lat: number, lon: number) {
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
      await waitForNominatimTurn();

      let response: Response;
      try {
        response = await fetchWithTimeout(
          (signal) =>
            fetch(url, {
              headers: { "User-Agent": NOMINATIM_USER_AGENT },
              next: { revalidate: 86400 },
              signal,
            }),
          NOMINATIM_TIMEOUT_MS,
        );
      } catch {
        console.warn("[places] action blocked action=map_reverse code=MAP_UNREACHABLE");
        throw new MapServiceBusyError();
      }

      if (!response.ok) {
        console.warn(`[places] action blocked action=map_reverse code=MAP_STATUS_${response.status}`);
        throw new MapServiceBusyError();
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
