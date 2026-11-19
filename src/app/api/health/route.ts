import { getAllDistricts } from "@/lib/districts";
import { getRedisClient } from "@/lib/cache/redis";
import { countPushTokens } from "@/lib/push/store";
import packageJson from "../../../../package.json";

export const dynamic = "force-dynamic";

export async function GET() {
  const districts = getAllDistricts();
  const pushTokens = await countPushTokens();

  return Response.json({
    status: "ok",
    version: packageJson.version,
    timestamp: new Date().toISOString(),
    districts: districts.length,
    providers: {
      weatherapi: Boolean(process.env.WEATHERAPI_KEY),
      openMeteo: true,
      pirateWeather: Boolean(process.env.PIRATE_WEATHER_API_KEY),
      openWeatherMap: Boolean(process.env.OPENWEATHERMAP_API_KEY),
      visualCrossing: Boolean(process.env.VISUAL_CROSSING_API_KEY),
      mapTiler: Boolean(process.env.NEXT_PUBLIC_MAPTILER_API_KEY),
      stadiaMaps: Boolean(process.env.NEXT_PUBLIC_STADIA_MAPS_API_KEY),
      rainViewer: true,
      unmaCap: process.env.UNMA_ALERTS_URL ? "custom" : "ug-dms-en",
      pushRegister: true,
      pushDispatch: Boolean(process.env.PUSH_DISPATCH_SECRET) || process.env.NODE_ENV === "development",
      pushDispatchLive: process.env.PUSH_DISPATCH_LIVE === "1",
      prefetchCron: Boolean(process.env.CRON_SECRET) || process.env.NODE_ENV === "development",
      prefetchJobs: ["weather", "alerts", "agriculture", "air-quality"],
      redis: getRedisClient(),
      pushTokens,
    },
  });
}
