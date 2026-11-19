import type { WeatherBundle } from "@/types/weather";

/**
 * Luganda meteorological condition formatters.
 * Strictly adheres to standard Luganda orthography (Empandiika y'Oluganda Entongole)
 * and the primary Luganda reference dictionary.
 */

const LUGANDA_CONDITIONS_BY_KEY: Record<string, string> = {
  clear: "Butangaavu",
  sunny: "Omusana",
  "mainly clear": "Butangaavu okusinga",
  "mostly clear": "Butangaavu okusinga",
  "partly cloudy": "Ekiddedde ekitono",
  cloudy: "Ekiddedde",
  overcast: "Ekiddedde",
  "mostly cloudy": "Ekiddedde ekinene",
  mist: "Olufu",
  fog: "Olufu",
  "freezing fog": "Olufu",
  haze: "Olukungu",
  hazy: "Olukungu",
  "smoky haze": "Olukungu",
  smoke: "Olukungu",
  "light drizzle": "Obukubakuba",
  drizzle: "Obukubakuba",
  "heavy drizzle": "Obukubakuba obungi",
  "light rain": "Enkuba etonnyako",
  "moderate rain": "Enkuba",
  rain: "Enkuba",
  "heavy rain": "Enkuba ey'amaanyi",
  "light rain shower": "Enkuba etonnyako",
  "moderate or heavy rain shower": "Enkuba ey'amatondo",
  "patchy rain possible": "Enkuba esuubirwa",
  "patchy rain nearby": "Enkuba esuubirwa",
  "patchy light drizzle": "Obukubakuba",
  "patchy light rain": "Enkuba etonnyako",
  "patchy rain": "Enkuba ey'amatondo",
  "rain shower": "Enkuba ey'amatondo",
  "light rain showers": "Enkuba ey'amatondo",
  "moderate or heavy rain showers": "Enkuba ey'amatondo",
  "heavy rain shower": "Enkuba ey'amaanyi",
  "chance of rain": "Enkuba esuubirwa",
  "possible thunderstorms": "Kibuyaga asuubirwa",
  "thundery outbreaks possible": "Kibuyaga asuubirwa",
  "thundery outbreaks in nearby": "Kibuyaga asuubirwa",
  thunderstorm: "Kibuyaga n'eraddu",
  "thunderstorms": "Kibuyaga n'eraddu",
  "thunderstorm with hail": "Enkuba y'omuzira",
  "thunderstorm with heavy hail": "Enkuba y'omuzira",
  "depositing rime fog": "Olufu",
};

/**
 * Format any English provider condition string into natural, authentic Luganda.
 */
export function formatConditionLg(text: string, isDay = true): string {
  const trimmed = text.trim();
  if (!trimmed) return "Ekiddedde ekitono";

  const key = trimmed.toLowerCase();

  if (key === "clear") {
    return isDay ? "Omusana" : "Butangaavu";
  }

  if (LUGANDA_CONDITIONS_BY_KEY[key]) {
    return LUGANDA_CONDITIONS_BY_KEY[key];
  }

  if (/smok(y|e)|haz(e|y)/.test(key)) return "Olukungu";
  if (/\bmist\b|\bfog\b/.test(key)) return "Olufu";
  if (/hail/.test(key)) return "Enkuba y'omuzira";
  if (/thunder/.test(key)) return key.includes("possible") ? "Kibuyaga asuubirwa" : "Kibuyaga n'eraddu";
  if (/shower/.test(key)) return key.includes("heavy") ? "Enkuba ey'amaanyi" : "Enkuba ey'amatondo";
  if (/drizzle/.test(key)) return key.includes("heavy") ? "Obukubakuba obungi" : "Obukubakuba";
  if (/(patchy|chance|possible).*rain/.test(key) || /rain.*(possible|chance)/.test(key)) return "Enkuba esuubirwa";
  if (/\brain\b/.test(key)) {
    if (key.includes("light")) return "Enkuba etonnyako";
    if (key.includes("heavy")) return "Enkuba ey'amaanyi";
    return "Enkuba";
  }

  return "Ekiddedde ekitono";
}

const WMO_LABELS_LG: Record<number, string> = {
  0: "Butangaavu",
  1: "Butangaavu okusinga",
  2: "Ekiddedde ekitono",
  3: "Ekiddedde",
  45: "Olufu",
  48: "Olufu",
  51: "Obukubakuba",
  53: "Obukubakuba",
  55: "Obukubakuba obungi",
  61: "Enkuba etonnyako",
  63: "Enkuba",
  65: "Enkuba ey'amaanyi",
  71: "Enkuba y'omuzira",
  73: "Enkuba y'omuzira",
  75: "Enkuba y'omuzira",
  80: "Enkuba ey'amatondo",
  81: "Enkuba ey'amatondo",
  82: "Enkuba ey'amaanyi",
  95: "Kibuyaga n'eraddu",
  96: "Enkuba y'omuzira",
  99: "Enkuba y'omuzira",
};

/**
 * Map numerical WMO atmospheric weather codes directly to authentic Luganda terms.
 */
export function wmoLabelLg(wmo: number, isDay = true): string {
  if (wmo === 0) return isDay ? "Omusana" : "Butangaavu";
  return WMO_LABELS_LG[wmo] ?? "Ekiddedde ekitono";
}

const DAY_NAMES_LG: Record<string, string> = {
  today: "Leero",
  tomorrow: "Enkya",
  mon: "Bbalaza",
  monday: "Bbalaza",
  tue: "Olwokubiri",
  tuesday: "Olwokubiri",
  wed: "Olwokusatu",
  wednesday: "Olwokusatu",
  thu: "Olwokuna",
  thursday: "Olwokuna",
  fri: "Olwokutaano",
  friday: "Olwokutaano",
  sat: "Olwomukaaga",
  saturday: "Olwomukaaga",
  sun: "Ssande",
  sunday: "Ssande",
};

const DAY_PREPOSITIONS_LG: Record<string, string> = {
  today: "leero",
  tomorrow: "enkya",
  mon: "ku Bbalaza",
  monday: "ku Bbalaza",
  tue: "ku Lwokubiri",
  tuesday: "ku Lwokubiri",
  wed: "ku Lwokusatu",
  wednesday: "ku Lwokusatu",
  thu: "ku Lwokuna",
  thursday: "ku Lwokuna",
  fri: "ku Lwokutaano",
  friday: "ku Lwokutaano",
  sat: "ku Lwomukaaga",
  saturday: "ku Lwomukaaga",
  sun: "ku Ssande",
  sunday: "ku Ssande",
  leero: "leero",
  enkya: "enkya",
  bbalaza: "ku Bbalaza",
  olwokubiri: "ku Lwokubiri",
  olwokusatu: "ku Lwokusatu",
  olwokuna: "ku Lwokuna",
  olwokutaano: "ku Lwokutaano",
  olwomukaaga: "ku Lwomukaaga",
  ssande: "ku Ssande",
};

/**
 * Format forecast day label into standard Luganda.
 */
export function formatDayLg(dayText: string): string {
  const key = dayText.trim().toLowerCase();
  return DAY_NAMES_LG[key] ?? dayText;
}

/**
 * Format day name with natural Luganda preposition ("Leero", "Enkya", "Ku Bbalaza", "Ku Lwokubiri"...).
 */
export function formatDayPrepositionLg(dayText: string, capitalize = true): string {
  const key = dayText.trim().toLowerCase();
  const phrase = DAY_PREPOSITIONS_LG[key];
  if (!phrase) return formatDayLg(dayText);
  if (!capitalize) return phrase;
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
}

const MOON_PHASE_LG: Record<string, string> = {
  "new moon": "Omwezi omuggya",
  "waxing crescent": "Omwezi ogukula",
  "first quarter": "Ekitundu ekyasooka",
  "waxing gibbous": "Ogusembera okujjula",
  "full moon": "Omwezi ogwijjudde",
  "waning gibbous": "Ogutandise okukendeera",
  "last quarter": "Ekitundu ekyasembayo",
  "waning crescent": "Ogukendeera okuggwaako",
};

export function formatMoonPhaseLg(phase: string): string {
  return MOON_PHASE_LG[phase.trim().toLowerCase()] ?? phase;
}

export function formatHighLowLg(high: number, low: number): string {
  return `Waggulu: ${high}°  Wansi: ${low}°`;
}

export function formatFeelsLikeLg(feelsLike: number): string {
  return `Liwulirwa nga ${feelsLike}°`;
}

export function hoursAheadSummaryLg(weather: WeatherBundle): string {
  const gusts = weather.wind?.gustKph ?? 0;
  const windNote =
    gusts >= 35 ? ` Empewo ey'amaanyi etuuka ku km/h ${Math.round(gusts)}.` : "";

  const upcomingRain = (weather.hourly ?? [])
    .filter((hour) => hour.kind === "hour")
    .slice(0, 12)
    .filter((hour) => (hour.rainChance ?? 0) >= 50);
  if (upcomingRain.length >= 3) {
    return `Enkuba esuubirwa mu ssaawa eziddako.${windNote}`;
  }
  if (upcomingRain.length >= 1) {
    const peak = Math.max(...upcomingRain.map((hour) => hour.rainChance ?? 0));
    return `Enkuba eyinza okutonnya oluvannyuma, okutuuka ku ${peak}%.${windNote}`;
  }

  if (weather.condition.theme === "cloudy" || weather.condition.theme === "partly_cloudy") {
    return `Ebire mu kiseera ky'olunaku ekisigaddeyo.${windNote}`;
  }
  if (weather.condition.theme === "rain" || weather.precipitation.mm > 0) {
    return `Enkuba esuubirwa olunaku lwonna.${windNote}`;
  }
  if (weather.condition.theme === "thunder") {
    return `Kibuyaga asuubirwa. Weegendereze eraddu n'enkuba enkambwe.${windNote}`;
  }
  if (weather.condition.theme === "fog") {
    return `Olufu n'obutalaba bulungi mu makya.${windNote}`;
  }
  if (weather.condition.theme === "clear") {
    return `Obutangaavu mu ssaawa eziddako.${windNote}`;
  }

  const tomorrow = weather.dailyForecast?.[1];
  if (tomorrow && tomorrow.high > weather.temperature.celsius + 2) {
    return `Ebbugumu lyeyongera okutuuka enkya. Ebbugumu liyinza okutuuka ku ${tomorrow.high}°.${windNote}`;
  }

  return `${formatConditionLg(weather.condition.text, weather.isDay ?? true)} mu ssaawa eziddako.${windNote}`;
}

export function formatFeelsLikeFooterLg(diff: number): string {
  if (Math.abs(diff) < 1) {
    return "Liringana n'ebbugumu eririwo ddala kati.";
  }
  if (diff > 0) {
    return `Liwulirwa nga lyeyongeddeko ${diff}° olw'obunnyogovu mu mpewo.`;
  }
  return `Liwulirwa nga likendeddeko ${Math.abs(diff)}° olw'empewo.`;
}

export function formatHumidityFooterLg(humidity: number, dewPoint: number): string {
  if (humidity >= 75) {
    return `Empewo ezitowa olw'obunnyogovu bungi. Ekipimo ky'omume kiri ku ${dewPoint}°.`;
  }
  if (humidity <= 35) {
    return `Empewo nkalu. Nywa amazzi ng'oli ebweru. Ekipimo ky'omume kiri ku ${dewPoint}°.`;
  }
  return `Ekipimo ky'omume kiri ku ${dewPoint}° mu kaseera kano.`;
}

export function formatUvFooterLg(uvIndex: number): string {
  if (uvIndex <= 2) {
    return "Omusana teguli gw'amaanyi mu kiseera ky'olunaku ekisigaddeyo.";
  }
  return "Kozesa ekisiikirize mu ssaawa ez'omusana omungi.";
}

export function formatUvLabelLg(uvIndex: number): string {
  if (uvIndex <= 2) return "Wansi";
  if (uvIndex <= 5) return "Wakati";
  if (uvIndex <= 7) return "Waggulu";
  if (uvIndex <= 10) return "Waggulu nnyo";
  return "Kya bulabe nnyo";
}

export function formatVisibilityFooterLg(km: number): string {
  if (km >= 15) return "Olaba bulungi ddala okwetooloola disitulikiti yonna.";
  if (km >= 8) return "Olaba bulungi mu kutambula n'emirimu gy'ebweru.";
  return "Okulaba kukendedde. Weegendereze ku nguudo.";
}

export function formatPressureFooterLg(diff: number): string {
  return `mb ${diff >= 0 ? "+" : ""}${diff} bw'ogeraageranya n'ekipimo eky'oku nnyanja.`;
}

export function formatPrecipitationFooterLg(mm: number, chance: number): string {
  if (mm > 0) {
    return `Omukisa gw'enkuba okutonnya mu bubaka buno guli ${chance}%.`;
  }
  return "Tewali nkuba esuubirwa leero.";
}

export function formatWindFooterLg(direction: string, degree: number): string {
  const dirLg = formatWindDirectionLg(direction);
  const midSentenceDir = dirLg ? dirLg.charAt(0).toLowerCase() + dirLg.slice(1) : "";
  return `Eva mu ${midSentenceDir} ku diguli ${degree}°.`;
}

export function formatMarineSafetyLg(safety: { label: string; summary: string }): { label: string; summary: string } {
  const lower = safety.label.toLowerCase();
  if (lower.includes("danger")) {
    return {
      label: "Kabi kanene eri amaato amatono",
      summary: "Empewo ya maanyi nnyo n'amayengo ga bulabe. Sooka osigale ku lukalu tosaabala mu kiseera kino.",
    };
  }
  if (lower.includes("safe")) {
    return {
      label: "Tewali mutawaana eri amaato",
      summary: "Amayengo gali wansi, embeera nnungi eri abavubi n'amaato amatono.",
    };
  }
  if (lower.includes("caution")) {
    return {
      label: "Weegendereze ku nnyanja",
      summary: "Empewo n'amayengo biyinza okukaluba. Sigala okumpi n'olubalama we kiba kyetaagisa.",
    };
  }
  if (lower.includes("hazard")) {
    return {
      label: "Omutawaana gw'omuyaga ku nnyanja",
      summary: "Kibuyaga n'amayengo amanene. Amaato amatono galeme kusimbula mu kiseera kino.",
    };
  }
  return safety;
}

const WEEKDAY_NAMES_LG = [
  "Ssande",
  "Bbalaza",
  "Olwokubiri",
  "Olwokusatu",
  "Olwokuna",
  "Olwokutaano",
  "Olwomukaaga",
] as const;

const WEEKDAY_SHORT_LG = ["Ssa", "Bba", "Okb", "Oks", "Okn", "Okt", "Owm"] as const;

const MONTHS_LG = [
  "Gatonnya",
  "Mukutulansanja",
  "Mugulansigo",
  "Kafuumuulampawu",
  "Muzigo",
  "Ssebaaseka",
  "Kasaambula",
  "Muwakanya",
  "Mutunda",
  "Mukulukusabitungotungo",
  "Museenene",
  "Ntenvu",
] as const;

/** Formats YYYY-MM-DD in full Luganda weekday + date + traditional month. */
export function formatFullDateLg(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return dateStr;
  const weekday = WEEKDAY_NAMES_LG[date.getUTCDay()];
  const day = date.getUTCDate();
  const month = MONTHS_LG[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  return `${weekday}, ${day} ${month} ${year}`;
}

export function formatMonthYearLg(year: number, monthIndex: number): string {
  const month = MONTHS_LG[((monthIndex % 12) + 12) % 12];
  return `${month} ${year}`;
}

export function formatShortDateLg(date: Date): string {
  const weekday = WEEKDAY_SHORT_LG[date.getUTCDay()];
  const month = MONTHS_LG[date.getUTCMonth()];
  const day = date.getUTCDate();
  return `${weekday}, ${day} ${month}`;
}

export function formatWeekdayInitialLg(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  return WEEKDAY_SHORT_LG[date.getUTCDay()];
}

const WIND_DIRECTION_LG: Record<string, string> = {
  N: "Mambuka",
  NNE: "Mambuka ga buvanjuba",
  NE: "Mambuka buvanjuba",
  ENE: "Buvanjuba bwa mambuka",
  E: "Buvanjuba",
  ESE: "Buvanjuba bwa maserengeta",
  SE: "Maserengeta buvanjuba",
  SSE: "Maserengeta ga buvanjuba",
  S: "Maserengeta",
  SSW: "Maserengeta ga bugwanjuba",
  SW: "Maserengeta bugwanjuba",
  WSW: "Bugwanjuba bwa maserengeta",
  W: "Bugwanjuba",
  WNW: "Bugwanjuba bwa mambuka",
  NW: "Mambuka bugwanjuba",
  NNW: "Mambuka ga bugwanjuba",
};

export function formatWindDirectionLg(dir: string): string {
  return WIND_DIRECTION_LG[dir.trim().toUpperCase()] ?? dir;
}

const SEASON_PHASE_LABELS_LG: Record<string, string> = {
  planting_time: "Ekiseera ky'okusiga",
  planting_window: "Ekiseera ky'okusiga",
  mid_dry: "Ekiseera ky'ekyeya",
  land_prep: "Okutegeka ennimiro",
};

const SOIL_MOISTURE_LABELS_LG: Record<string, string> = {
  low: "Matono",
  moderate: "Ga kigero",
  high: "Mangi",
};

const CROP_STATUS_LABELS_LG: Record<string, string> = {
  good: "Kirungi",
  caution: "Weekenneenye",
  hold: "Lindako",
};

export function formatSeasonPhaseLg(phase: string): string {
  return SEASON_PHASE_LABELS_LG[phase] ?? phase.replace(/_/g, " ");
}

export function formatSoilMoistureLg(level: string, fallback: string): string {
  return SOIL_MOISTURE_LABELS_LG[level] ?? fallback;
}

export function formatCropStatusLg(status: string, fallback: string): string {
  return CROP_STATUS_LABELS_LG[status] ?? fallback;
}

/** Localizes agro-ecological zone keys to Luganda. */
export function formatAgroZoneLg(zone: string, fallback: string): string {
  const zones: Record<string, string> = {
    banana_coffee: "Ekitundu ky'amatooke n'emmwanyi",
    banana_millet_cotton: "Olubalama lw'Ennyanja Nalubaale",
    karamoja: "Ekitundu kya Karamoja ekikalu",
    northern: "Ettale ly'omu Bukiikakkono",
    west_nile: "West Nile",
    teso: "Ekitundu kya Teso",
    mountain: "Ensozi z'omu Bugwanjuba obwa Bukiikaddyo",
    lake_victoria_basin: "Ekitundu ky'Ennyanja Nalubaale",
    central_woodland: "Ekitundu ky'ebibira eby'omu Masekkati",
    western_highlands: "Ensozi z'omu Bugwanjuba",
    northern_savannah: "Ettale ly'omu Bukiikakkono",
    karamoja_semi_arid: "Ekitundu kya Karamoja ekikalu",
    eastern_lowlands: "Ekitundu ky'omu Buvanjuba",
    albertine_rift: "Ekitundu ky'Ennyanja Mwitanzige",
  };
  return zones[zone] ?? fallback;
}

export function formatSeasonLabelLg(label: string): string {
  const lower = label.toLowerCase();
  if (lower.includes("first rains")) return "Enkuba esooka (Mugulansigo okutuuka mu Muzigo)";
  if (lower.includes("second rains")) return "Enkuba eyookubiri (Mutunda okutuuka mu Museenene)";
  if (lower.includes("short dry")) return "Ekyeya ekitono (Ntenvu okutuuka mu Gatonnya)";
  if (lower.includes("main rains") || lower.includes("wet season")) return "Ekiseera ky'enkuba";
  if (lower.includes("dry season") || lower.includes("dry spell")) return "Ekiseera ky'ekyeya (Ssebaaseka okutuuka mu Muwakanya)";
  return label;
}

const HAZARD_TITLES_LG: Record<string, string> = {
  flood: "Amataba",
  drought: "Ekyeya",
  landslide: "Ettaka okutenguka",
  lightning: "Eraddu",
  hail: "Omuzira",
  heat: "Ebbugumu erisukkiridde",
};

export function formatHazardTitleLg(hazard: string): string {
  return HAZARD_TITLES_LG[hazard.trim().toLowerCase()] ?? hazard;
}

export function localizeAlertForLanguage<
  T extends { id: string; title: string; description: string; source: string },
>(
  alert: T,
  language: "en" | "lg",
  demoCopy: {
    stormTitle: string;
    stormDesc: string;
    landslideTitle: string;
    landslideDesc: string;
    sourceLabel: string;
  },
): T {
  if (language !== "lg") return alert;
  if (alert.id.endsWith("-demo-storm")) {
    return {
      ...alert,
      title: demoCopy.stormTitle,
      description: demoCopy.stormDesc,
      source: demoCopy.sourceLabel,
    };
  }
  if (alert.id.endsWith("-demo-alert")) {
    return {
      ...alert,
      title: demoCopy.landslideTitle,
      description: demoCopy.landslideDesc,
      source: demoCopy.sourceLabel,
    };
  }
  return alert;
}
