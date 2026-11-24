import { getCached, createMeta, jsonResponse, errorResponse } from "@/lib/cache";
import { enforceRateLimit, mergeRateLimitHeaders } from "@/lib/api/route-utils";
import { fetchPollutantBreakdown } from "@/lib/air-quality/openweathermap";
import { reserveQuota } from "@/lib/quota/monthly-budget";
import { getWeatherBundleForDistrict } from "@/lib/weather/provider";
import { coordinatesForWeather } from "@/lib/weather/location-query";
import { resolveWeatherTarget, withRequestedPlace } from "@/lib/weather/resolve-target";

const WEATHER_TTL_SECONDS = Number(process.env.CACHE_TTL_CURRENT ?? 600);
const AIR_QUALITY_TTL_SECONDS = 600;
// Enrichment only, not on the critical path — a longer TTL than the base
// air quality data is fine since pollutant levels don't swing minute to
// minute the way the category/advice summary can.
const POLLUTANT_TTL_SECONDS = 30 * 60;
// OpenWeatherMap's free tier is 1M calls/month; this is only ever called
// when a user opens the Air Quality tile's detail view, so real volume is
// nowhere near this, but the guard is here for consistency with every
// other new provider and as an early warning if usage patterns change.
const OPENWEATHERMAP_MONTHLY_BUDGET = 950_000;

export async function GET(request: Request) {
  const rateLimit = enforceRateLimit(request);
  if (rateLimit instanceof Response) return rateLimit;

  const { searchParams } = new URL(request.url);
  const target = resolveWeatherTarget(searchParams);

  if (!target.ok) {
    return errorResponse(target.code, target.message, target.code === "NOT_FOUND" ? 404 : 400);
  }

  const airCacheKey = target.cacheKey
    .replace("ug:weather:", "ug:air-quality:")
    .replace(/:bundle:v\d+/, ":v1");

  try {
    const [{ data, stale }, pollutants] = await Promise.all([
      getCached(airCacheKey, AIR_QUALITY_TTL_SECONDS, async () => {
        const { data: bundle } = await getCached(target.cacheKey, WEATHER_TTL_SECONDS, () =>
          getWeatherBundleForDistrict(target.district),
        );

        return {
          district: {
            slug: bundle.district.slug,
            name: bundle.district.name,
            region: bundle.district.region,
          },
          airQuality: bundle.airQuality,
          uvIndex: bundle.uvIndex,
          updatedAt: bundle.updatedAt,
          source: bundle.source,
        };
      }),
      fetchPollutants(target),
    ]);

    const meta = createMeta(stale);

    return jsonResponse(
      { ...withRequestedPlace(data, target), pollutants },
      meta,
      mergeRateLimitHeaders({ headers: { "X-Cache": stale ? "STALE" : "HIT" } }, rateLimit.headers),
    );
  } catch {
    return errorResponse("SERVICE_UNAVAILABLE", "Air quality temporarily unavailable", 503);
  }
}

async function fetchPollutants(target: Extract<ReturnType<typeof resolveWeatherTarget>, { ok: true }>) {
  if (!process.env.OPENWEATHERMAP_API_KEY) return null;

  const pollutantCacheKey = target.cacheKey
    .replace("ug:weather:", "ug:air-quality:pollutants:")
    .replace(/:bundle:v\d+/, ":v1");

  try {
    const { data } = await getCached(pollutantCacheKey, POLLUTANT_TTL_SECONDS, async () => {
      const allowed = await reserveQuota("openweathermap-air", OPENWEATHERMAP_MONTHLY_BUDGET);
      if (!allowed) return null;
      return fetchPollutantBreakdown(coordinatesForWeather(target.district));
    });
    return data;
  } catch {
    return null;
  }
}
