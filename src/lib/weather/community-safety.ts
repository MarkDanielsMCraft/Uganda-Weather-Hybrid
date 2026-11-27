import type { SupportedLocale } from "@/lib/i18n/types";
import type { WeatherBundle } from "@/types/weather";

export type CommunitySafetyAlertId =
  | "uv_protection"
  | "pastoral_heat"
  | "mountain_landslide";

export interface CommunitySafetyAlert {
  id: CommunitySafetyAlertId;
  level: "watch" | "warning";
  title: string;
  summary: string;
}

/**
 * Derives zero-cost, high-impact Ugandan community safety advisories purely
 * from the already-fetched WeatherBundle:
 * 1. High-UV skin protection (outdoor workers, children, persons with albinism).
 * 2. Pastoralist & livestock heat-stress / dry-spell watch (Karamoja & cattle corridor).
 * 3. Cumulative 72-hour rainfall landslide risk indicator (mountain/slope districts).
 */
export function buildCommunitySafetyAlerts(
  weather: WeatherBundle,
  language: SupportedLocale = "en",
): CommunitySafetyAlert[] {
  const alerts: CommunitySafetyAlert[] = [];
  const isLg = language === "lg";
  const zone = weather.district.agroZone ?? "";
  const hazards = weather.district.hazards ?? [];
  const districtName = weather.district.name;

  // 1. 72-hour mountain slope landslide risk indicator
  const isMountainOrSlope = zone === "mountain" || hazards.includes("landslide");
  if (isMountainOrSlope) {
    const next3Days = (weather.dailyForecast ?? []).slice(0, 3);
    const rainChances = next3Days.map((d) => Math.max(0, Math.round(d.rainChance ?? 0)));
    const wetDays72h = rainChances.filter((c) => c >= 60).length;
    const avgRainChance72h =
      rainChances.length > 0
        ? Math.round(rainChances.reduce((sum, c) => sum + c, 0) / rainChances.length)
        : weather.precipitation.chance;
    const heavyRainNow = weather.precipitation.mm >= 10;
    const stormWithWetOutlook = weather.condition.theme === "thunder" && avgRainChance72h >= 50;

    if (
      heavyRainNow ||
      wetDays72h >= 2 ||
      (avgRainChance72h >= 65 && weather.precipitation.chance >= 55) ||
      stormWithWetOutlook
    ) {
      const level: "watch" | "warning" =
        weather.precipitation.mm >= 25 || (wetDays72h >= 3 && avgRainChance72h >= 75)
          ? "warning"
          : "watch";
      alerts.push({
        id: "mountain_landslide",
        level,
        title: isLg
          ? "Obulabe bw'okutenguka kw'ettaka (ssaawa 72)"
          : "72 hour slope landslide watch",
        summary: isLg
          ? `Enkuba eddiŋŋana mu ssaawa 72 ezijja eyongera obulabe bw'ettaka okutenguka mu ${districtName}. Weewale ebisenge by'ensozi ebyewunzise n'emigga.`
          : `Repeated rain over the next 72 hours increases saturated slope risk in ${districtName}. Avoid steep hillsides, riverbanks, and cracked ground.`,
      });
    }
  }

  // 2. High-UV sun protection (outdoor workers, children, persons with albinism)
  const uv = Math.round(weather.uvIndex ?? 0);
  if (weather.isDay && uv >= 8) {
    const level: "watch" | "warning" = uv >= 11 ? "warning" : "watch";
    alerts.push({
      id: "uv_protection",
      level,
      title: isLg ? "Okwekuuma omusana ogw'amaanyi" : "High UV sun protection",
      summary: isLg
        ? `Omusana gw'amaanyi nnyo (UV ${uv}). Funa ekisiikirize mu ttuntu, yambala enkoofiira n'engoye empanvu. Okwegendereza okw'enjawulo eri abakozi ab'ebweru, abaana, n'abantu abalina albinism.`
        : `UV index is ${uv}. Seek shade midday, wear a hat, long sleeves, and sunscreen. Extra care for outdoor workers, children, and persons with albinism.`,
    });
  }

  // 3. Pastoralist & livestock heat-stress / dry-spell alert (Karamoja & cattle corridor)
  const isPastoralCorridor =
    zone === "karamoja" ||
    zone === "northern" ||
    zone === "teso" ||
    hazards.includes("drought");
  if (isPastoralCorridor) {
    const temp = Math.round(weather.temperature.celsius);
    const next3Days = (weather.dailyForecast ?? []).slice(0, 3);
    const maxRain3d =
      next3Days.length > 0
        ? Math.max(...next3Days.map((d) => Math.round(d.rainChance ?? 0)))
        : weather.precipitation.chance;
    const isHot = temp >= 31;
    const isDrySpellHeat = temp >= 28 && maxRain3d <= 20 && weather.precipitation.mm < 1;

    if (isHot || isDrySpellHeat) {
      const level: "watch" | "warning" =
        temp >= 35 || (zone === "karamoja" && maxRain3d <= 10 && temp >= 32)
          ? "warning"
          : "watch";
      alerts.push({
        id: "pastoral_heat",
        level,
        title: isLg ? "Okulabirira ebisolo mu musana" : "Livestock heat and water watch",
        summary: isLg
          ? `Omusana mungi (${temp}°C) mu ${districtName}. Lunda ebisolo ku makya oba akawungeezi, biwe ekisiikirize, era oteeketeeke amazzi ag'okunywa nga bukyali.`
          : `Hot dry conditions (${temp}°C) in ${districtName}. Graze livestock early morning or late afternoon, provide shade, and plan water points early.`,
      });
    }
  }

  return alerts;
}
