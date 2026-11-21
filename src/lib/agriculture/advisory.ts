import { formatDistrictPhrase } from "@/lib/i18n";
import { getDictionary } from "@/lib/i18n/useTranslation";
import type { SupportedLocale } from "@/lib/i18n/types";
import { formatClockLabelForLanguage } from "@/lib/time/uganda";
import type { WeatherBundle } from "@/types/weather";
import { buildCropAdvisories, type CropAdvisory } from "./crops";

export type SoilMoistureLevel = "low" | "moderate" | "high";

export interface FarmWorkWindows {
  dryingStatus: "good" | "caution" | "wait";
  dryingSummary: string;
  sprayingStatus: "good" | "caution" | "wait";
  sprayingSummary: string;
}

/**
 * Computes actionable 6-hour sun-drying (okwanika) and foliar/chemical spraying
 * (okufuuyira) windows from the district's upcoming hourly forecast so
 * smallholder farmers can prevent post-harvest aflatoxin and input wash-off.
 */
export function computeFarmWorkWindows(
  weather: WeatherBundle,
  language: SupportedLocale = "en",
): FarmWorkWindows {
  const isLg = language === "lg";
  const upcomingHours = Array.isArray(weather.hourly)
    ? weather.hourly.filter((p) => p.kind === "hour").slice(0, 6)
    : [];
  const rainyHour = upcomingHours.find((p) => (p.rainChance ?? 0) >= 45);
  const maxUpcomingRain =
    upcomingHours.length > 0
      ? Math.max(...upcomingHours.map((p) => p.rainChance ?? 0))
      : weather.precipitation.chance;
  const maxUpcomingWind =
    upcomingHours.length > 0
      ? Math.max(
          weather.wind.speedKph,
          ...upcomingHours.map((p) => p.windSpeedKph ?? weather.wind.speedKph),
        )
      : weather.wind.speedKph;

  if (!weather.isDay) {
    return {
      dryingStatus: "wait",
      dryingSummary: isLg
        ? "Obudde bw'ekiro: yanula ebirime ebikalu obitereke mu nnyumba okwewala omume."
        : "Nighttime: keep harvested crops covered indoors away from night moisture.",
      sprayingStatus: "wait",
      sprayingSummary: isLg
        ? "Lindako okufuuyira eddagala okutuusa enkya ku makya ng'empewo nteefu."
        : "Wait until tomorrow morning to spray crops when daylight and calm winds return.",
    };
  }

  const rainyHourLg = rainyHour
    ? formatClockLabelForLanguage(rainyHour.label, "lg", "medium")
    : "";

  let dryingStatus: "good" | "caution" | "wait" = "good";
  let dryingSummary: string;
  if (maxUpcomingRain >= 60 || weather.condition.theme === "thunder" || weather.condition.theme === "rain") {
    dryingStatus = "wait";
    dryingSummary = isLg
      ? `Toyanika birime ebweru kati${rainyHourLg ? ` (enkuba esuubirwa ku ssaawa ${rainyHourLg})` : ""}. Bikuume mu kifo ekikalu.`
      : `Do not spread crops to dry outside right now${rainyHour ? ` (rain likely around ${rainyHour.label})` : ""}. Keep harvest covered.`;
  } else if (maxUpcomingRain >= 30 || weather.humidity >= 80) {
    dryingStatus = "caution";
    dryingSummary = isLg
      ? `Bw'oyanika kasooli, emmwanyi, oba ebijanjaalo, tegeka amatundubaali okumpi${rainyHourLg ? ` nga ssaawa ${rainyHourLg} tezinnatuuka` : ""}.`
      : `If sun drying maize, coffee, or beans, keep tarpaulins ready${rainyHour ? ` before ${rainyHour.label}` : ""}.`.trim();
  } else {
    dryingSummary = isLg
      ? "Obudde bulungi okwanika kasooli, emmwanyi, ebijanjaalo, ne muwogo mu ssaawa mukaaga eziddako."
      : "Good 6 hour dry window for sun drying maize, coffee, beans, and cassava.";
  }

  let sprayingStatus: "good" | "caution" | "wait" = "good";
  let sprayingSummary: string;
  if (maxUpcomingRain >= 45 || maxUpcomingWind >= 24) {
    sprayingStatus = "wait";
    sprayingSummary = isLg
      ? "Lindako okufuuyira eddagala kati olw'enkuba oba empewo ey'amaanyi ereeta eddagala okuggwaako."
      : "Avoid spraying crops right now because rain or strong wind can wash off or drift spray.";
  } else if (maxUpcomingRain >= 25 || maxUpcomingWind >= 18) {
    sprayingStatus = "caution";
    sprayingSummary = isLg
      ? "Fuuyira n'obwegendereza mu ssaawa enteefu ng'empewo eri wansi."
      : "Spray with caution during calmer hours while wind stays light.";
  } else {
    sprayingSummary = isLg
      ? "Empewo nteefu era tewali nkuba mu ssaawa eziddako: kiseera kirungi okufuuyira ebirime."
      : "Calm wind and low rain chance ahead: good window for foliar feeding or crop spraying.";
  }

  return {
    dryingStatus: dryingStatus,
    dryingSummary: dryingSummary.trim(),
    sprayingStatus,
    sprayingSummary,
  };
}

export interface AgricultureAdvisory {
  agroZone: string;
  agroZoneLabel: string;
  season: { name: string; phase: string; label: string };
  soilMoisture: { level: SoilMoistureLevel; label: string };
  crops: string[];
  cropAdvisories: CropAdvisory[];
  recommendations: string[];
  workWindows?: FarmWorkWindows;
}

const AGRO_ZONE_LABELS: Record<string, string> = {
  banana_coffee: "Banana and coffee region",
  banana_millet_cotton: "Lake Victoria crescent",
  karamoja: "Karamoja drylands",
  northern: "Northern savanna",
  west_nile: "West Nile",
  teso: "Teso",
  mountain: "Southwestern highlands",
};

/** One plain-language sentence per MAAIF/NARO agro-ecological zone, since
    a name like "Lake Victoria crescent" means nothing to most readers on
    its own. */
export const AGRO_ZONE_DESCRIPTIONS: Record<string, string> = {
  banana_coffee: "Uganda's central highlands, farmed for banana and coffee on fertile volcanic soils.",
  banana_millet_cotton:
    "The fertile area curving around Lake Victoria's northern shore, Uganda's most productive farming region.",
  karamoja: "Uganda's driest region, semi-arid rangeland suited to sorghum, millet, and livestock.",
  northern: "Open savanna across the north, with one long rainy season for grain crops.",
  west_nile: "The region west of the Albert Nile, known for cassava and tobacco.",
  teso: "The plains of eastern Uganda, historically the country's cotton-growing heartland.",
  mountain: "Uganda's cool, high-altitude southwest, terraced for banana, beans, and Irish potato.",
};

export const ZONE_CROPS: Record<string, string[]> = {
  banana_coffee: ["Coffee", "Banana", "Maize", "Beans"],
  banana_millet_cotton: ["Cotton", "Millet", "Maize", "Cassava"],
  karamoja: ["Sorghum", "Millet", "Cowpeas"],
  northern: ["Millet", "Sorghum", "Cassava", "Sesame"],
  west_nile: ["Cassava", "Rice", "Maize", "Groundnuts"],
  teso: ["Maize", "Cassava", "Groundnuts", "Sorghum"],
  mountain: ["Banana", "Beans", "Irish potato", "Coffee"],
};

function ugandaSeason(date = new Date()) {
  const month = date.getMonth() + 1;
  if (month >= 3 && month <= 5) {
    return { name: "first_rains", phase: "planting_time", label: "First rains (Mar to May)" };
  }
  if (month >= 6 && month <= 8) {
    return { name: "dry_season", phase: "mid_dry", label: "Dry season (Jun to Aug)" };
  }
  if (month >= 9 && month <= 11) {
    return { name: "second_rains", phase: "planting_time", label: "Second rains (Sep to Nov)" };
  }
  return { name: "short_dry", phase: "land_prep", label: "Short dry season (Dec to Feb)" };
}

function soilMoistureFromWeather(weather: WeatherBundle): { level: SoilMoistureLevel; label: string } {
  const recentRain = weather.precipitation.mm;
  const rainChance = weather.precipitation.chance;
  const upcomingRain = weather.dailyForecast.slice(0, 3).some((day) => (day.rainChance ?? 0) >= 40);

  if (recentRain >= 5 || rainChance >= 70) {
    return { level: "high", label: "High" };
  }
  if (recentRain >= 1 || rainChance >= 40 || upcomingRain) {
    return { level: "moderate", label: "Moderate" };
  }
  return { level: "low", label: "Low" };
}

function recommendationsFor(
  weather: WeatherBundle,
  season: ReturnType<typeof ugandaSeason>,
  soil: ReturnType<typeof soilMoistureFromWeather>,
  crops: string[],
  language: SupportedLocale,
): string[] {
  const tips: string[] = [];
  const isLg = language === "lg";
  const agDict = getDictionary(language).agriculture;
  const zone = weather.district.agroZone ?? "banana_coffee";
  const isStorm = weather.condition.theme === "thunder" || weather.condition.theme === "rain";
  const hot = weather.temperature.celsius >= 30;
  const firstCropRaw = crops[0]?.toLowerCase() ?? "crops";
  const firstCropDisplay = isLg
    ? firstCropRaw === "banana"
      ? "ebitooke"
      : (agDict.cropNames[firstCropRaw] ?? "ebirime").toLowerCase()
    : firstCropRaw;
  const plantVerbLg = ["coffee", "cassava", "banana", "irish potato"].includes(firstCropRaw)
    ? "okusimba"
    : "okusiga";

  if (season.name === "dry_season" || season.name === "short_dry") {
    if (soil.level === "low") {
      tips.push(
        isLg
          ? "Kuuma amazzi mu ttaka ng'obikka essubi ku mmwanyi, ebitooke, n'enva endiirwa."
          : "Conserve soil moisture with mulch around coffee, banana, and vegetable beds.",
      );
      tips.push(
        isLg
          ? "Lindako okusiga kasooli omupya okutuusa ng'enkuba eddamu, okuggyako ng'ofukirira."
          : "Delay new maize planting until rain returns unless irrigation is available.",
      );
    } else {
      tips.push(
        isLg
          ? "Kozesa enkuba entono okusiga ebijanjaalo ebikula amangu oba enva endiirwa."
          : "Use brief showers to plant quick-maturing beans or vegetables.",
      );
    }
  }

  if (season.name === "first_rains" || season.name === "second_rains") {
    if (soil.level !== "low") {
      tips.push(
        isLg
          ? `Ekiseera kirungi ${plantVerbLg} ${firstCropDisplay}. Amazzi mu ttaka geeyongera.`
          : `Good time to plant ${firstCropDisplay}. Soil moisture is building.`,
      );
    }
    tips.push(
      isLg
        ? "Tegeka ennimiro ku nnaku ezitaliimu nkuba osige ng'enkuba ya mm 20 esuubirwa mu nnaku 3."
        : "Prepare gardens on dry days and plant when 20 mm of rain is forecast over 3 days.",
    );
  }

  if (zone === "karamoja" || zone === "northern") {
    tips.push(
      isLg
        ? "Kebera ebisolo olw'omusana omungi. Biwe ekisiikirize n'amazzi ag'okunywa mu ttuntu."
        : "Watch for heat stress on livestock. Provide shade and water midday.",
    );
  }

  if (zone === "mountain" && weather.district.hazards.includes("landslide")) {
    tips.push(
      isLg
        ? "Weewale okulima ku bisenge by'ensozi ebyewunzise oluvannyuma lw'enkuba ennyingi. Ettaka liyinza okutenguka."
        : "Avoid steep slope cultivation after heavy rain. Landslide risk rises quickly.",
    );
  }

  if (isStorm) {
    tips.push(
      isLg
        ? "Lindako okufuuyira eddagala oba okukungula okutuusa ng'empewo ekendedde n'ennimiro zikaze."
        : "Wait to spray or harvest until winds drop and gardens dry.",
    );
  }

  if (hot) {
    tips.push(
      isLg
        ? `Ebbugumu liri ku ${weather.temperature.celsius}°. Fukirira ku makya nnyo oba akawungeezi.`
        : `Heat near ${weather.temperature.celsius}°. Water early morning or late evening.`,
    );
  }

  if (weather.dailyForecast[1] && weather.dailyForecast[1].high >= weather.daily.high + 2) {
    tips.push(
      isLg
        ? "Ebbugumu lyeyongera enkya. Embeera nnungi okwanika emmere y'empeke enkalu ng'enkuba tekubye."
        : "Warmth builds tomorrow. Good drying weather for stored grain if rain holds off.",
    );
  }

  if (tips.length === 0) {
    tips.push(
      isLg
        ? formatDistrictPhrase(
            "Embeera mu {district} eteredde. Kebera enteekateeka y'ennaku 10 nga tonnatandika mirimu.",
            weather.district.name,
            getDictionary(language),
            language,
          )
        : `Conditions are steady for ${weather.district.name}. Check the 10-day outlook before garden work.`,
    );
  }

  return tips.slice(0, 5);
}

export function buildAgricultureAdvisory(
  weather: WeatherBundle,
  language: SupportedLocale = "en",
): AgricultureAdvisory {
  const agroZone = weather.district.agroZone ?? "banana_coffee";
  const rawSeason = ugandaSeason();
  const agDict = getDictionary(language).agriculture;
  const season = {
    ...rawSeason,
    label: agDict.seasonLabels[rawSeason.name] ?? rawSeason.label,
  };
  const rawSoil = soilMoistureFromWeather(weather);
  const soilMoisture = {
    level: rawSoil.level,
    label: agDict.soilLabels[rawSoil.level] ?? rawSoil.label,
  };
  const rawCrops = ZONE_CROPS[agroZone] ?? ZONE_CROPS.banana_coffee;
  const crops =
    language === "lg"
      ? rawCrops.map((crop) => agDict.cropNames[crop.toLowerCase()] ?? crop)
      : rawCrops;

  const workWindows = computeFarmWorkWindows(weather, language);
  const baseRecommendations = recommendationsFor(weather, rawSeason, rawSoil, rawCrops, language);
  const recommendations = [
    workWindows.dryingSummary,
    ...baseRecommendations.filter((item) => item !== workWindows.dryingSummary),
  ].slice(0, 5);

  return {
    agroZone,
    agroZoneLabel: agDict.zones[agroZone]?.label ?? AGRO_ZONE_LABELS[agroZone] ?? "Uganda farmlands",
    season,
    soilMoisture,
    crops,
    cropAdvisories: buildCropAdvisories(weather, rawSeason.name, soilMoisture.level, rawCrops, language),
    recommendations,
    workWindows,
  };
}
