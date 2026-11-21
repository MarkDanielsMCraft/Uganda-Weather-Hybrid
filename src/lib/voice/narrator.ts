import { buildAgricultureAdvisory, computeFarmWorkWindows } from "@/lib/agriculture/advisory";
import { en as enDict } from "@/lib/i18n/dictionaries/en";
import { lg as lgDict } from "@/lib/i18n/dictionaries/lg";
import type { SupportedLocale } from "@/lib/i18n/types";
import {
  ALBERT_CONFIG,
  buildLakeConditions,
  EDWARD_CONFIG,
  KYOGA_CONFIG,
} from "@/lib/marine/lake-conditions";
import { buildLakeVictoriaConditions } from "@/lib/marine/lake-victoria";
import { buildDistrictContent } from "@/lib/seo/district-content";
import { formatClockLabelForLanguage } from "@/lib/time/uganda";
import {
  formatConditionLg,
  formatDayLg,
  formatDayPrepositionLg,
  formatMarineSafetyLg,
  localizeAlertForLanguage,
} from "@/lib/weather/copy-lg";
import type { District, WeatherBundle } from "@/types/weather";

export interface SpokenBriefingPair {
  en: string;
  lg: string;
}

function getNext6HourPeakRain(weather: WeatherBundle): number {
  const hourly = Array.isArray(weather.hourly)
    ? weather.hourly.filter((p) => p.kind === "hour" && typeof p.rainChance === "number").slice(0, 6)
    : [];
  if (hourly.length > 0) {
    return Math.round(Math.max(...hourly.map((h) => h.rainChance ?? 0)));
  }
  return Math.round(weather.precipitation.chance);
}

/**
 * Builds a spoken narration for legal/informational pages (/disclaimer, /privacy,
 * /terms, /cookies, /attribution) or the "About {District} Weather" section.
 */
export function buildSectionNarration(
  sectionKey: string,
  district?: District | null,
): SpokenBriefingPair | null {
  const key = sectionKey.toLowerCase();

  if (key.includes("disclaimer") || key.includes("okweggyako")) {
    return {
      en: `${enDict.legal.disclaimer}. ${enDict.legalPages.disclaimerParagraphs.join(" ")}`,
      lg: `${lgDict.legal.disclaimer}. ${lgDict.legalPages.disclaimerParagraphs.join(" ")}`,
    };
  }

  if (key.includes("privacy") || key.includes("eby'ekyama") || key.includes("ekyama")) {
    return {
      en: `${enDict.legal.privacy}. ${enDict.legalPages.privacyParagraphs.join(" ")}`,
      lg: `${lgDict.legal.privacy}. ${lgDict.legalPages.privacyParagraphs.join(" ")}`,
    };
  }

  if (key.includes("terms") || key.includes("amateeka")) {
    return {
      en: `${enDict.legal.terms}. ${enDict.legalPages.termsParagraphs.join(" ")}`,
      lg: `${lgDict.legal.terms}. ${lgDict.legalPages.termsParagraphs.join(" ")}`,
    };
  }

  if (key.includes("cookies") || key.includes("kukiisi")) {
    return {
      en: `${enDict.legal.cookies}. ${enDict.legalPages.cookiesEssentialTitle}: ${enDict.legalPages.cookiesEssentialBody} ${enDict.legalPages.cookiesAnalyticsTitle}: ${enDict.legalPages.cookiesAnalyticsBody}`,
      lg: `${lgDict.legal.cookies}. ${lgDict.legalPages.cookiesEssentialTitle}: ${lgDict.legalPages.cookiesEssentialBody} ${lgDict.legalPages.cookiesAnalyticsTitle}: ${lgDict.legalPages.cookiesAnalyticsBody}`,
    };
  }

  if (key.includes("attribution") || key.includes("ensibuko")) {
    return {
      en: `${enDict.legal.attributionTitle}. ${enDict.legalPages.attributionSubtitle} ${enDict.legal.attribution}`,
      lg: `${lgDict.legal.attributionTitle}. ${lgDict.legalPages.attributionSubtitle} ${lgDict.legal.attribution}`,
    };
  }

  if (
    (key.includes("about") || key.includes("ebikwata ku") || key.includes("reference")) &&
    district
  ) {
    const contentEn = buildDistrictContent(district, "en");
    const contentLg = buildDistrictContent(district, "lg");
    return {
      en: `About ${district.name} weather. ${contentEn.intro} ${contentEn.seasons} ${contentEn.farming} ${contentEn.hazards ?? ""}`.trim(),
      lg: `Ebikwata ku mbeera y'obudde mu ${district.name}. ${contentLg.intro} ${contentLg.seasons} ${contentLg.farming} ${contentLg.hazards ?? ""}`.trim(),
    };
  }

  return null;
}

/**
 * Builds a complete, natural radio-style Home & District spoken briefing
 * designed for grandmothers, blind users, and non-readers, covering the whole page:
 * current weather, 6-hour rain/wind, alerts, farming work windows, lake safety,
 * and upcoming 3-day outlook.
 */
export function buildHomeWeatherNarration(
  weather: WeatherBundle,
  displayName: string,
): SpokenBriefingPair {
  const temp = Math.round(weather.temperature.celsius);
  const high = Math.round(weather.daily.high);
  const low = Math.round(weather.daily.low);
  const wind = Math.round(weather.wind.speedKph);
  const humidity = Math.round(weather.humidity);
  const nextRain = getNext6HourPeakRain(weather);
  const conditionLg = formatConditionLg(weather.condition.text, weather.isDay);
  const farmEn = computeFarmWorkWindows(weather, "en");
  const farmLg = computeFarmWorkWindows(weather, "lg");
  const alert = weather.alerts?.[0];
  const alertLg = alert
    ? localizeAlertForLanguage(alert, "lg", lgDict.alerts.demo)
    : undefined;

  const alertPartEn = alert ? ` Weather warning: ${alert.title}.` : "";
  const alertPartLg = alertLg ? ` Okulabula: ${alertLg.title}.` : "";

  let lakePartEn = "";
  let lakePartLg = "";
  if (weather.district.isLakeVictoriaZone || weather.district.lakeZone) {
    const lakeCond =
      weather.district.lakeZone === "kyoga"
        ? buildLakeConditions(weather, KYOGA_CONFIG)
        : weather.district.lakeZone === "albert"
          ? buildLakeConditions(weather, ALBERT_CONFIG)
          : weather.district.lakeZone === "edward"
            ? buildLakeConditions(weather, EDWARD_CONFIG)
            : buildLakeVictoriaConditions(weather);
    const safetyLg = formatMarineSafetyLg(lakeCond.fishingSafety);
    lakePartEn = ` Lake safety: ${lakeCond.fishingSafety.label}. ${lakeCond.fishingSafety.summary}`;
    lakePartLg = ` Obukuumi ku nnyanja: ${safetyLg.label}. ${safetyLg.summary}`;
  }

  // Skip "Today" in the upcoming-days tail since today's exact temp, high/low,
  // and next-6-hour rain chance are already announced first (avoids reading an
  // outdated daytime rain % at night).
  const upcomingDays = (weather.dailyForecast ?? [])
    .filter((d, idx) => !(idx === 0 && d.day.trim().toLowerCase() === "today"))
    .slice(0, 2);
  const daysEn =
    upcomingDays.length > 0
      ? ` Next days: ${upcomingDays
          .map(
            (d) =>
              `${d.day}, high ${Math.round(d.high)} degrees, low ${Math.round(d.low)}, rain ${Math.round(d.rainChance ?? 0)} percent`,
          )
          .join("; ")}.`
      : "";
  const daysLg =
    upcomingDays.length > 0
      ? ` Ennaku eziddako: ${upcomingDays
          .map(
            (d) =>
              `${formatDayPrepositionLg(d.day, true)}: ebbugumu lya waggulu ${Math.round(d.high)}°C, wansi ${Math.round(d.low)}°C, enkuba ${Math.round(d.rainChance ?? 0)}%`,
          )
          .join("; ")}.`
      : "";

  const farmAdviceEn = weather.isDay
    ? `${farmEn.dryingSummary} ${farmEn.sprayingSummary}`
    : farmEn.dryingSummary;
  const farmAdviceLg = weather.isDay
    ? `${farmLg.dryingSummary} ${farmLg.sprayingSummary}`
    : farmLg.dryingSummary;

  const en = `${displayName}. Currently ${temp} degrees and ${weather.condition.text}, with a high of ${high} and low of ${low}. Rain chance over the next 6 hours is ${nextRain} percent, wind is ${wind} kilometers per hour, and humidity is ${humidity} percent.${alertPartEn} ${farmAdviceEn}${lakePartEn}${daysEn}`;
  const lg = `Embeera y'obudde mu ${displayName} leero: ${conditionLg}, ng'ebbugumu liri ku ${temp}°C, waggulu ${high}°C ate wansi ${low}°C. Omukisa gw'enkuba mu ssaawa mukaaga eziddako guli ku ${nextRain}%, empewo eri ku ${wind} km/h, ate obunnyogovu buli ku ${humidity}%.${alertPartLg} ${farmAdviceLg}${lakePartLg}${daysLg}`;

  return { en, lg };
}

/**
 * Builds a context-aware spoken briefing for whichever DetailSheet tile, modal,
 * or page section is open. Accepts either a tileId, a localized sheet title,
 * or a combined string (`"${sheet.tileId} ${sheet.title}"`).
 */
export function buildSheetNarration(
  tileId: string | null | undefined,
  weather: WeatherBundle,
  displayName: string,
): SpokenBriefingPair {
  if (!tileId) {
    return buildHomeWeatherNarration(weather, displayName);
  }

  const sectionMatch = buildSectionNarration(tileId, weather.district);
  if (sectionMatch) {
    return sectionMatch;
  }

  const key = tileId.toLowerCase();

  if (key.includes("agriculture") || key.includes("ebyobulimi")) {
    const advEn = buildAgricultureAdvisory(weather, "en");
    const advLg = buildAgricultureAdvisory(weather, "lg");
    const farmEn = computeFarmWorkWindows(weather, "en");
    const farmLg = computeFarmWorkWindows(weather, "lg");
    const tipsEn = advEn.recommendations.slice(0, 2).join(" ");
    const tipsLg = advLg.recommendations.slice(0, 2).join(" ");
    return {
      en: `Farming advice for ${displayName}. ${advEn.agroZoneLabel}, ${advEn.season.label}. Soil moisture is ${advEn.soilMoisture.label}. ${farmEn.dryingSummary} ${farmEn.sprayingSummary} ${tipsEn}`,
      lg: `Amagezi ag'ebyobulimi mu ${displayName}. ${advLg.agroZoneLabel}, ${advLg.season.label}. Amazzi mu ttaka gali ku mutendera gwa: ${advLg.soilMoisture.label}. ${farmLg.dryingSummary} ${farmLg.sprayingSummary} ${tipsLg}`,
    };
  }

  if (
    key.includes("lake") ||
    key.includes("marine") ||
    key.includes("nalubaale") ||
    key.includes("mwitanzige") ||
    key.includes("nnyanja")
  ) {
    const isKyoga = key.includes("kyoga");
    const isAlbert = key.includes("albert") || key.includes("mwitanzige");
    const isEdward = key.includes("edward");
    const lakeNameEn = isKyoga
      ? KYOGA_CONFIG.name
      : isAlbert
        ? ALBERT_CONFIG.name
        : isEdward
          ? EDWARD_CONFIG.name
          : "Lake Victoria";
    // Drop initial vowel 'E-' after locative 'ku' per Munno orthography Section 5
    const lakeLocativeLg = isKyoga
      ? "Nnyanja Kyoga"
      : isAlbert
        ? "Nnyanja Mwitanzige"
        : isEdward
          ? "Nnyanja Edward"
          : "Nnyanja Nalubaale";
    const cond = isKyoga
      ? buildLakeConditions(weather, KYOGA_CONFIG)
      : isAlbert
        ? buildLakeConditions(weather, ALBERT_CONFIG)
        : isEdward
          ? buildLakeConditions(weather, EDWARD_CONFIG)
          : buildLakeVictoriaConditions(weather);
    const safetyLg = formatMarineSafetyLg(cond.fishingSafety);
    return {
      en: `${lakeNameEn} fishing safety for ${displayName}. Status: ${cond.fishingSafety.label}. ${cond.fishingSafety.summary} Waves are around ${cond.waveHeightM} meters with wind at ${Math.round(cond.windSpeedKph)} kilometers per hour.`,
      lg: `Obukuumi bw'abavubi ku ${lakeLocativeLg} okumpi ne ${displayName}. Embeera: ${safetyLg.label}. ${safetyLg.summary} Amayengo gali ku mita ${cond.waveHeightM} ate empewo eri ku ${Math.round(cond.windSpeedKph)} km/h.`,
    };
  }

  if (key.includes("alert") || key.includes("okulabula")) {
    const first = weather.alerts?.[0];
    if (first) {
      const firstLg = localizeAlertForLanguage(first, "lg", lgDict.alerts.demo);
      return {
        en: `Weather alert for ${displayName}. ${first.title}. ${first.description}`,
        lg: `Okulabula kw'obudde mu ${displayName}. ${firstLg.title}. ${firstLg.description}`,
      };
    }
    return {
      en: `No active weather warnings for ${displayName} right now. Conditions remain calm.`,
      lg: `Tewali kulabula kw'obudde obw'obulabe mu ${displayName} kati. Obudde buteefu.`,
    };
  }

  if (key.includes("hourly") || key.includes("ssaawa")) {
    const hours = (weather.hourly ?? [])
      .filter((h) => h.kind === "hour")
      .slice(0, 6);
    if (hours.length > 0) {
      const enHours = hours
        .map(
          (h) =>
            `${h.label}: ${Math.round(h.temp ?? weather.temperature.celsius)} degrees, rain ${Math.round(h.rainChance ?? 0)} percent`,
        )
        .join(". ");
      const lgHours = hours
        .map(
          (h) =>
            `ku ssaawa ${formatClockLabelForLanguage(h.label, "lg", "medium")}: ${Math.round(h.temp ?? weather.temperature.celsius)}°C, enkuba ${Math.round(h.rainChance ?? 0)}%`,
        )
        .join(". ");
      return {
        en: `Hourly forecast for ${displayName}. ${enHours}.`,
        lg: `Embeera y'obudde buli ssaawa mu ${displayName}. ${lgHours}.`,
      };
    }
  }

  if (key.includes("forecast") || key.includes("daily") || key.includes("ennaku")) {
    const days = (weather.dailyForecast ?? []).slice(0, 5);
    const enDays = days
      .map(
        (d) =>
          `${d.day}: high ${Math.round(d.high)} degrees, low ${Math.round(d.low)}, rain chance ${Math.round(d.rainChance ?? 0)} percent`,
      )
      .join(". ");
    const lgDays = days
      .map(
        (d) =>
          `${formatDayLg(d.day)}: waggulu ${Math.round(d.high)}°C, wansi ${Math.round(d.low)}°C, enkuba ${Math.round(d.rainChance ?? 0)}%`,
      )
      .join(". ");
    return {
      en: `Upcoming days forecast for ${displayName}. ${enDays}.`,
      lg: `Enteekateeka y'ennaku ezijja mu ${displayName}. ${lgDays}.`,
    };
  }

  if (key.includes("air quality") || key.includes("air-quality") || key.includes("obulungi bw'empewo")) {
    const aqi = Math.round(weather.airQuality.aqi);
    const aqiAdviceLg =
      aqi <= 50
        ? "Empewo nnungi okukoleramu emirimu gy'ebweru."
        : aqi <= 100
          ? "Empewo eri ku kigero. Abalina obuzibu bw'okussa beegendereze."
          : "Empewo si nnungi nnyo. Kendeeza emirimu egya maanyi ebweru.";
    return {
      en: `Air quality in ${displayName} is ${weather.airQuality.category} with an index of ${aqi}. ${weather.airQuality.advice}`,
      lg: `Obulungi bw'empewo mu ${displayName} buli ku kipimo kya ${aqi}. ${aqiAdviceLg}`,
    };
  }

  if (key.includes("pressure") || key.includes("obuzito")) {
    const hpa = Math.round(weather.pressureMb);
    return {
      en: `Atmospheric pressure in ${displayName} is ${hpa} millibars.`,
      lg: `Obuzito bw'empewo mu ${displayName} buli ku miliba ${hpa}.`,
    };
  }

  if (key.includes("wind") || key.includes("empewo")) {
    const speed = Math.round(weather.wind.speedKph);
    const gust = Math.round(weather.wind.gustKph ?? weather.wind.speedKph);
    return {
      en: `Wind in ${displayName} is ${speed} kilometers per hour from the ${weather.wind.direction}, with gusts up to ${gust} kilometers per hour.`,
      lg: `Empewo mu ${displayName} eri ku ${speed} km/h, ng'etuuka ku ${gust} km/h mu kibuyaga.`,
    };
  }

  if (key.includes("rain") || key.includes("precipitation") || key.includes("enkuba")) {
    const nextRain = getNext6HourPeakRain(weather);
    return {
      en: `Rainfall in ${displayName}: ${weather.precipitation.mm.toFixed(1)} millimeters recorded today, with a ${nextRain} percent chance of rain in the next 6 hours.`,
      lg: `Enkuba mu ${displayName}: milimiita ${weather.precipitation.mm.toFixed(1)} leero, era omukisa gw'enkuba mu ssaawa mukaaga eziddako guli ku ${nextRain}%.`,
    };
  }

  if (key.includes("humidity") || key.includes("obunnyogovu")) {
    const hum = Math.round(weather.humidity);
    return {
      en: `Humidity in ${displayName} is ${hum} percent.`,
      lg: `Obunnyogovu bw'empewo mu ${displayName} buli ku ${hum}%.`,
    };
  }

  if (key.includes("uv") || key.includes("omusana")) {
    const uv = Math.round(weather.uvIndex);
    return {
      en: `UV index in ${displayName} is ${uv}. ${uv >= 6 ? "Sun intensity is strong during midday, so wear a hat or seek shade." : "Sun intensity is currently low to moderate."}`,
      lg: `Amaanyi g'omusana mu ${displayName} gali ku kipimo kya ${uv}. ${uv >= 6 ? "Omusana mungi mu ttuntu, bambala enkoofiira oba weewogome." : "Amaanyi g'omusana matono kati."}`,
    };
  }

  if (key.includes("sun") || key.includes("enjuba")) {
    const sunriseLg = formatClockLabelForLanguage(weather.astronomy.sunrise, "lg", "medium");
    const sunsetLg = formatClockLabelForLanguage(weather.astronomy.sunset, "lg", "medium");
    return {
      en: `Sunrise and sunset in ${displayName}. Sunrise is at ${weather.astronomy.sunrise} and sunset is at ${weather.astronomy.sunset}.`,
      lg: `Okuvaayo n'okugwa kw'enjuba mu ${displayName}. Enjuba evaayo ku ssaawa ${sunriseLg} ate n'egwa ku ssaawa ${sunsetLg}.`,
    };
  }

  if (key.includes("feels") || key.includes("liwulirwa") || key.includes("ewulirwa")) {
    const feels = Math.round(weather.temperature.feelsLike);
    const actual = Math.round(weather.temperature.celsius);
    return {
      en: `Feels like temperature in ${displayName} is ${feels} degrees Celsius, compared to an actual temperature of ${actual} degrees.`,
      lg: `Ebbugumu mu ${displayName} liwulirwa nga ${feels}°C, ng'ebbugumu erya ddala liri ku ${actual}°C.`,
    };
  }

  if (key.includes("visibility") || key.includes("okulaba")) {
    const vis = Math.round(weather.visibilityKm);
    return {
      en: `Visibility in ${displayName} is ${vis} kilometers. ${vis >= 8 ? "Clear visibility for road and lake travel." : "Reduced visibility, please travel carefully."}`,
      lg: `Okulaba ewala mu ${displayName} kutuuka ku kilomita ${vis}. ${vis >= 8 ? "Obudde bulungi okulaba ewala ku nguudo ne ku nnyanja." : "Okulaba ewala kukendedde, vuga n'obwegendereza."}`,
    };
  }

  if (key.includes("moon") || key.includes("omwezi")) {
    return {
      en: `Moon phase and night sky in ${displayName}. Nighttime low temperature is ${Math.round(weather.daily.low)} degrees Celsius.`,
      lg: `Embeera y'omwezi n'obudde bw'ekiro mu ${displayName}. Ebbugumu ly'ekiro likka okutuuka ku ${Math.round(weather.daily.low)}°C.`,
    };
  }

  if (key.includes("park") || key.includes("ebisolo") || key.includes("mountain") || key.includes("ensozi") || key.includes("airport") || key.includes("ebisaawe")) {
    return {
      en: `Travel and landmarks weather near ${displayName}. Currently ${Math.round(weather.temperature.celsius)} degrees and ${weather.condition.text} with ${getNext6HourPeakRain(weather)} percent rain chance over the next 6 hours.`,
      lg: `Embeera y'obudde mu bifo by'obulambuzi n'entambula okumpi ne ${displayName}. Ebbugumu liri ku ${Math.round(weather.temperature.celsius)}°C, ${formatConditionLg(weather.condition.text, weather.isDay)}, n'omukisa gw'enkuba ${getNext6HourPeakRain(weather)}% mu ssaawa mukaaga eziddako.`,
    };
  }

  return buildHomeWeatherNarration(weather, displayName);
}

/**
 * Helper to pick the right spoken string for speakAdvisorReply().
 * Always uses the verified Munno Luganda string (pair.lg) when language === "lg"
 * so the Luganda TTS engine never translates or reads raw English strings.
 */
export function selectSpokenPayload(
  pair: SpokenBriefingPair,
  language: SupportedLocale,
): { text: string; sourceLanguage?: SupportedLocale } {
  return {
    text: language === "lg" ? pair.lg : pair.en,
  };
}
