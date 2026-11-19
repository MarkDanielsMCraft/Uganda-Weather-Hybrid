import { getCached, createMeta, jsonResponse, errorResponse } from "@/lib/cache";
import { enforceRateLimit, mergeRateLimitHeaders } from "@/lib/api/route-utils";
import { forecastQuerySchema } from "@/lib/validation/schemas";
import { getWeatherBundleForDistrict } from "@/lib/weather/provider";
import { resolveWeatherTarget } from "@/lib/weather/resolve-target";

const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_FORECAST ?? 3600);

export async function GET(request: Request) {
  const rateLimit = enforceRateLimit(request);
  if (rateLimit instanceof Response) return rateLimit;

  const { searchParams } = new URL(request.url);
  const parsed = forecastQuerySchema.safeParse({
    district: searchParams.get("district") ?? undefined,
    place: searchParams.get("place") ?? undefined,
    name: searchParams.get("name") ?? undefined,
    lat: searchParams.get("lat") ?? undefined,
    lon: searchParams.get("lon") ?? undefined,
    label: searchParams.get("label") ?? undefined,
    parent: searchParams.get("parent") ?? undefined,
    days: searchParams.get("days") ?? undefined,
  });

  if (!parsed.success) {
    return errorResponse("BAD_REQUEST", "Invalid forecast parameters", 400);
  }

  const target = resolveWeatherTarget(searchParams);
  if (!target.ok) {
    return errorResponse(target.code, target.message, target.code === "NOT_FOUND" ? 404 : 400);
  }

  try {
    const { data: bundle, stale } = await getCached(target.cacheKey, CACHE_TTL_SECONDS, () =>
      getWeatherBundleForDistrict(target.district),
    );

    const days = parsed.data.days ?? 10;
    const meta = createMeta(stale);

    return jsonResponse(
      {
        district: {
          slug: bundle.district.slug,
          name: bundle.district.name,
          region: bundle.district.region,
        },
        days,
        dailyForecast: bundle.dailyForecast.slice(0, days),
        astronomy: bundle.astronomy,
        updatedAt: bundle.updatedAt,
        source: bundle.source,
      },
      meta,
      mergeRateLimitHeaders({ headers: { "X-Cache": stale ? "STALE" : "HIT" } }, rateLimit.headers),
    );
  } catch {
    return errorResponse("SERVICE_UNAVAILABLE", "Forecast temporarily unavailable", 503);
  }
}
