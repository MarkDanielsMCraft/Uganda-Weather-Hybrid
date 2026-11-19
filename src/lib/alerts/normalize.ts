import { parseWeatherTimestamp } from "@/lib/time/uganda";
import type { AlertSeverity, WeatherAlert } from "@/types/weather";

const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  extreme: 0,
  warning: 1,
  watch: 2,
  advisory: 3,
};

export function mapAlertSeverity(value: string): AlertSeverity {
  const normalized = value.toLowerCase();
  if (normalized.includes("extreme")) return "extreme";
  if (normalized.includes("severe") || normalized.includes("warning")) return "warning";
  if (normalized.includes("watch")) return "watch";
  return "advisory";
}

export function parseAlertTime(value?: string) {
  if (!value) return null;
  const date = parseWeatherTimestamp(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function isAlertActive(alert: WeatherAlert, now = new Date()) {
  const expires = parseAlertTime(alert.expiresAt);
  if (!expires) return true;
  return expires.getTime() > now.getTime();
}

export function sortAlertsBySeverity(alerts: WeatherAlert[]) {
  return [...alerts].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime(),
  );
}

export function prepareAlerts(alerts: WeatherAlert[], now = new Date()) {
  const active = alerts.filter((alert) => isAlertActive(alert, now));
  const seen = new Set<string>();
  const unique = active.filter((alert) => {
    const key = `${alert.title}:${alert.issuedAt}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return sortAlertsBySeverity(unique);
}

interface WeatherApiAlertRaw {
  headline?: string;
  severity?: string;
  areas?: string;
  desc?: string;
  effective?: string;
  expires?: string;
}

export function normalizeWeatherApiAlerts(
  districtSlug: string,
  raw: WeatherApiAlertRaw | WeatherApiAlertRaw[] | undefined,
): WeatherAlert[] {
  if (!raw) return [];

  const items = Array.isArray(raw) ? raw : [raw];

  return items.map((alert, index) => ({
    id: `${districtSlug}-weatherapi-${index}-${alert.effective ?? index}`,
    title: alert.headline?.trim() || "Weather Alert",
    description: alert.desc?.trim() || alert.areas?.trim() || "Monitor local conditions.",
    severity: mapAlertSeverity(alert.severity ?? "advisory"),
    source: "WeatherAPI",
    issuedAt: alert.effective ?? new Date().toISOString(),
    expiresAt: alert.expires,
  }));
}
