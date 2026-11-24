import { getCached, createMeta, jsonResponse, errorResponse } from "@/lib/cache";
import { enforceRateLimit, mergeRateLimitHeaders } from "@/lib/api/route-utils";
import { reserveQuota } from "@/lib/quota/monthly-budget";
import { fetchHistoricalNormal } from "@/lib/weather/historical-averages";
import { resolveWeatherTarget } from "@/lib/weather/resolve-target";

// "Typical high for this date" doesn't need to be fresh daily, so this
// caches for a week — at 152 districts that's roughly 22 calls/day worst
// case, real headroom under Visual Crossing's 1,000 records/day free tier.
const AVERAGES_TTL_SECONDS = 7 * 24 * 60 * 60;
// reserveQuota is month-scoped; Visual Crossing's actual cap is daily
// (1,000 records/day). 25,000/month averages to ~830/day, comfortably
// under that even before accounting for the real ~22/day expected volume
// — this is a coarser safety net than a true daily counter, not worth a
// second quota mechanism for how far under the cap real usage sits.
const VISUAL_CROSSING_MONTHLY_BUDGET = 25_000;

export async function GET(request: Request) {
  const rateLimit = enforceRateLimit(request);
  if (rateLimit instanceof Response) return rateLimit;

  const { searchParams } = new URL(request.url);
  const target = resolveWeatherTarget(searchParams);

  if (!target.ok) {
    return errorResponse(target.code, target.message, target.code === "NOT_FOUND" ? 404 : 400);
  }

  if (!process.env.VISUAL_CROSSING_API_KEY) {
    return jsonResponse({ average: null }, createMeta(false));
  }

  const cacheKey = target.cacheKey
    .replace("ug:weather:", "ug:weather:averages:")
    .replace(/:bundle:v\d+/, ":v1");

  try {
    const { data, stale } = await getCached(cacheKey, AVERAGES_TTL_SECONDS, async () => {
      const allowed = await reserveQuota("visual-crossing", VISUAL_CROSSING_MONTHLY_BUDGET);
      if (!allowed) return null;
      return fetchHistoricalNormal(target.district);
    });

    return jsonResponse(
      { average: data },
      createMeta(stale),
      mergeRateLimitHeaders({ headers: { "X-Cache": stale ? "STALE" : "HIT" } }, rateLimit.headers),
    );
  } catch (error) {
    // A real failure (an outside service or a code fault), so it is logged.
    console.error("[api] action failed action=weather/averages:", error);
    return errorResponse("SERVICE_UNAVAILABLE", "Historical averages temporarily unavailable", 503);
  }
}
