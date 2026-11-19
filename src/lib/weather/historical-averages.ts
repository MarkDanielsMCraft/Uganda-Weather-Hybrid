import type { District } from "@/types/weather";
import { openMeteoCoordsForDistrict } from "./location-query";

export interface HistoricalNormal {
  /** The mean high across the historical record for this calendar date at
      this location. Not today's weather, and not a forecast. */
  normalHigh: number;
}

export interface NormalComparison {
  actualHigh: number;
  normalHigh: number;
  diff: number;
}

interface VisualCrossingResponse {
  days?: Array<{
    normal?: {
      tempmax?: [number, number, number];
    };
  }>;
}

function todayInUganda(): string {
  // en-CA gives an ISO-shaped YYYY-MM-DD string, which is what Visual
  // Crossing's date-range endpoint expects.
  return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Kampala" });
}

/**
 * Visual Crossing's Timeline API, the climate normal only.
 *
 * `normal.tempmax` is [min, mean, max] across their historical record for
 * the given calendar date at this location, and the mean is what this app
 * shows as "typical". Verified against upstream documentation: 24-hour history
 * endpoints only cover the preceding day rather than multi-year climate normals.
 *
 * Deliberately does not read the same response's `tempmax`. That field used
 * to be taken as today's actual high, and in production it came back equal
 * to the normal for every district tested, at both ends of the day, on
 * uncached calls. The tile therefore always announced "0 at average": a
 * climate normal compared against itself and presented under the label
 * "Today". Today's high is something this app already knows from its own
 * provider chain, so the caller supplies it and the two numbers now come
 * from independent sources.
 */
export async function fetchHistoricalNormal(
  district: District,
  signal?: AbortSignal,
): Promise<HistoricalNormal | null> {
  const key = process.env.VISUAL_CROSSING_API_KEY;
  if (!key) return null;

  try {
    const coords = openMeteoCoordsForDistrict(district);
    const date = todayInUganda();
    const url =
      `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/` +
      `${coords.lat},${coords.lon}/${date}?key=${key}&unitGroup=metric&include=stats&contentType=json`;

    const USER_AGENT =
      "uganda-weather/1.0 (https://uganda-weather.com; contact@uganda-weather.com)";

    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal,
      next: { revalidate: 0 },
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as VisualCrossingResponse;
    const normalHigh = payload.days?.[0]?.normal?.tempmax?.[1];
    if (normalHigh == null) return null;

    return { normalHigh: Math.round(normalHigh) };
  } catch {
    return null;
  }
}

/** Compares the high this app is already showing against the climate
    normal. Kept beside the fetch so the pairing can be tested without
    rendering a component, and so the rounding happens in one place. */
export function compareHighToNormal(
  todayHigh: number,
  normal: HistoricalNormal,
): NormalComparison {
  const actualHigh = Math.round(todayHigh);
  return {
    actualHigh,
    normalHigh: normal.normalHigh,
    diff: actualHigh - normal.normalHigh,
  };
}
