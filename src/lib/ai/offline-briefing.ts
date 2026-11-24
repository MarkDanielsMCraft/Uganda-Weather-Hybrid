import type { AdvisorAudience } from "@/lib/ai/advisor-prompt";
import { verdictFromRainAndWind, type SafetyVerdict, type SafetyVerdictLevel } from "@/lib/ai/advisor-tools";
import {
  AI_UNAVAILABLE_NOTICE_EN,
  AI_UNAVAILABLE_NOTICE_LG,
  OFFLINE_NOTICE_EN,
  OFFLINE_NOTICE_LG,
} from "@/lib/ai/saved-forecast-notes";
import { hoursAheadSummary } from "@/lib/design/context";
import type { SupportedLocale } from "@/lib/i18n/types";
import { formatClockLabelForLanguage, formatUgandaClock } from "@/lib/time/uganda";
import { formatMarineSafetyLg, hoursAheadSummaryLg } from "@/lib/weather/copy-lg";
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
  peakChance: number;
  peakLabel: string | null;
  verdictChance: number;
}

function readUpcomingRain(weather: WeatherBundle): UpcomingRain {
  const hours = weather.hourly
    .filter((point) => point.kind === "hour" && typeof point.rainChance === "number")
    .slice(0, LOOKAHEAD_HOURS);

  if (hours.length === 0) {
    const chance = weather.precipitation.chance;
    return { peakChance: chance, peakLabel: null, verdictChance: chance };
  }

  let peak = hours[0];
  for (const point of hours) {
    if ((point.rainChance ?? 0) > (peak.rainChance ?? 0)) peak = point;
  }
  const verdictChance = Math.max(
    ...hours.slice(0, VERDICT_WINDOW_HOURS).map((point) => point.rainChance ?? 0),
  );
  return { peakChance: peak.rainChance ?? 0, peakLabel: peak.label, verdictChance };
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

/** Fisher advice reuses the reviewed Luganda lake safety copy. The landslide
    and storm lines reuse reviewed alert copy from the Luganda dictionary. */
const ADVICE_LG: Record<AdvisorAudience, Record<SafetyVerdictLevel, string>> = {
  farmer: {
    wait: "Toyanika birime wabweru kati.",
    caution: "Beera mwegendereza era kebera eggulu buli kaseera.",
    go: "Obudde bulungi okwanika ebirime n'okukola mu nnimiro.",
  },
  fisher: {
    wait: formatMarineSafetyLg({ label: "Danger", summary: "" }).summary,
    caution: formatMarineSafetyLg({ label: "Caution", summary: "" }).summary,
    go: formatMarineSafetyLg({ label: "Safe", summary: "" }).summary,
  },
  mountain_park: {
    wait: "Ebisenge by'ensozi ebyewunzise biyinza okutenguka oluvannyuma lw'enkuba etonnya ennyo.",
    caution: "Beera mwegendereza era kebera eggulu buli kaseera.",
    go: "Obudde bulungi okutambula.",
  },
  general: {
    wait: "Noonya ekifo ekikuumibwa era weewale okubeera mu bbanga.",
    caution: "Beera mwegendereza era kebera eggulu buli kaseera.",
    go: "Obudde bulungi.",
  },
};

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
): string {
  const wind = Math.round(weather.wind.speedKph);
  const gust = Math.round(weather.wind.gustKph);
  const updated = formatUpdatedAt(weather, "en");
  const lines: string[] = [];

  if (notice !== "none") {
    lines.push(NOTICE_TEXT.en[notice]);
  }
  lines.push(hoursAheadSummary(weather));
  const peakWhen = !rain.peakLabel
    ? null
    : isNowLabel(rain.peakLabel)
      ? "right now"
      : `at ${rain.peakLabel}`;
  lines.push(
    peakWhen
      ? `Highest chance of rain in the next ${LOOKAHEAD_HOURS} hours: ${rain.peakChance}% ${peakWhen}. Wind ${wind} km/h, gusts up to ${gust} km/h.`
      : `Chance of rain today: ${rain.peakChance}%. Wind ${wind} km/h, gusts up to ${gust} km/h.`,
  );
  lines.push(ADVICE_EN[audience][verdict.level]);
  for (const alert of weather.alerts.slice(0, 2)) {
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
): string {
  const wind = Math.round(weather.wind.speedKph);
  const lines: string[] = [];

  if (notice !== "none") {
    lines.push(NOTICE_TEXT.lg[notice]);
  }
  lines.push(hoursAheadSummaryLg(weather));
  const peakWhen = !rain.peakLabel
    ? null
    : isNowLabel(rain.peakLabel)
      ? "kati"
      : `ku ${formatClockLabelForLanguage(rain.peakLabel, "lg", "medium")}`;
  lines.push(
    peakWhen
      ? `Omukisa gw'enkuba ${rain.peakChance}% ${peakWhen}. Empewo ya km/h ${wind}.`
      : `Omukisa gw'enkuba ${rain.peakChance}%. Empewo ya km/h ${wind}.`,
  );
  lines.push(ADVICE_LG[audience][verdict.level]);
  lines.push(
    `${weather.district.name}: obubaka buno buva ku budde obuterekeddwa ku ssimu yo, tebukozesezza AI.`,
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
}: {
  weather: WeatherBundle;
  audience: AdvisorAudience;
  language: SupportedLocale;
  notice?: SavedForecastNotice;
}): SavedForecastBriefing {
  const rain = readUpcomingRain(weather);
  const verdict = verdictFromRainAndWind(rain.verdictChance, weather.wind.speedKph);
  const text =
    language === "lg"
      ? buildLuganda(weather, audience, rain, verdict, notice)
      : buildEnglish(weather, audience, rain, verdict, notice);
  return { text, verdict };
}
