export interface PollutantBreakdown {
  co: number;
  no2: number;
  o3: number;
  pm10: number;
  pm25: number;
}

interface OpenWeatherMapAirPollutionResponse {
  list?: Array<{
    components?: {
      co?: number;
      no2?: number;
      o3?: number;
      pm10?: number;
      pm2_5?: number;
    };
  }>;
}

function round(value: number | undefined, decimals = 1): number {
  if (value == null) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** OpenWeatherMap's classic Air Pollution endpoint, additive enrichment
    only (the app's own aqiFromPm25-derived category/advice already works
    without this). Returns null on any failure or missing key so callers
    degrade to what they already have rather than surfacing an error for
    a "nice to have" pollutant-by-pollutant breakdown. */
export async function fetchPollutantBreakdown(
  coords: { lat: number; lon: number },
  signal?: AbortSignal,
): Promise<PollutantBreakdown | null> {
  const key = process.env.OPENWEATHERMAP_API_KEY;
  if (!key) return null;

  try {
    const url = new URL("https://api.openweathermap.org/data/2.5/air_pollution");
    url.searchParams.set("lat", String(coords.lat));
    url.searchParams.set("lon", String(coords.lon));
    url.searchParams.set("appid", key);

    const response = await fetch(url, { signal, next: { revalidate: 0 } });
    if (!response.ok) return null;

    const payload = (await response.json()) as OpenWeatherMapAirPollutionResponse;
    const components = payload.list?.[0]?.components;
    if (!components) return null;

    return {
      co: round(components.co, 0),
      no2: round(components.no2),
      o3: round(components.o3),
      pm10: round(components.pm10),
      pm25: round(components.pm2_5),
    };
  } catch {
    return null;
  }
}
