import { getCached } from "@/lib/cache";
import { checkReachable } from "@/lib/health/connectivity";

export const dynamic = "force-dynamic";

interface ProviderCheck {
  key: string;
  url: string;
  configured: boolean;
}

function providersToCheck(): ProviderCheck[] {
  return [
    { key: "weatherapi", url: "https://api.weatherapi.com/", configured: Boolean(process.env.WEATHERAPI_KEY) },
    { key: "openMeteo", url: "https://api.open-meteo.com/", configured: true },
    { key: "pirateWeather", url: "https://api.pirateweather.net/", configured: Boolean(process.env.PIRATE_WEATHER_API_KEY) },
    { key: "openWeatherMap", url: "https://api.openweathermap.org/", configured: Boolean(process.env.OPENWEATHERMAP_API_KEY) },
    { key: "visualCrossing", url: "https://weather.visualcrossing.com/", configured: Boolean(process.env.VISUAL_CROSSING_API_KEY) },
    { key: "mapTiler", url: "https://api.maptiler.com/", configured: Boolean(process.env.NEXT_PUBLIC_MAPTILER_API_KEY) },
    { key: "stadiaMaps", url: "https://tiles.stadiamaps.com/", configured: Boolean(process.env.NEXT_PUBLIC_STADIA_MAPS_API_KEY) },
    { key: "rainViewer", url: "https://tilecache.rainviewer.com/", configured: true },
    { key: "unmaCap", url: process.env.UNMA_ALERTS_URL || "https://cap-sources.s3.amazonaws.com/ug-dms-en/rss.xml", configured: true },
  ];
}

async function runChecks() {
  const providers = providersToCheck();
  const results = await Promise.all(
    providers.map(async (provider) => ({
      key: provider.key,
      configured: provider.configured,
      // Only probe network reachability for providers we'd actually call —
      // an unconfigured provider is never dialled by this app regardless
      // of whether its host happens to be up, so "reachable" would be a
      // misleading signal for it.
      reachable: provider.configured ? await checkReachable(provider.url) : false,
    })),
  );
  return { checkedAt: new Date().toISOString(), providers: results };
}

export async function GET() {
  // Short cache, not a "don't bother checking" cache — the sheet refetches
  // every time it opens (see SiteHealthContent), so this is only here to
  // stop rapid open/close/open clicking from re-probing every provider's
  // host multiple times a second. 10s is well under human-perceptible
  // "real time" for a status check, while still being real protection
  // against accidental hammering.
  const { data, stale } = await getCached("site-health:connectivity", 10, runChecks);
  return Response.json({ ...data, stale });
}
