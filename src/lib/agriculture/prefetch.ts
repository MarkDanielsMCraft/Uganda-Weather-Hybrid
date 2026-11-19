import { getDistrictBySlug } from "@/lib/districts";
import { buildAgricultureAdvisory } from "@/lib/agriculture/advisory";
import { getCached } from "@/lib/cache";
import { getWeatherBundleForDistrict } from "@/lib/weather/provider";
import { weatherBundleCacheKey } from "@/lib/weather/resolve-target";
import { PREFETCH_PRIORITY_SLUGS } from "@/lib/weather/prefetch";

const WEATHER_TTL_SECONDS = Number(process.env.CACHE_TTL_CURRENT ?? 600);
const ADVISORY_TTL_SECONDS = 600;

export type AgriculturePrefetchStatus = "cached" | "refreshed" | "not_found" | "error";

export interface AgriculturePrefetchResult {
  slug: string;
  status: AgriculturePrefetchStatus;
  season?: string;
  error?: string;
}

async function prefetchAdvisoryForDistrict(slug: string): Promise<AgriculturePrefetchResult> {
  const district = getDistrictBySlug(slug);
  if (!district) {
    return { slug, status: "not_found" };
  }

  const cacheKey = `ug:agriculture:${district.slug}:advisory:v1`;

  try {
    let fetcherRan = false;
    const { data, stale } = await getCached(cacheKey, ADVISORY_TTL_SECONDS, async () => {
      fetcherRan = true;
      const weather = await getCached(
        weatherBundleCacheKey(district.slug),
        WEATHER_TTL_SECONDS,
        () => getWeatherBundleForDistrict(district),
      ).then((result) => result.data);

      const advisory = buildAgricultureAdvisory(weather);
      return {
        district: {
          slug: district.slug,
          name: district.name,
          region: district.region,
          agroZone: advisory.agroZone,
          rainfallPattern: district.rainfallPattern,
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

    return {
      slug,
      status: fetcherRan || stale ? "refreshed" : "cached",
      season: data.season.label,
    };
  } catch (error) {
    return {
      slug,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function prefetchDistrictAgriculture(
  slugs: string[] = [...PREFETCH_PRIORITY_SLUGS],
  concurrency = 3,
) {
  const unique = [...new Set(slugs.map((slug) => slug.trim().toLowerCase()).filter(Boolean))];
  const results: AgriculturePrefetchResult[] = [];
  const step = Math.max(1, Math.floor(concurrency));

  for (let index = 0; index < unique.length; index += step) {
    const batch = unique.slice(index, index + step);
    const batchResults = await Promise.all(batch.map(prefetchAdvisoryForDistrict));
    results.push(...batchResults);
  }

  return {
    requested: unique.length,
    cached: results.filter((result) => result.status === "cached").length,
    refreshed: results.filter((result) => result.status === "refreshed").length,
    errors: results.filter((result) => result.status === "error"),
    notFound: results.filter((result) => result.status === "not_found"),
    results,
  };
}
