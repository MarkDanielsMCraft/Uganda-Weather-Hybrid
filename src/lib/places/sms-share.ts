import { isSavedForecastAppNote } from "@/lib/ai/saved-forecast-notes";
import type { SupportedLocale } from "@/lib/i18n/types";
import { formatConditionLg } from "@/lib/weather/copy-lg";
import { buildCommunitySafetyAlerts } from "@/lib/weather/community-safety";
import type { WeatherBundle } from "@/types/weather";

/** The basic SMS alphabet (GSM 03.38). One character outside it, such as the
    degree sign or the Luganda letter "ŋ", switches the whole message to an
    encoding that fits only 70 characters per paid SMS instead of 160. */
const GSM_BASIC_CHARACTERS = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà",
);

const SMS_REPLACEMENTS: ReadonlyArray<[RegExp, string]> = [
  [/°\s*C\b/g, "C"],
  [/°/g, ""],
  [/[‘’ʼ`]/g, "'"],
  [/[“”]/g, '"'],
  [/[–—]/g, ", "],
  [/…/g, "."],
  // Luganda orthography writes the velar nasal as ng' when the letter ŋ is
  // not available (ng'aali, not ngaali), so meaning is kept.
  [/ŋ/g, "ng'"],
  [/Ŋ/g, "Ng'"],
  [/ /g, " "],
];

/** One SMS holds 160 basic characters. A longer message is split into parts
    of 153 characters each, and the sender pays for every part. */
const ONE_SMS_CHARACTERS = 160;
const TWO_SMS_CHARACTERS = 306;

export function toSmsSafeText(text: string): string {
  let safe = text;
  for (const [pattern, replacement] of SMS_REPLACEMENTS) {
    safe = safe.replace(pattern, replacement);
  }
  return [...safe]
    .filter((character) => GSM_BASIC_CHARACTERS.has(character))
    .join("")
    .replace(/[ \t]+/g, " ")
    .replace(/ ([,.])/g, "$1")
    .trim();
}

/** Shortens text to fit the limit, ending on a full sentence when possible so
    the reader never gets half a safety instruction. */
function fitToLength(text: string, limit: number): string {
  if (text.length <= limit) return text;
  const window = text.slice(0, limit);
  const lastSentenceEnd = Math.max(window.lastIndexOf(". "), window.lastIndexOf("? "));
  if (lastSentenceEnd > limit / 3) return window.slice(0, lastSentenceEnd + 1);
  const lastSpace = window.lastIndexOf(" ");
  return (lastSpace > 0 ? window.slice(0, lastSpace) : window).replace(/[,;:]$/, "");
}

/**
 * Formats a one SMS plain text weather summary (no emojis, no special
 * characters, no links) so a smartphone user can forward the forecast to
 * neighbours on basic phones at the lowest SMS cost.
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
  const condition = isLg ? formatConditionLg(weather.condition.text) : weather.condition.text;
  const safetyAlerts = buildCommunitySafetyAlerts(weather, language);
  const topNote = customNote?.trim() || safetyAlerts[0]?.title || "";

  const base = isLg
    ? `Uganda Weather ${district}: ${temp}C, ${condition}, Enkuba ${rain}%, Empewo ${wind} km/h.`
    : `Uganda Weather ${district}: ${temp}C, ${condition}, Rain ${rain}%, Wind ${wind} km/h.`;
  const safeBase = toSmsSafeText(base);
  if (!topNote) return safeBase;

  const withNote = toSmsSafeText(`${base} ${topNote}.`);
  return withNote.length <= ONE_SMS_CHARACTERS ? withNote : safeBase;
}

/**
 * Formats an advisor reply for SMS: in app notes removed, plain characters
 * only, and at most two SMS parts, ending on a full sentence.
 */
export function buildPlainTextAdvisorSms(districtName: string, replyText: string): string {
  const shareable = replyText
    .split(/\n\s*\n/)
    .filter((paragraph) => paragraph.trim() && !isSavedForecastAppNote(paragraph))
    .join(" ");
  const cleaned = shareable
    .replace(/\s+/g, " ")
    .replace(/[*_`#]/g, "")
    .trim();
  return fitToLength(toSmsSafeText(`Uganda Weather (${districtName}): ${cleaned}`), TWO_SMS_CHARACTERS);
}

/** "sms:?&body=" opens the messages app with the text filled in on both
    Android and iPhone; "sms:?body=" is ignored by some iPhone versions. */
export function buildSmsHref(message: string): string {
  return `sms:?&body=${encodeURIComponent(message)}`;
}

export function buildWhatsAppHref(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
