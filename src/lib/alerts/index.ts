import type { District, WeatherAlert } from "@/types/weather";
import { prepareAlerts } from "./normalize";
import { fetchUnmaAlerts } from "./unma";

export function mergeAlertSources(...groups: WeatherAlert[][]) {
  return prepareAlerts(groups.flat());
}

export async function getAlertsForDistrict(
  district: District,
  providerAlerts: WeatherAlert[] = [],
) {
  const unmaAlerts = await fetchUnmaAlerts(district);
  return mergeAlertSources(unmaAlerts, providerAlerts);
}

export {
  prepareAlerts,
  isAlertActive,
  sortAlertsBySeverity,
  normalizeWeatherApiAlerts,
} from "./normalize";

export { DEFAULT_UNMA_CAP_FEED, parseCapRssFeed } from "./cap";
