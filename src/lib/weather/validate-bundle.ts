import type { HourlyPoint, WeatherBundle } from "@/types/weather";

export function validateHourlyPoints(hourly: HourlyPoint[]) {
  const hours = hourly.filter((point) => point.kind === "hour");
  if (hours.length < 8) {
    throw new Error(`expected at least 8 hourly points, got ${hours.length}`);
  }

  for (const [index, hour] of hours.entries()) {
    if (!Number.isFinite(hour.temp)) {
      throw new Error(`hourly[${index}] missing temperature`);
    }
    if (!hour.label?.trim()) {
      throw new Error(`hourly[${index}] missing label`);
    }
    if (!hour.icon && !hour.theme) {
      throw new Error(`hourly[${index}] missing icon and theme`);
    }
  }
}

export function validateWeatherBundle(bundle: WeatherBundle, expectedSlug?: string) {
  if (expectedSlug && bundle.district.slug !== expectedSlug) {
    throw new Error(
      `district slug mismatch: expected ${expectedSlug}, got ${bundle.district.slug}`,
    );
  }

  validateHourlyPoints(bundle.hourly);

  if (!Number.isFinite(bundle.temperature.celsius)) {
    throw new Error("missing current temperature");
  }

  if (!bundle.condition?.text?.trim()) {
    throw new Error("missing condition text");
  }
}
