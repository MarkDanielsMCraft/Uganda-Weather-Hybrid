import { getCached, createMeta, jsonResponse, errorResponse } from "@/lib/cache";
import { enforceRateLimit, mergeRateLimitHeaders } from "@/lib/api/route-utils";
import { getWeatherBundleForDistrict } from "@/lib/weather/provider";
import { resolveWeatherTarget } from "@/lib/weather/resolve-target";

const CACHE_TTL_CURRENT = Number(process.env.CACHE_TTL_CURRENT ?? 600);

export async function GET(request: Request) {
  const rateLimit = enforceRateLimit(request);
  if (rateLimit instanceof Response) return rateLimit;

  const { searchParams } = new URL(request.url);
  const target = resolveWeatherTarget(searchParams);
  if (!target.ok) {
    return errorResponse(target.code, target.message, target.code === "NOT_FOUND" ? 404 : 400);
  }

  try {
    const { data, stale } = await getCached(
      target.cacheKey,
      CACHE_TTL_CURRENT,
      () => getWeatherBundleForDistrict(target.district),
    );

    const meta = createMeta(stale);
    return jsonResponse(
      { ...data, stale },
      meta,
      mergeRateLimitHeaders(
        { headers: { "X-Cache": stale ? "STALE" : "HIT" } },
        rateLimit.headers,
      ),
    );
  } catch {
    return errorResponse(
      "SERVICE_UNAVAILABLE",
      "Weather data temporarily unavailable",
      503,
    );
  }
}

