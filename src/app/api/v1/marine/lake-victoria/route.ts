import { getDistrictBySlug } from "@/lib/districts";
import { isLakeShoreSlug } from "@/lib/places/share";
import {
  buildLakeVictoriaConditions,
  lakeZoneForDistrict,
  referenceLakeDistrictSlug,
  type LakeZone,
} from "@/lib/marine/lake-victoria";
import { getCached, createMeta, jsonResponse, errorResponse } from "@/lib/cache";
import { enforceRateLimit, mergeRateLimitHeaders } from "@/lib/api/route-utils";
import { getWeatherBundleForDistrict } from "@/lib/weather/provider";
import { weatherBundleCacheKey } from "@/lib/weather/resolve-target";

const ZONES: LakeZone[] = ["central", "eastern", "western"];
const WEATHER_TTL_SECONDS = Number(process.env.CACHE_TTL_CURRENT ?? 600);
const MARINE_TTL_SECONDS = 300;

function resolveLakeDistrict(searchParams: URLSearchParams) {
  const shore = searchParams.get("shore");
  if (shore !== null) {
    if (!isLakeShoreSlug(shore)) return null;
    return getDistrictBySlug(shore) ?? null;
  }

  const zone = searchParams.get("zone");
  const districtParam = searchParams.get("district");
  const zoneParam = zone ?? districtParam;
  if (zoneParam !== null) {
    const direct = getDistrictBySlug(zoneParam);
    if (direct) return direct;
    if (ZONES.includes(zoneParam as LakeZone)) {
      const slug = zoneParam === "eastern" ? "jinja" : zoneParam === "western" ? "masaka" : "kalangala";
      return getDistrictBySlug(slug) ?? null;
    }
    return null;
  }

  return getDistrictBySlug("kalangala") ?? null;
}

export async function GET(request: Request) {
  const rateLimit = enforceRateLimit(request);
  if (rateLimit instanceof Response) return rateLimit;

  const { searchParams } = new URL(request.url);
  const district = resolveLakeDistrict(searchParams);

  if (!district) {
    return errorResponse("BAD_REQUEST", "Invalid lake shore, zone, or district parameter", 400);
  }

  const lakeSlug = referenceLakeDistrictSlug(district);
  const cacheKey = `ug:marine:lake:${lakeSlug}:v1`;

  try {
    const { data, stale } = await getCached(cacheKey, MARINE_TTL_SECONDS, async () => {
      const lakeDistrict = getDistrictBySlug(lakeSlug) ?? district;
      const weather = await getCached(
        weatherBundleCacheKey(lakeDistrict.slug),
        WEATHER_TTL_SECONDS,
        () => getWeatherBundleForDistrict(lakeDistrict),
      ).then((result) => result.data);

      const conditions = buildLakeVictoriaConditions(weather);

      return {
        district: {
          slug: lakeDistrict.slug,
          name: lakeDistrict.name,
        },
        zone: lakeZoneForDistrict(lakeDistrict),
        waveHeightM: conditions.waveHeightM,
        windSpeedKph: conditions.windSpeedKph,
        windDirection: conditions.windDirection,
        waterTempC: conditions.waterTempC,
        visibilityKm: conditions.visibilityKm,
        fishingSafety: conditions.fishingSafety,
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
  } catch (error) {
    // A real failure (an outside service or a code fault), so it is logged.
    console.error("[api] action failed action=marine/lake-victoria:", error);
    return errorResponse("SERVICE_UNAVAILABLE", "Marine data temporarily unavailable", 503);
  }
}
