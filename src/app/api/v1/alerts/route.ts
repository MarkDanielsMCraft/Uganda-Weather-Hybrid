import { getDistrictBySlug } from "@/lib/districts";
import { getCached, createMeta, jsonResponse, errorResponse } from "@/lib/cache";
import { enforceRateLimit, mergeRateLimitHeaders } from "@/lib/api/route-utils";
import { getAlertsForDistrict } from "@/lib/alerts";
import { districtQuerySchema } from "@/lib/validation/schemas";
import { getWeatherBundleForDistrict } from "@/lib/weather/provider";
import { weatherBundleCacheKey } from "@/lib/weather/resolve-target";

const WEATHER_TTL_SECONDS = Number(process.env.CACHE_TTL_CURRENT ?? 600);
const ALERTS_TTL_SECONDS = 300;

export async function GET(request: Request) {
  const rateLimit = enforceRateLimit(request);
  if (rateLimit instanceof Response) return rateLimit;

  const { searchParams } = new URL(request.url);
  const parsed = districtQuerySchema.safeParse({
    district: searchParams.get("district") ?? "",
  });

  if (!parsed.success) {
    return errorResponse("BAD_REQUEST", "Invalid district parameter", 400);
  }

  const district = getDistrictBySlug(parsed.data.district);
  if (!district) {
    return errorResponse("NOT_FOUND", `District '${parsed.data.district}' not found`, 404);
  }

  try {
    const { data, stale } = await getCached(
      `ug:alerts:${district.slug}:v1`,
      ALERTS_TTL_SECONDS,
      async () => {
        const { data: bundle } = await getCached(
          weatherBundleCacheKey(district.slug),
          WEATHER_TTL_SECONDS,
          () => getWeatherBundleForDistrict(district),
        );
        const alerts = await getAlertsForDistrict(district, bundle.alerts);
        return {
          district: {
            slug: district.slug,
            name: district.name,
            region: district.region,
          },
          alerts,
          updatedAt: bundle.updatedAt,
          source: bundle.source,
        };
      },
    );

    const meta = createMeta(stale);

    return jsonResponse(data, meta, mergeRateLimitHeaders({ headers: { "X-Cache": stale ? "STALE" : "HIT" } }, rateLimit.headers));
  } catch (error) {
    // A real failure (an outside service or a code fault), so it is logged.
    console.error("[api] action failed action=alerts:", error);
    return errorResponse("SERVICE_UNAVAILABLE", "Alerts temporarily unavailable", 503);
  }
}
