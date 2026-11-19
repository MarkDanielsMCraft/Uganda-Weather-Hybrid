import type { WeatherBundle } from "@/types/weather";
import {
  computeFishingSafety,
  waveHeightFromWind,
  waterTempFromAir,
  type FishingSafety,
  type LakeConditions,
  type SafetyLevel,
} from "./lake-conditions";

export type { FishingSafety, SafetyLevel };
export { computeFishingSafety };

export type LakeVictoriaConditions = LakeConditions;

const LAKE_ZONES = {
  central: { slug: "kalangala", label: "Central Lake, Kalangala" },
  eastern: { slug: "jinja", label: "Eastern Lake, Jinja" },
  western: { slug: "masaka", label: "Western Lake, Masaka" },
} as const;

export type LakeZone = keyof typeof LAKE_ZONES;

export function lakeZoneForDistrict(district: WeatherBundle["district"]): LakeZone {
  if (district.slug === "jinja" || district.region === "eastern") return "eastern";
  if (district.coordinates.lon < 32.2) return "western";
  return "central";
}

export function referenceLakeDistrictSlug(district: WeatherBundle["district"]): string {
  if (district.isLakeVictoriaZone) return district.slug;
  return LAKE_ZONES[lakeZoneForDistrict(district)].slug;
}

export function buildLakeVictoriaConditions(weather: WeatherBundle): LakeVictoriaConditions {
  const zone = lakeZoneForDistrict(weather.district);
  const zoneMeta = LAKE_ZONES[zone];

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

export const LAKE_SHORELINE_DISTRICTS = [
  { slug: "kalangala", label: "Kalangala", zone: "central" as const },
  { slug: "jinja", label: "Jinja", zone: "eastern" as const },
  { slug: "entebbe", label: "Entebbe", zone: "central" as const },
  { slug: "masaka", label: "Masaka", zone: "western" as const },
] as const;

export { LAKE_ZONES };
