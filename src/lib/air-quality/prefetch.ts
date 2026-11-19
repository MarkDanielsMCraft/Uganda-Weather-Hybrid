import { getDistrictBySlug } from "@/lib/districts";
import { getCached } from "@/lib/cache";
import { getWeatherBundleForDistrict } from "@/lib/weather/provider";
import { weatherBundleCacheKey } from "@/lib/weather/resolve-target";
import { PREFETCH_PRIORITY_SLUGS } from "@/lib/weather/prefetch";

const WEATHER_TTL_SECONDS = Number(process.env.CACHE_TTL_CURRENT ?? 600);
const AIR_QUALITY_TTL_SECONDS = 600;

export type AirQualityPrefetchStatus = "cached" | "refreshed" | "not_found" | "error";

export interface AirQualityPrefetchResult {
  slug: string;
  status: AirQualityPrefetchStatus;
  category?: string;
  error?: string;
}

async function prefetchAirQualityForDistrict(slug: string): Promise<AirQualityPrefetchResult> {
  const district = getDistrictBySlug(slug);
  if (!district) {
    return { slug, status: "not_found" };
  }

  const cacheKey = `ug:air-quality:${district.slug}:v1`;

  try {
    let fetcherRan = false;
    const { data, stale } = await getCached(cacheKey, AIR_QUALITY_TTL_SECONDS, async () => {
      fetcherRan = true;
      const { data: bundle } = await getCached(
        weatherBundleCacheKey(district.slug),
        WEATHER_TTL_SECONDS,
        () => getWeatherBundleForDistrict(district),
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
    });

    return {
      slug,
      status: fetcherRan || stale ? "refreshed" : "cached",
      category: data.airQuality.category,
    };
  } catch (error) {
    return {
      slug,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function prefetchDistrictAirQuality(
  slugs: string[] = [...PREFETCH_PRIORITY_SLUGS],
  concurrency = 3,
) {
  const unique = [...new Set(slugs.map((slug) => slug.trim().toLowerCase()).filter(Boolean))];
  const results: AirQualityPrefetchResult[] = [];
  const step = Math.max(1, Math.floor(concurrency));

  for (let index = 0; index < unique.length; index += step) {
    const batch = unique.slice(index, index + step);
    const batchResults = await Promise.all(batch.map(prefetchAirQualityForDistrict));
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
