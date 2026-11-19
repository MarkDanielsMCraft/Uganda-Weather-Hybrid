import { getDistrictBySlug } from "@/lib/districts";
import { getCached } from "@/lib/cache";
import { getAlertsForDistrict } from "@/lib/alerts";
import { alertsPath } from "@/lib/native/deep-links";
import { dispatchStormAlert } from "@/lib/push/dispatch";
import { listDistrictSlugsWithPushTokens } from "@/lib/push/store";
import { getRedisClient, redisGetJson, redisSet } from "@/lib/cache/redis";
import { getWeatherBundleForDistrict } from "@/lib/weather/provider";
import { weatherBundleCacheKey } from "@/lib/weather/resolve-target";
import { getDictionary, localizeDistrictName } from "@/lib/i18n";
import { localizeAlertForLanguage } from "@/lib/weather/copy-lg";
import type { WeatherAlert } from "@/types/weather";

const BUNDLE_TTL_SECONDS = Number(process.env.CACHE_TTL_CURRENT ?? 600);
const DISPATCH_MARKER_TTL_SECONDS = 24 * 60 * 60;

const DISPATCH_SEVERITIES = new Set<WeatherAlert["severity"]>(["extreme", "warning"]);

const memoryDispatchMarkers = new Set<string>();

function dispatchMarkerKey(districtSlug: string, alertId: string) {
  return `uw:push:sent:${districtSlug}:${alertId}`;
}

async function markAlertDispatched(districtSlug: string, alertId: string) {
  const key = dispatchMarkerKey(districtSlug, alertId);
  memoryDispatchMarkers.add(key);
  await redisSet(key, "1", DISPATCH_MARKER_TTL_SECONDS);
}

/**
 * Same cross-instance problem as the district index: the in-memory Set
 * only knows about dispatches this instance has made. Without checking
 * Redis too, a fresh serverless instance has no memory of what already
 * went out and would happily re-send the same storm alert.
 */
async function wasAlertDispatched(districtSlug: string, alertId: string) {
  const key = dispatchMarkerKey(districtSlug, alertId);
  if (memoryDispatchMarkers.has(key)) return true;
  if (!getRedisClient()) return false;

  try {
    return (await redisGetJson<unknown>(key)) !== null;
  } catch (error) {
    console.error("Dispatch marker Redis read failed:", error);
    return false;
  }
}

export async function dispatchPendingSevereAlerts(options?: { dryRun?: boolean }) {
  const districtSlugs = await listDistrictSlugsWithPushTokens();
  const dispatched: Array<{
    districtSlug: string;
    alertId: string;
    title: string;
    targeted: number;
    dryRun: boolean;
  }> = [];

  for (const districtSlug of districtSlugs) {
    const district = getDistrictBySlug(districtSlug);
    if (!district) continue;

    // One district's weather being unavailable must not cost every district
    // after it its severe weather push. The provider throws rather than
    // inventing numbers when every upstream is down, so the failure is
    // contained here and the loop moves on.
    let bundle;
    try {
      ({ data: bundle } = await getCached(
        weatherBundleCacheKey(district.slug),
        BUNDLE_TTL_SECONDS,
        () => getWeatherBundleForDistrict(district),
      ));
    } catch (error) {
      console.error(`Alert dispatch skipped ${district.slug}:`, error);
      continue;
    }

    const alerts = await getAlertsForDistrict(district, bundle.alerts);
    const severeAlerts = alerts.filter((alert) => DISPATCH_SEVERITIES.has(alert.severity));

    const lgDict = getDictionary("lg");
    const lgDistrictName = localizeDistrictName(district.name, lgDict);

    for (const alert of severeAlerts) {
      if (await wasAlertDispatched(district.slug, alert.id)) continue;

      const lgAlert = localizeAlertForLanguage(alert, "lg", lgDict.alerts.demo);
      const lgTitle =
        lgAlert.title !== alert.title
          ? lgAlert.title
          : `${lgDict.alerts.severeWeatherAlert}: ${lgDistrictName}`;
      const lgBody =
        lgAlert.description !== alert.description
          ? lgAlert.description.slice(0, 220)
          : `${lgDict.alerts.severityLabels[alert.severity] ?? lgDict.alerts.severeWeatherAlert}: ${alert.title}`.slice(
              0,
              220,
            );

      const result = await dispatchStormAlert(
        {
          districtSlug: district.slug,
          title: alert.title,
          body: alert.description.slice(0, 220),
          route: alertsPath(district.slug, alert.id),
          localized: {
            lg: {
              title: lgTitle,
              body: lgBody,
            },
          },
        },
        { dryRun: options?.dryRun },
      );

      if (result.targeted > 0) {
        if (!options?.dryRun && !result.dryRun) {
          await markAlertDispatched(district.slug, alert.id);
        }

        dispatched.push({
          districtSlug: district.slug,
          alertId: alert.id,
          title: alert.title,
          targeted: result.targeted,
          dryRun: result.dryRun,
        });
      }
    }
  }

  return {
    scannedDistricts: districtSlugs.length,
    dispatched,
  };
}
