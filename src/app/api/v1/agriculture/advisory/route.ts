import { buildAgricultureAdvisory } from "@/lib/agriculture/advisory";
import { getCached, createMeta, jsonResponse, errorResponse } from "@/lib/cache";
import { enforceRateLimit, mergeRateLimitHeaders } from "@/lib/api/route-utils";
import { getWeatherBundleForDistrict } from "@/lib/weather/provider";
import { resolveWeatherTarget } from "@/lib/weather/resolve-target";

const WEATHER_TTL_SECONDS = Number(process.env.CACHE_TTL_CURRENT ?? 600);
const ADVISORY_TTL_SECONDS = 600;

export async function GET(request: Request) {
  const rateLimit = enforceRateLimit(request);
  if (rateLimit instanceof Response) return rateLimit;

  const { searchParams } = new URL(request.url);
  const target = resolveWeatherTarget(searchParams);

  if (!target.ok) {
    return errorResponse(target.code, target.message, target.code === "NOT_FOUND" ? 404 : 400);
  }

  const advisoryCacheKey = target.cacheKey
    .replace("ug:weather:", "ug:agriculture:")
    .replace(/:bundle:v\d+/, ":advisory:v1");

  try {
    const { data, stale } = await getCached(advisoryCacheKey, ADVISORY_TTL_SECONDS, async () => {
      const { data: weather } = await getCached(target.cacheKey, WEATHER_TTL_SECONDS, () =>
        getWeatherBundleForDistrict(target.district),
      );
      const advisory = buildAgricultureAdvisory(weather);

      return {
        district: {
          slug: weather.district.slug,
          name: weather.district.name,
          region: weather.district.region,
          agroZone: advisory.agroZone,
          rainfallPattern: weather.district.rainfallPattern,
        },
        agroZoneLabel: advisory.agroZoneLabel,
        season: advisory.season,
        soilMoisture: advisory.soilMoisture,
        crops: advisory.crops,
        cropAdvisories: advisory.cropAdvisories,
        recommendations: advisory.recommendations,
        weeklyRainChance: weather.dailyForecast.slice(0, 7).map((day) => ({
          day: day.day,
          date: day.date,
          rainChance: day.rainChance ?? 0,
        })),
        updatedAt: weather.updatedAt,
        source: weather.source,
      };
    });

    const meta = createMeta(stale);

    return jsonResponse(
      data,
      meta,
      mergeRateLimitHeaders({ headers: { "X-Cache": stale ? "STALE" : "HIT" } }, rateLimit.headers),
    );
  } catch {
    return errorResponse("SERVICE_UNAVAILABLE", "Advisory temporarily unavailable", 503);
  }
}
