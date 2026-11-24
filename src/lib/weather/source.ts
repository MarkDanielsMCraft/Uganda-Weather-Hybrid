import { getDictionary } from "@/lib/i18n/dictionary";
import type { SupportedLocale } from "@/lib/i18n/types";
import { formatUgandaDateTime } from "@/lib/time/uganda";
import type { WeatherBundle } from "@/types/weather";

export type WeatherSourceKind = "live" | "demo" | "fallback";

export type WeatherProvider =
  | "weatherapi"
  | "open-meteo"
  | "open-meteo-fallback"
  | "pirateweather"
  | "demo"
  | "demo-fallback";

export interface WeatherProviderInfo {
  provider: WeatherProvider;
  label: string;
  shortLabel: string;
  description: string;
  kind: WeatherSourceKind;
}

const PROVIDER_KINDS: Record<WeatherProvider, WeatherSourceKind> = {
  weatherapi: "live",
  "open-meteo": "live",
  "open-meteo-fallback": "live",
  pirateweather: "live",
  demo: "demo",
  "demo-fallback": "fallback",
};

export function getWeatherProvider(source: string): WeatherProvider {
  if (source === "weatherapi.com") return "weatherapi";
  if (source === "open-meteo.com/fallback") return "open-meteo-fallback";
  if (source.includes("open-meteo")) return "open-meteo";
  if (source.includes("pirateweather")) return "pirateweather";
  if (source === "demo-fallback") return "demo-fallback";
  return "demo";
}

export function getWeatherProviderInfo(
  source: string,
  language: SupportedLocale = "en",
): WeatherProviderInfo {
  const provider = getWeatherProvider(source);
  const entry = getDictionary(language).weatherStatus.providers[provider];
  return {
    provider,
    ...entry,
    kind: PROVIDER_KINDS[provider],
  };
}

export function getWeatherSourceKind(source: string): WeatherSourceKind {
  return PROVIDER_KINDS[getWeatherProvider(source)];
}

export function isLiveWeather(source: string) {
  return getWeatherSourceKind(source) === "live";
}

export function weatherSourceLabel(source: string, language: SupportedLocale = "en") {
  return getWeatherProviderInfo(source, language).label;
}

export function weatherProviderShortLabel(source: string, language: SupportedLocale = "en") {
  return getWeatherProviderInfo(source, language).shortLabel;
}

export function formatWeatherUpdatedAt(iso: string, language: SupportedLocale = "en") {
  return formatUgandaDateTime(
    iso,
    {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    },
    language,
  );
}

export function weatherStatusMessage(
  weather: WeatherBundle,
  metaStale = false,
  language: SupportedLocale = "en",
) {
  const dict = getDictionary(language).weatherStatus;
  const info = getWeatherProviderInfo(weather.source, language);

  if (metaStale || weather.stale) {
    return dict.staleMessage;
  }

  const updated = formatWeatherUpdatedAt(weather.updatedAt, language);
  if (updated) {
    return dict.updatedAtTemplate
      .replace("{description}", info.description)
      .replace("{time}", updated);
  }
  return info.description;
}
