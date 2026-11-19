import { getDistrictBySlug } from "@/lib/districts";
import { getCached } from "@/lib/cache";
import { getAlertsForDistrict } from "@/lib/alerts";
import { getWeatherBundleForDistrict } from "@/lib/weather/provider";
import { weatherBundleCacheKey } from "@/lib/weather/resolve-target";
import { PREFETCH_PRIORITY_SLUGS } from "@/lib/weather/prefetch";

const WEATHER_TTL_SECONDS = Number(process.env.CACHE_TTL_CURRENT ?? 600);
const ALERTS_TTL_SECONDS = 300;

export type AlertsPrefetchStatus = "cached" | "refreshed" | "not_found" | "error";

export interface AlertsPrefetchResult {
  slug: string;
  status: AlertsPrefetchStatus;
  alertCount?: number;
  error?: string;
}

async function prefetchAlertsForDistrict(slug: string): Promise<AlertsPrefetchResult> {
  const district = getDistrictBySlug(slug);
  if (!district) {
    return { slug, status: "not_found" };
  }

  try {
    let fetcherRan = false;
    const { data, stale } = await getCached(
      `ug:alerts:${district.slug}:v1`,
      ALERTS_TTL_SECONDS,
      async () => {
        fetcherRan = true;
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

    return {
      slug,
      status: fetcherRan || stale ? "refreshed" : "cached",
      alertCount: data.alerts.length,
    };
  } catch (error) {
    return {
      slug,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function prefetchDistrictAlerts(
  slugs: string[] = [...PREFETCH_PRIORITY_SLUGS],
  concurrency = 3,
) {
  const unique = [...new Set(slugs.map((slug) => slug.trim().toLowerCase()).filter(Boolean))];
  const results: AlertsPrefetchResult[] = [];
  const step = Math.max(1, Math.floor(concurrency));

  for (let index = 0; index < unique.length; index += step) {
    const batch = unique.slice(index, index + step);
    const batchResults = await Promise.all(batch.map(prefetchAlertsForDistrict));
    results.push(...batchResults);
  }

  return {
    requested: unique.length,
    cached: results.filter((result) => result.status === "cached").length,
    refreshed: results.filter((result) => result.status === "refreshed").length,
    withAlerts: results.filter((result) => (result.alertCount ?? 0) > 0).length,
    errors: results.filter((result) => result.status === "error"),
    notFound: results.filter((result) => result.status === "not_found"),
    results,
  };
}
