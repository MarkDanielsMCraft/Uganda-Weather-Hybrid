import type { AdvisorAudience } from "@/lib/ai/advisor-prompt";
import { verdictFromRainAndWind, type SafetyVerdict, type SafetyVerdictLevel } from "@/lib/ai/advisor-tools";
import {
  AI_UNAVAILABLE_NOTICE_EN,
  AI_UNAVAILABLE_NOTICE_LG,
  OFFLINE_NOTICE_EN,
  OFFLINE_NOTICE_LG,
} from "@/lib/ai/saved-forecast-notes";
import { hoursAheadSummary } from "@/lib/design/context";
import { lg as lgDict } from "@/lib/i18n/dictionaries/lg";
import type { SupportedLocale } from "@/lib/i18n/types";
import { formatClockLabelForLanguage, formatUgandaClock } from "@/lib/time/uganda";
import {
  formatMarineSafetyLg,
  hoursAheadSummaryLg,
  localizeAlertForLanguage,
} from "@/lib/weather/copy-lg";
import type { WeatherBundle } from "@/types/weather";

/** How many upcoming hours the offline summary looks at. Matches the 12 hour
    window the home screen summary already uses, so both screens agree. */
const LOOKAHEAD_HOURS = 12;
/** The verdict covers the next few hours, not the whole day, because a
    farmer or fisher decides what to do now, not at midnight. */
const VERDICT_WINDOW_HOURS = 6;

/** Why the summary is shown instead of an AI answer. "none" adds no notice
    (a quick question offline), "offline" explains there is no internet, and
    "ai_unavailable" explains the cloud model could not answer just now. */
export type SavedForecastNotice = "none" | "offline" | "ai_unavailable";

const NOTICE_TEXT: Record<"en" | "lg", Record<Exclude<SavedForecastNotice, "none">, string>> = {
  en: { offline: OFFLINE_NOTICE_EN, ai_unavailable: AI_UNAVAILABLE_NOTICE_EN },
  lg: { offline: OFFLINE_NOTICE_LG, ai_unavailable: AI_UNAVAILABLE_NOTICE_LG },
};

export interface SavedForecastBriefing {
  text: string;
  verdict: SafetyVerdict;
}

interface UpcomingRain {
  /** Null when the forecast has no usable rain chance at all. */
  peakChance: number | null;
  peakLabel: string | null;
  verdictChance: number;
}

/** A provider can send a broken or impossible number. Rain chances are kept
    only when they are real numbers, and clamped to 0 to 100. */
function cleanPercent(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** Wind in km/h, or null when the number is broken. */
function cleanSpeed(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.round(value));
}

function readUpcomingRain(weather: WeatherBundle): UpcomingRain {
  const hours = (weather.hourly ?? [])
    .filter((point) => point.kind === "hour")
    .map((point) => ({ label: point.label, chance: cleanPercent(point.rainChance) }))
    .filter((point): point is { label: string; chance: number } => point.chance !== null)
    .slice(0, LOOKAHEAD_HOURS);

  if (hours.length === 0) {
    const chance = cleanPercent(weather.precipitation?.chance);
    return { peakChance: chance, peakLabel: null, verdictChance: chance ?? 0 };
  }

  let peak = hours[0];
  for (const point of hours) {
    if (point.chance > peak.chance) peak = point;
  }
  const verdictChance = Math.max(...hours.slice(0, VERDICT_WINDOW_HOURS).map((point) => point.chance));
  return { peakChance: peak.chance, peakLabel: peak.label, verdictChance };
}

const ADVICE_EN: Record<AdvisorAudience, Record<SafetyVerdictLevel, string>> = {
  farmer: {
    wait: "Do not dry crops outside now. Keep harvested crops covered or indoors, and do not spray.",
    caution: "Dry crops only where you can cover them quickly, and check the sky often.",
    go: "Conditions look good for drying crops and field work.",
  },
  fisher: {
    wait: "Small boats should stay on shore for now.",
    caution: "Stay close to the shore, wear a life jacket, and come back early if the wind gets stronger.",
    go: "The lake looks calm. Still wear a life jacket and tell someone your plans.",
  },
  mountain_park: {
    wait: "Delay walks on steep slopes and avoid crossing rivers.",
    caution: "Start early, carry rain gear, and turn back if heavy rain starts.",
    go: "Good conditions for walking. Carry water and protect yourself from the sun.",
  },
  general: {
    wait: "Stay indoors during the wettest hours if you can, and avoid flooded roads.",
    caution: "Carry rain gear and allow extra travel time.",
    go: "No major weather problems are expected.",
  },
};

/** Fisher advice reuses the reviewed Luganda lake safety copy. Other audience
    lines match English 1-to-1 in practical safety detail. */
const ADVICE_LG: Record<AdvisorAudience, Record<SafetyVerdictLevel, string>> = {
  farmer: {
    wait: "Toyanika birime wabweru kati. Kuuma ebirime ebikungule nga bibikkiddwa oba mu nnyumba, era tofuuyira ddagala.",
    caution: "Yanika ebirime we osobola okubibikka amangu, era kebera eggulu buli kaseera.",
    go: "Obudde bulungi okwanika ebirime n'okukola mu nnimiro.",
  },
  fisher: {
    wait: formatMarineSafetyLg({ label: "Danger", summary: "" }).summary,
    caution: formatMarineSafetyLg({ label: "Caution", summary: "" }).summary,
    go: formatMarineSafetyLg({ label: "Safe", summary: "" }).summary,
  },
  mountain_park: {
    wait: "Lindako okutambula ku bisenge by'ensozi ebyewunzise era weewale okusomoka emigga.",
    caution: "Simbula bukyali, tambula n'ebikukuuma ku nkuba, era ddayo emabega ng'enkuba ey'amaanyi etandise.",
    go: "Obudde bulungi okutambula. Tambula n'amazzi ag'okunywa era weewale omusana omungi.",
  },
  general: {
    wait: "Sigala mu nnyumba mu ssaawa ezisingamu enkuba bw'oba osobola, era weewale enguudo ezijjudde amazzi.",
    caution: "Tambula n'ebikukuuma ku nkuba era weekwate obudde obumala mu lugendo.",
    go: "Tewali buzibu bwa maanyi ku mbeera y'obudde busuubirwa.",
  },
};

function selectAudienceAdvice(
  weather: WeatherBundle,
  audience: AdvisorAudience,
  level: SafetyVerdictLevel,
  language: "en" | "lg",
): string {
  if (audience === "farmer" && level === "go" && weather.isDay === false) {
    return language === "lg"
      ? "Obudde bw'ekiro buteefu. Kuuma ebirime ebikungule mu nnyumba okwewala omusulo gw'ekiro, era tegeka okwanika oba okulima enkya ku makya."
      : "Skies are calm tonight. Keep harvested crops covered indoors away from night moisture, and plan drying or field work for tomorrow morning.";
  }
  return language === "lg" ? ADVICE_LG[audience][level] : ADVICE_EN[audience][level];
}

function formatUpdatedAt(weather: WeatherBundle, language: SupportedLocale): string | null {
  const parsed = new Date(weather.updatedAt);
  if (Number.isNaN(parsed.getTime())) return null;
  return formatUgandaClock(parsed, false, language);
}

function buildEnglish(
  weather: WeatherBundle,
  audience: AdvisorAudience,
  rain: UpcomingRain,
  verdict: SafetyVerdict,
  notice: SavedForecastNotice,
  spellingCorrection?: { typed: string; resolvedName: string },
): string {
  const wind = cleanSpeed(weather.wind?.speedKph);
  const gust = cleanSpeed(weather.wind?.gustKph);
  const updated = formatUpdatedAt(weather, "en");
  const lines: string[] = [];

  if (spellingCorrection) {
    lines.push(
      `Did you mean ${spellingCorrection.resolvedName}? Showing the forecast for ${spellingCorrection.resolvedName}.`,
    );
  }
  if (notice !== "none") {
    lines.push(NOTICE_TEXT.en[notice]);
  }
  lines.push(hoursAheadSummary(weather));
  const peakWhen = !rain.peakLabel
    ? null
    : isNowLabel(rain.peakLabel)
      ? "right now"
      : `at ${rain.peakLabel}`;
  const rainSentence =
    rain.peakChance === null
      ? "The saved forecast has no rain chance for the coming hours."
      : peakWhen
        ? `The highest chance of rain in the next ${LOOKAHEAD_HOURS} hours is ${rain.peakChance}% ${peakWhen}.`
        : `The chance of rain today is ${rain.peakChance}%.`;
  const windSentence =
    wind === null ? "" : gust === null ? ` Wind ${wind} km/h.` : ` Wind ${wind} km/h, gusts up to ${gust} km/h.`;
  lines.push(rainSentence + windSentence);
  lines.push(selectAudienceAdvice(weather, audience, verdict.level, "en"));
  for (const alert of (weather.alerts ?? []).slice(0, 2)) {
    lines.push(`Active warning: ${alert.title}.`);
  }
  lines.push(
    updated
      ? `Saved forecast for ${weather.district.name}, last updated ${updated}. Made from the saved numbers only, without AI.`
      : `Saved forecast for ${weather.district.name}. Made from the saved numbers only, without AI.`,
  );
  return lines.join("\n\n");
}

function buildLuganda(
  weather: WeatherBundle,
  audience: AdvisorAudience,
  rain: UpcomingRain,
  verdict: SafetyVerdict,
  notice: SavedForecastNotice,
  spellingCorrection?: { typed: string; resolvedName: string },
): string {
  const wind = cleanSpeed(weather.wind?.speedKph);
  const gust = cleanSpeed(weather.wind?.gustKph);
  const updated = formatUpdatedAt(weather, "lg");
  const lines: string[] = [];

  if (spellingCorrection) {
    lines.push(
      `Obadde otegeeza ${spellingCorrection.resolvedName}? Buno bwe bufunze bw'obudde bw'e ${spellingCorrection.resolvedName}.`,
    );
  }
  if (notice !== "none") {
    lines.push(NOTICE_TEXT.lg[notice]);
  }
  lines.push(hoursAheadSummaryLg(weather));
  const peakWhen = !rain.peakLabel
    ? null
    : isNowLabel(rain.peakLabel)
      ? "kati"
      : `ku ssaawa ${formatClockLabelForLanguage(rain.peakLabel, "lg", "medium")}`;
  const rainSentence =
    rain.peakChance === null
      ? "Obudde obwaterekebwa tebulaga mukisa gwa nkuba mu ssaawa eziddako."
      : peakWhen
        ? `Omukisa gw'enkuba ${rain.peakChance}% gwe gusinga mu ssaawa ${LOOKAHEAD_HOURS} eziddako, ${peakWhen}.`
        : `Omukisa gw'enkuba ${rain.peakChance}% leero.`;
  const windSentence =
    wind === null
      ? ""
      : gust === null
        ? ` Empewo eri km/h ${wind}.`
        : ` Empewo eri km/h ${wind}, ng'etuuka ku km/h ${gust} mu kibuyaga.`;
  lines.push(rainSentence + windSentence);
  lines.push(selectAudienceAdvice(weather, audience, verdict.level, "lg"));
  for (const alert of (weather.alerts ?? []).slice(0, 2)) {
    const localized = localizeAlertForLanguage(alert, "lg", lgDict.alerts.demo);
    lines.push(`Okulabula okuliwo: ${localized.title}.`);
  }
  lines.push(
    updated
      ? `${weather.district.name}, byazziddwa obuggya ku ssaawa ${updated}: obubaka buno buva ku budde obuterekeddwa ku ssimu yo, tebukozesezza AI.`
      : `${weather.district.name}: obubaka buno buva ku budde obuterekeddwa ku ssimu yo, tebukozesezza AI.`,
  );
  return lines.join("\n\n");
}

function isNowLabel(label: string): boolean {
  return label.trim().toLowerCase() === "now";
}

/** Builds a plain safety summary straight from the saved forecast numbers.
    Used when the phone is offline and has no on-device model, which is the
    normal case on the entry level Android phones most Ugandans use. It never
    adds facts that are not in the saved forecast. */
export function buildSavedForecastBriefing({
  weather,
  audience,
  language,
  notice = "none",
  spellingCorrection,
}: {
  weather: WeatherBundle;
  audience: AdvisorAudience;
  language: SupportedLocale;
  notice?: SavedForecastNotice;
  spellingCorrection?: { typed: string; resolvedName: string };
}): SavedForecastBriefing {
  const rain = readUpcomingRain(weather);
  const verdict = verdictFromRainAndWind(rain.verdictChance, cleanSpeed(weather.wind?.speedKph) ?? 0);
  const text =
    language === "lg"
      ? buildLuganda(weather, audience, rain, verdict, notice, spellingCorrection)
      : buildEnglish(weather, audience, rain, verdict, notice, spellingCorrection);
  return { text, verdict };
}
