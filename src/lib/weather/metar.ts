// NOAA's Aviation Weather Center Data API: public, no key, plain GET.
// https://aviationweather.gov/data/api/ — a genuine live feed, not a
// general weather provider, so this stays a separate module rather than
// folding into the WeatherAPI/Open-Meteo/Pirate Weather fallback chain.

export interface MetarCloudLayer {
  cover: string;
  base: number | null;
}

export interface MetarReport {
  icaoId: string;
  name: string;
  rawOb: string;
  reportTime: string;
  tempC: number | null;
  dewpointC: number | null;
  windDirDeg: number | string | null;
  windSpeedKt: number | null;
  visibility: string | null;
  altimeterHpa: number | null;
  flightCategory: string | null;
  clouds: MetarCloudLayer[];
}

interface RawMetarEntry {
  icaoId?: string;
  name?: string;
  rawOb?: string;
  reportTime?: string;
  temp?: number | null;
  dewp?: number | null;
  wdir?: number | string | null;
  wspd?: number | null;
  visib?: string | number | null;
  altim?: number | null;
  fltCat?: string | null;
  clouds?: Array<{ cover?: string; base?: number | null }>;
}

const METAR_BASE_URL = "https://aviationweather.gov/api/data/metar";
// NOAA's own guidance: identify the calling application with a real
// User-Agent so automated traffic filtering doesn't block it.
const USER_AGENT = "uganda-weather-app (https://github.com/, contact via site)";

export async function fetchMetar(icaoIds: string[]): Promise<MetarReport[]> {
  if (icaoIds.length === 0) return [];

  const url = `${METAR_BASE_URL}?ids=${icaoIds.join(",")}&format=json`;
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`METAR fetch failed: ${response.status}`);
  }

  const raw = (await response.json()) as RawMetarEntry[];

  // Stations with no active observation simply don't appear in the
  // response — never backfilled with a guess.
  return raw
    .filter((entry): entry is RawMetarEntry & { icaoId: string; rawOb: string } =>
      Boolean(entry.icaoId && entry.rawOb),
    )
    .map((entry) => ({
      icaoId: entry.icaoId,
      name: entry.name ?? entry.icaoId,
      rawOb: entry.rawOb,
      reportTime: entry.reportTime ?? "",
      tempC: entry.temp ?? null,
      dewpointC: entry.dewp ?? null,
      windDirDeg: entry.wdir ?? null,
      windSpeedKt: entry.wspd ?? null,
      visibility: entry.visib != null ? String(entry.visib) : null,
      altimeterHpa: entry.altim ?? null,
      flightCategory: entry.fltCat ?? null,
      clouds: (entry.clouds ?? []).map((cloud) => ({
        cover: cloud.cover ?? "",
        base: cloud.base ?? null,
      })),
    }));
}
