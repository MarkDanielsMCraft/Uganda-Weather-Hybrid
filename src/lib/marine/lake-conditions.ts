import type { District, WeatherBundle } from "@/types/weather";

export type SafetyLevel = "safe" | "caution" | "danger";

export interface FishingSafety {
  level: SafetyLevel;
  label: string;
  summary: string;
}

export interface LakeConditions {
  zone: string;
  zoneLabel: string;
  referenceDistrict: string;
  waveHeightM: number;
  windSpeedKph: number;
  windDirection: string;
  waterTempC: number;
  visibilityKm: number;
  hasThunderstorm: boolean;
  fishingSafety: FishingSafety;
}

export interface LakeShoreZone {
  slug: string;
  label: string;
}

export interface LakeShoreDistrict {
  slug: string;
  label: string;
  zone: string;
}

export interface LakeConfig {
  key: string;
  name: string;
  zones: Record<string, LakeShoreZone>;
  shorelineDistricts: readonly LakeShoreDistrict[];
  zoneForDistrict: (district: District) => string;
}

export function waveHeightFromWind(windSpeedKph: number, gustKph: number): number {
  const estimate = 0.012 * windSpeedKph + 0.006 * gustKph;
  return Math.round(Math.min(2.8, Math.max(0.1, estimate)) * 10) / 10;
}

export function waterTempFromAir(airTempC: number): number {
  return Math.round(Math.max(22, Math.min(29, airTempC - 1.5)));
}

function safetyThresholds() {
  return {
    waveDanger: Number(process.env.SAFETY_WAVE_DANGER_M ?? 2.0),
    waveCaution: Number(process.env.SAFETY_WAVE_CAUTION_M ?? 1.2),
    windDanger: Number(process.env.SAFETY_WIND_DANGER_KPH ?? 40),
    windCaution: Number(process.env.SAFETY_WIND_CAUTION_KPH ?? 25),
  };
}

/** Lake-agnostic: the same wave/wind/visibility thresholds apply to every
    Ugandan lake this app covers. There's no evidence any of them needs a
    materially different safety threshold from the others. */
export function computeFishingSafety(weather: WeatherBundle): FishingSafety {
  const thresholds = safetyThresholds();
  const waveHeightM = waveHeightFromWind(weather.wind.speedKph, weather.wind.gustKph);
  const hasThunderstorm = weather.condition.theme === "thunder";
  const windSpeedKph = weather.wind.speedKph;
  const visibilityKm = weather.visibilityKm;

  if (
    hasThunderstorm ||
    waveHeightM > thresholds.waveDanger ||
    windSpeedKph > thresholds.windDanger
  ) {
    return {
      level: "danger",
      label: "Danger",
      summary: "Stay off the lake. Thunderstorms, high waves, or strong wind make boating unsafe.",
    };
  }

  if (
    waveHeightM > thresholds.waveCaution ||
    windSpeedKph > thresholds.windCaution ||
    visibilityKm < 2
  ) {
    return {
      level: "caution",
      label: "Caution",
      summary: "Moderate waves or wind. Experienced fishers only. Stay close to shore.",
    };
  }

  const upcomingHours = Array.isArray(weather.hourly)
    ? weather.hourly.filter((p) => p.kind === "hour").slice(0, 6)
    : [];
  const upcomingSquallHour = upcomingHours.find(
    (p) =>
      p.theme === "thunder" ||
      (typeof p.windSpeedKph === "number" && p.windSpeedKph > thresholds.windCaution) ||
      (typeof p.rainChance === "number" && p.rainChance >= 65),
  );
  if (upcomingSquallHour) {
    return {
      level: "caution",
      label: "Caution",
      summary: `Calm right now, but stronger wind or storm risk builds around ${upcomingSquallHour.label}. Plan return before then.`,
    };
  }

  return {
    level: "safe",
    label: "Safe",
    summary: "Calmer conditions for fishing and short crossings. Monitor the hourly outlook.",
  };
}

export function referenceLakeDistrictSlug(district: District, config: LakeConfig): string {
  const isShoreDistrict = config.shorelineDistricts.some((shore) => shore.slug === district.slug);
  if (isShoreDistrict) return district.slug;
  const zone = config.zoneForDistrict(district);
  return config.zones[zone]?.slug ?? config.shorelineDistricts[0].slug;
}

export function buildLakeConditions(weather: WeatherBundle, config: LakeConfig): LakeConditions {
  const zone = config.zoneForDistrict(weather.district);
  const zoneMeta = config.zones[zone] ?? Object.values(config.zones)[0];

  return {
    zone,
    zoneLabel: zoneMeta.label,
    referenceDistrict: weather.district.name,
    waveHeightM: waveHeightFromWind(weather.wind.speedKph, weather.wind.gustKph),
    windSpeedKph: weather.wind.speedKph,
    windDirection: weather.wind.direction,
    waterTempC: waterTempFromAir(weather.temperature.celsius),
    visibilityKm: weather.visibilityKm,
    hasThunderstorm: weather.condition.theme === "thunder",
    fishingSafety: computeFishingSafety(weather),
  };
}

// Kyoga, Albert, and Edward each get a single zone rather than Victoria's
// three-way central/eastern/western split — their real shoreline district
// lists are short and geographically clustered enough that further
// subdivision wouldn't mean anything.
export const KYOGA_CONFIG: LakeConfig = {
  key: "kyoga",
  name: "Lake Kyoga",
  zones: { kyoga: { slug: "amolatar", label: "Lake Kyoga" } },
  shorelineDistricts: [
    { slug: "amolatar", label: "Amolatar", zone: "kyoga" },
    { slug: "kayunga", label: "Kayunga", zone: "kyoga" },
  ],
  zoneForDistrict: () => "kyoga",
};

export const ALBERT_CONFIG: LakeConfig = {
  key: "albert",
  name: "Lake Albert",
  zones: { albert: { slug: "buliisa", label: "Lake Albert" } },
  shorelineDistricts: [
    { slug: "buliisa", label: "Buliisa", zone: "albert" },
    { slug: "ntoroko", label: "Ntoroko", zone: "albert" },
    { slug: "hoima", label: "Hoima", zone: "albert" },
  ],
  zoneForDistrict: () => "albert",
};

export const EDWARD_CONFIG: LakeConfig = {
  key: "edward",
  name: "Lake Edward",
  zones: { edward: { slug: "rubirizi", label: "Lake Edward" } },
  shorelineDistricts: [
    { slug: "rubirizi", label: "Rubirizi", zone: "edward" },
    { slug: "kasese", label: "Kasese", zone: "edward" },
  ],
  zoneForDistrict: () => "edward",
};

export function lakeHref(lakeKey: string, shoreSlug: string) {
  return `/lake-${lakeKey}?shore=${encodeURIComponent(shoreSlug)}`;
}
