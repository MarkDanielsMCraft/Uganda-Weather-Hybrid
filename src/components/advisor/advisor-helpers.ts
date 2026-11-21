import type {
  AdvisorAudience,
  BriefingInferenceSource,
  HybridRuntimeReadiness,
  ResolvedAdvisorLocation,
} from "@/lib/ai";
import type { SafetyVerdict } from "@/lib/ai/advisor-tools";
import type { SupportedLocale, TranslationDictionary } from "@/lib/i18n/types";
import { loadWeatherCache } from "@/lib/offline/weather-cache";
import { MOUNTAIN_PEAKS, NATIONAL_PARKS } from "@/lib/places/points-of-interest";
import type { WeatherBundle } from "@/types/weather";

export type AdvisorCopy = TranslationDictionary["hybridAdvisor"];

export interface QuickActionItem {
  key: string;
  audience: AdvisorAudience;
  prompt: string;
  tag: string;
}

export interface AdvisorMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  source?: BriefingInferenceSource;
  model?: string;
  usedCachedWeather?: boolean;
  streaming?: boolean;
  verdict?: SafetyVerdict;
  followUps?: string[];
  imagePreviewUrl?: string;
}

/**
 * Returns the rain chance for the current or immediate next upcoming hour so
 * the context strip and follow-up suggestions match current conditions rather
 * than an earlier daytime peak.
 */
export function getCurrentOrNextHourRainChance(weather: WeatherBundle): number {
  const hourly = Array.isArray(weather.hourly) ? weather.hourly : [];
  const nextHour = hourly.find(
    (point) => point.kind === "hour" && typeof point.rainChance === "number",
  );
  if (typeof nextHour?.rainChance === "number") {
    return Math.round(nextHour.rainChance);
  }
  return Math.round(weather.precipitation?.chance ?? 0);
}

/**
 * Resolves the follow-up chips to display below the latest assistant reply:
 * strictly uses the agent's own dynamic follow-up questions and filters out
 * any question the user has already asked in the current conversation.
 */
export function resolveDynamicFollowUps(
  messages: readonly AdvisorMessage[],
): string[] {
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant" && !m.streaming);
  if (!lastAssistant) return [];

  const askedLower = new Set(
    messages
      .filter((m) => m.role === "user")
      .map((m) => m.text.trim().toLowerCase()),
  );

  const agentFollowUps = (lastAssistant.followUps ?? []).filter(
    (q) => q.trim().length > 0 && !askedLower.has(q.trim().toLowerCase()),
  );
  return agentFollowUps.slice(0, 2);
}

/** Builds up to 4 geography-aware and time-of-day-aware quick prompts for the active Uganda location. */
export function getDistrictQuickActions(
  weather: WeatherBundle | null,
  copy: AdvisorCopy,
  uiLanguage: SupportedLocale = "en",
): QuickActionItem[] {
  const isLg = uiLanguage === "lg";
  if (!weather) {
    return [
      {
        key: "general",
        audience: "general",
        prompt: copy.quickQuestions.general,
        tag: copy.audiences.general,
      },
      {
        key: "farmer",
        audience: "farmer",
        prompt: copy.quickQuestions.farmer,
        tag: copy.audiences.farmer,
      },
    ];
  }

  const district = weather.district;
  const checkSlug = district.parentDistrictSlug ?? district.slug;
  const isLakeDistrict = Boolean(district.isLakeVictoriaZone || district.lakeZone);
  const hasMountainOrPark =
    NATIONAL_PARKS.some(
      (park) => park.parentDistrictSlug === checkSlug || park.key === district.slug,
    ) ||
    MOUNTAIN_PEAKS.some(
      (peak) => peak.parentDistrictSlug === checkSlug || peak.key === district.slug,
    ) ||
    district.hazards.some((hazard) => /landslide|mountain|cold/i.test(hazard));

  const farmerPrompt =
    weather.isDay === false
      ? isLg
        ? "Essaawa ki ennungi okulima oba okwanika enkya?"
        : "Best hours to farm or dry crops tomorrow?"
      : copy.quickQuestions.farmer;

  const actions: QuickActionItem[] = [
    {
      key: "farmer",
      audience: "farmer",
      prompt: farmerPrompt,
      tag: copy.audiences.farmer,
    },
  ];

  if (isLakeDistrict) {
    actions.push({
      key: "fisher",
      audience: "fisher",
      prompt: copy.quickQuestions.fisher,
      tag: copy.audiences.fisher,
    });
  }

  if (hasMountainOrPark) {
    actions.push({
      key: "mountain_park",
      audience: "mountain_park",
      prompt: copy.quickQuestions.mountain_park,
      tag: copy.audiences.mountain_park,
    });
  }

  actions.push({
    key: "general",
    audience: "general",
    prompt: copy.quickQuestions.general,
    tag: copy.audiences.general,
  });

  if (actions.length < 3) {
    const useTonightRisk =
      weather.isDay === false || getCurrentOrNextHourRainChance(weather) >= 35 || weather.precipitation.chance >= 50;
    actions.push({
      key: "tonight",
      audience: "general",
      prompt: useTonightRisk ? copy.followUps.tonightRisk : copy.followUps.bestHours,
      tag: useTonightRisk ? (isLg ? "Ekiro" : "Tonight") : (isLg ? "Essaawa" : "Hours"),
    });
  }

  return actions;
}

export function getStatusMeta(
  readiness: HybridRuntimeReadiness | "checking",
  isOnline: boolean,
  copy: AdvisorCopy,
): { label: string; textClass: string } {
  if (readiness === "checking") {
    return {
      label: copy.statusChecking,
      textClass: "text-white/60",
    };
  }
  if (readiness === "on_device_ready") {
    return {
      label: isOnline ? copy.statusOnDeviceReady : copy.statusOfflineOnDeviceReady,
      textClass: "text-[var(--color-brand-green)]",
    };
  }
  if (readiness === "cloud_ready") {
    return {
      label: copy.statusCloudReady,
      textClass: "text-white/80",
    };
  }
  if (readiness === "offline_unavailable") {
    return {
      label: copy.statusOfflineUnavailable,
      textClass: "text-white/65",
    };
  }
  return {
    label: copy.statusUnconfigured,
    textClass: "text-white/65",
  };
}

/** Fetches live weather for another Ugandan district or place mentioned in chat,
    falling back to the local cache when offline or unreachable. */
export async function fetchReferencedLocationWeather(
  target: ResolvedAdvisorLocation,
  isOnline: boolean,
  signal: AbortSignal,
): Promise<WeatherBundle | null> {
  if (!isOnline) {
    const cacheKey = target.kind === "district" ? target.slug : target.parentDistrictSlug;
    return loadWeatherCache(cacheKey)?.data ?? null;
  }

  try {
    const query =
      target.kind === "district"
        ? `district=${encodeURIComponent(target.slug)}`
        : new URLSearchParams({
            place: target.key,
            name: target.name,
            lat: String(target.lat),
            lon: String(target.lon),
            label: target.label,
            parent: target.parentDistrictSlug,
          }).toString();

    const response = await fetch(`/api/v1/weather/current?${query}`, { signal });
    if (!response.ok) return null;
    const payload = (await response.json()) as { data?: WeatherBundle };
    const bundle = payload?.data;
    if (
      !bundle?.district?.slug ||
      !bundle?.temperature ||
      !Array.isArray(bundle.hourly) ||
      !Array.isArray(bundle.dailyForecast)
    ) {
      return null;
    }
    return bundle;
  } catch {
    const cacheKey = target.kind === "district" ? target.slug : target.parentDistrictSlug;
    return loadWeatherCache(cacheKey)?.data ?? null;
  }
}
