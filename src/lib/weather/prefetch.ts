import { getAllDistricts, getDistrictBySlug } from "@/lib/districts";
import { getCached } from "@/lib/cache";
import { getWeatherBundleForDistrict } from "./provider";
import { weatherBundleCacheKey } from "./resolve-target";

/** High-traffic districts refreshed every cron cycle. */
export const PREFETCH_PRIORITY_SLUGS = [
  "kampala",
  "entebbe",
  "wakiso",
  "mukono",
  "jinja",
  "mbarara",
  "gulu",
  "mbale",
  "arua",
  "masaka",
  "fort-portal-city",
  "lira",
  "hoima",
  "kasese",
  "soroti",
  "tororo-city",
  "mubende",
  "kabale",
  "moroto",
  "kalangala",
] as const;

const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_CURRENT ?? 600);

export type PrefetchStatus = "cached" | "refreshed" | "not_found" | "error";

export interface PrefetchResult {
  slug: string;
  status: PrefetchStatus;
  error?: string;
}

async function prefetchOne(slug: string): Promise<PrefetchResult> {
  const district = getDistrictBySlug(slug);
  if (!district) {
    return { slug, status: "not_found" };
  }

  const cacheKey = weatherBundleCacheKey(district.slug);

  try {
    let fetcherRan = false;
    const { stale } = await getCached(cacheKey, CACHE_TTL_SECONDS, async () => {
      fetcherRan = true;
      return getWeatherBundleForDistrict(district);
    });

    return {
      slug,
      status: fetcherRan || stale ? "refreshed" : "cached",
    };
  } catch (error) {
    return {
      slug,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  const step = Math.max(1, Math.floor(concurrency));

  for (let index = 0; index < items.length; index += step) {
    const batch = items.slice(index, index + step);
    const batchResults = await Promise.all(batch.map(worker));
    results.push(...batchResults);
  }

  return results;
}

export async function prefetchDistrictWeather(slugs: string[], concurrency = 3) {
  const unique = [...new Set(slugs.map((slug) => slug.trim().toLowerCase()).filter(Boolean))];
  const results = await runWithConcurrency(unique, concurrency, prefetchOne);

  return {
    requested: unique.length,
    cached: results.filter((result) => result.status === "cached").length,
    refreshed: results.filter((result) => result.status === "refreshed").length,
    errors: results.filter((result) => result.status === "error"),
    notFound: results.filter((result) => result.status === "not_found"),
    results,
  };
}

export function prefetchSlugsForMode(mode: "priority" | "all", offset = 0, limit = 50) {
  if (mode === "priority") {
    return [...PREFETCH_PRIORITY_SLUGS];
  }

  const safeOffset = Math.max(0, Math.floor(offset));
  const safeLimit = Math.max(1, Math.floor(limit));
  return getAllDistricts()
    .map((district) => district.slug)
    .slice(safeOffset, safeOffset + safeLimit);
}
