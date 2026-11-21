import type { SupportedLocale } from "@/lib/i18n/types";
import { formatConditionLg } from "@/lib/weather/copy-lg";
import { buildCommunitySafetyAlerts } from "@/lib/weather/community-safety";
import type { WeatherBundle } from "@/types/weather";

/**
 * Formats a compact, 1-to-2 SMS plain-text weather summary (no emojis, no
 * dashes, zero URLs required) so a smartphone or KaiOS user can forward
 * forecasts and safety verdicts to neighbours on 2G button phones for free.
 */
export function buildPlainTextWeatherSms(
  weather: WeatherBundle,
  language: SupportedLocale = "en",
  customNote?: string,
): string {
  const isLg = language === "lg";
  const district = weather.district.name;
  const temp = Math.round(weather.temperature.celsius);
  const rain = Math.round(weather.precipitation.chance);
  const wind = Math.round(weather.wind.speedKph);
  const condition = isLg
    ? formatConditionLg(weather.condition.text)
    : weather.condition.text;
  const safetyAlerts = buildCommunitySafetyAlerts(weather, language);
  const topNote = customNote?.trim() || safetyAlerts[0]?.title || "";

  if (isLg) {
    const base = `Uganda Weather ${district}: ${temp}°C, ${condition}, Enkuba ${rain}%, Empewo ${wind} km/h.`;
    return topNote ? `${base} ${topNote}.` : base;
  }

  const base = `Uganda Weather ${district}: ${temp}°C, ${condition}, Rain ${rain}%, Wind ${wind} km/h.`;
  return topNote ? `${base} ${topNote}.` : base;
}

/**
 * Formats a compact plain-text AI Advisor verdict suitable for SMS or WhatsApp
 * forwarding to family or village neighbours on basic phones.
 */
export function buildPlainTextAdvisorSms(
  districtName: string,
  replyText: string,
): string {
  const cleaned = replyText
    .replace(/\s+/g, " ")
    .replace(/[*_`#]/g, "")
    .trim();
  return `Uganda Weather (${districtName}): ${cleaned}`;
}

export function buildSmsHref(message: string): string {
  return `sms:?body=${encodeURIComponent(message)}`;
}

export function buildWhatsAppHref(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
