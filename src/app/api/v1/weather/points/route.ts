import { getCached, createMeta, jsonResponse, errorResponse } from "@/lib/cache";
import { enforceRateLimit, mergeRateLimitHeaders } from "@/lib/api/route-utils";
import { createPlaceLocation, districtFromPlace } from "@/lib/places/district-from-place";
import { NATIONAL_PARKS, MOUNTAIN_PEAKS, type PointOfInterest } from "@/lib/places/points-of-interest";
import { getWeatherBundleForDistrict } from "@/lib/weather/provider";
import { mapWithConcurrency } from "@/lib/weather/fan-out";

const POINTS_TTL_SECONDS = Number(process.env.CACHE_TTL_CURRENT ?? 600);

const SETS: Record<string, PointOfInterest[]> = {
  parks: NATIONAL_PARKS,
  mountains: MOUNTAIN_PEAKS,
};

interface PointWeather {
  key: string;
  name: string;
  tempC: number;
  conditionText: string;
  icon: string;
  theme: string;
  isDay?: boolean;
}

async function weatherForPoint(point: PointOfInterest): Promise<PointWeather | null> {
  try {
    const place = createPlaceLocation({
      key: point.key,
      name: point.name,
      lat: point.lat,
      lon: point.lon,
      label: point.label,
      parentDistrictSlug: point.parentDistrictSlug,
    });
    const district = districtFromPlace(place);
    // Only the current conditions are read below, so the ten day top up would
    // be wasted work on a route that already fans out over every park.
    const bundle = await getWeatherBundleForDistrict(district, { fullForecast: false });

    // The demo bundle is a pure function of latitude, so a park that falls
    // through to it shows the same temperature forever. This payload carries
    // no source, so the tile cannot tell that apart from a real reading and
    // would present a constant as live weather. Report it as unavailable
    // instead, which is what the tile already does for a failed lookup.
    if (bundle.source === "demo" || bundle.source === "demo-fallback") {
      return null;
    }

    return {
      key: point.key,
      name: point.name,
      tempC: Math.round(bundle.temperature.celsius),
      conditionText: bundle.condition.text,
      icon: bundle.condition.icon,
      theme: bundle.condition.theme,
      isDay: bundle.isDay,
    };
  } catch (error) {
    console.error(`Point weather failed for ${point.key}:`, error);
    return null;
  }
}

export async function GET(request: Request) {
  const rateLimit = enforceRateLimit(request);
  if (rateLimit instanceof Response) return rateLimit;

  const { searchParams } = new URL(request.url);
  const set = searchParams.get("set") ?? "";
  const points = SETS[set];

  if (!points) {
    return errorResponse("BAD_REQUEST", "set must be 'parks' or 'mountains'", 400);
  }

  const { data, stale } = await getCached(`points:${set}:v1`, POINTS_TTL_SECONDS, async () => {
    const results = await mapWithConcurrency(points, weatherForPoint);
    return results.filter((result): result is PointWeather => result !== null);
  });

  const meta = createMeta(stale);
  return jsonResponse(
    { points: data },
    meta,
    mergeRateLimitHeaders({ headers: { "X-Cache": stale ? "STALE" : "HIT" } }, rateLimit.headers),
  );
}
