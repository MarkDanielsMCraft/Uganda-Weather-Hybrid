import { getCached, createMeta, jsonResponse } from "@/lib/cache";
import { enforceRateLimit, mergeRateLimitHeaders } from "@/lib/api/route-utils";
import { getMajorLocations } from "@/lib/districts";
import { getWeatherBundleForDistrict } from "@/lib/weather/provider";
import { mapWithConcurrency } from "@/lib/weather/fan-out";
import type { District } from "@/types/weather";

const CHIPS_TTL_SECONDS = Number(process.env.CACHE_TTL_CURRENT ?? 600);

interface ChipWeather {
  slug: string;
  tempC: number;
  icon: string;
  theme: string;
}

async function weatherForChip(district: District): Promise<ChipWeather | null> {
  try {
    const { data: bundle } = await getCached(
      `weather:chip:v1:${district.slug}`,
      CHIPS_TTL_SECONDS,
      () => getWeatherBundleForDistrict(district, { fullForecast: false }),
    );
    return {
      slug: district.slug,
      tempC: Math.round(bundle.temperature.celsius),
      icon: bundle.condition.icon,
      theme: bundle.condition.theme,
    };
  } catch (error) {
    console.error(`Chip weather failed for ${district.slug}:`, error);
    return null;
  }
}

/** Powers the TopBar's district chip strip. Used to be one
    `/api/v1/weather/current` request per chip (~19 major locations), which
    alone consumed a third of the shared per-IP rate-limit budget on every
    page load. Batched into one cached call the same way parks/mountains
    already are. */
export async function GET(request: Request) {
  const rateLimit = enforceRateLimit(request);
  if (rateLimit instanceof Response) return rateLimit;

  const { data, stale } = await getCached("chips:major:v1", CHIPS_TTL_SECONDS, async () => {
    const results = await mapWithConcurrency(getMajorLocations(), weatherForChip);
    return results.filter((result): result is ChipWeather => result !== null);
  });

  const meta = createMeta(stale);
  return jsonResponse(
    { chips: data },
    meta,
    mergeRateLimitHeaders({ headers: { "X-Cache": stale ? "STALE" : "HIT" } }, rateLimit.headers),
  );
}
