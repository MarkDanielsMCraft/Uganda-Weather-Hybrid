import type { District, WeatherBundle } from "@/types/weather";
import { currentUgandaLocalTimeString } from "@/lib/time/uganda";
import { reserveQuota } from "@/lib/quota/monthly-budget";
import { fetchWithTimeout, weatherFetchTimeoutMs } from "./fetch-with-timeout";
import { fetchOpenMeteoBundle } from "./open-meteo";
import { fetchPirateWeatherBundle } from "./pirate-weather";
import { fetchWeatherApiBundle } from "./weatherapi";
import {
  DEMO_SCENE_HINT,
  getDemoConditionForDistrict,
  type DemoCondition,
} from "./demo-conditions";
import { prepareAlerts } from "@/lib/alerts";
import { validateWeatherBundle } from "./validate-bundle";

const DAY_NAMES = ["Today", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue"];

const NIGHT_ICON = "https://cdn.weatherapi.com/weather/64x64/night/113.png";
const DAY_CLEAR_ICON = "https://cdn.weatherapi.com/weather/64x64/day/113.png";

function parseClockLabel(label: string): number | null {
  const match = label.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3].toLowerCase();
  if (meridiem === "pm" && hour !== 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function kampalaMinutesOfDay(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Kampala",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

function isNightHour(date: Date, sunsetMinutes: number, sunriseMinutes: number) {
  const minutes = kampalaMinutesOfDay(date);
  return minutes >= sunsetMinutes || minutes < sunriseMinutes;
}

function kampalaInstantForClock(dateStr: string, totalMinutes: number): Date {
  const hh = String(Math.floor(totalMinutes / 60) % 24).padStart(2, "0");
  const mm = String(totalMinutes % 60).padStart(2, "0");
  return new Date(`${dateStr}T${hh}:${mm}:00+03:00`);
}

function buildDemoHourly(baseTemp: number, condition: DemoCondition, sunset: string) {
  const now = new Date();
  const hours: import("@/types/weather").HourlyPoint[] = [];
  const isNightTheme = condition.theme === "night";
  const isStorm = condition.theme === "rain" || condition.theme === "thunder";
  const demoRainChance = isStorm ? 72 : 12;
  const sunsetMinutes = parseClockLabel(sunset) ?? 18 * 60 + 52;
  const sunriseMinutes = 6 * 60 + 43;

  for (let i = 0; i < 24; i += 1) {
    const time = new Date(now);
    time.setHours(now.getHours() + i, 0, 0, 0);
    const nightHour = isNightTheme || isNightHour(time, sunsetMinutes, sunriseMinutes);
    const icon = nightHour
      ? NIGHT_ICON
      : condition.theme === "rain" || condition.theme === "thunder"
        ? condition.icon
        : condition.icon.includes("/night/")
          ? DAY_CLEAR_ICON
          : condition.icon;

    const hourTheme =
      isNightTheme ? "night" : nightHour ? "night" : condition.theme;

    hours.push({
      time: time.toISOString(),
      label: i === 0 ? "Now" : time.toLocaleTimeString("en-UG", { hour: "numeric", hour12: true, timeZone: "Africa/Kampala" }),
      temp: Math.round(baseTemp + Math.sin(i / 2) * 2),
      icon,
      theme: hourTheme,
      isDay: !nightHour,
      kind: "hour",
      rainChance: isStorm ? Math.max(35, demoRainChance - i * 4) : demoRainChance,
    });
  }

  const windowEndMs = now.getTime() + 24 * 3600_000;
  const todayKampala = currentUgandaLocalTimeString(now).slice(0, 10);

  let sunriseToday = kampalaInstantForClock(todayKampala, sunriseMinutes);
  if (sunriseToday.getTime() < now.getTime()) {
    sunriseToday = new Date(sunriseToday.getTime() + 24 * 3600_000);
  }
  if (sunriseToday.getTime() >= now.getTime() && sunriseToday.getTime() <= windowEndMs) {
    const insertAt = hours.findIndex(
      (hour) => hour.kind === "hour" && new Date(hour.time).getTime() >= sunriseToday.getTime(),
    );
    if (insertAt > 0) {
      hours.splice(insertAt, 0, {
        time: sunriseToday.toISOString(),
        label: "6:43 am",
        temp: 0,
        icon: "",
        kind: "sunrise",
      });
    }
  }

  let sunsetToday = kampalaInstantForClock(todayKampala, sunsetMinutes);
  if (sunsetToday.getTime() < now.getTime()) {
    sunsetToday = new Date(sunsetToday.getTime() + 24 * 3600_000);
  }
  if (sunsetToday.getTime() >= now.getTime() && sunsetToday.getTime() <= windowEndMs) {
    const insertAt = hours.findIndex(
      (hour) => hour.kind === "hour" && new Date(hour.time).getTime() >= sunsetToday.getTime(),
    );
    const index = insertAt === -1 ? hours.length : insertAt;
    hours.splice(index, 0, {
      time: sunsetToday.toISOString(),
      label: sunset,
      temp: 0,
      icon: "",
      kind: "sunset",
    });
  }

  return hours;
}

function demoAlerts(district: District, condition: DemoCondition) {
  if (condition.theme === "thunder") {
    return [
      {
        id: `${district.slug}-demo-storm`,
        title: "Thunderstorm Warning",
        description:
          "Thunderstorms with lightning and heavy rain possible. Seek shelter and avoid open ground.",
        severity: "warning" as const,
        source: "Sample Advisory",
        issuedAt: new Date().toISOString(),
      },
    ];
  }

  if (!district.hazards.includes("landslide")) return [];

  return [
    {
      id: `${district.slug}-demo-alert`,
      title: "Heavy Rain and Landslide Risk",
      description:
        "Heavy rainfall may trigger landslides in highland areas. Avoid steep slopes and monitor local advisories.",
      severity: "warning" as const,
      source: "Sample Advisory",
      issuedAt: new Date().toISOString(),
    },
  ];
}

function demoMetrics(condition: DemoCondition, district: District, baseTemp: number) {
  const isStorm = condition.theme === "rain" || condition.theme === "thunder";
  const isNight = condition.theme === "night";

  return {
    wind: {
      speedKph: condition.theme === "thunder" ? 28 : 12,
      gustKph: condition.theme === "thunder" ? 48 : 20,
      direction: condition.theme === "thunder" ? "W" : "E",
      degree: condition.theme === "thunder" ? 260 : 90,
    },
    humidity: condition.theme === "fog" ? 88 : isStorm ? 82 : 58,
    uvIndex: isNight ? 0 : condition.theme === "cloudy" ? 4 : 6,
    visibilityKm: condition.theme === "fog" ? 4 : condition.theme === "rain" ? 7 : 12,
    pressureMb: condition.theme === "thunder" ? 1006 : 1014,
    precipitation: {
      mm: isStorm ? 4.2 : 0,
      chance: isStorm ? 72 : 10,
    },
    airQuality: {
      aqi: district.slug === "kampala" ? 72 : 42,
      category: district.slug === "kampala" ? "Moderate" : "Good",
      advice:
        district.slug === "kampala"
          ? "Air quality is similar to recent days in Kampala."
          : "Air quality is generally good for outdoor activities.",
      pm25: district.slug === "kampala" ? 28 : 8,
    },
    temperature: {
      celsius: Math.round(isNight ? baseTemp - 4 : baseTemp),
      feelsLike: Math.round(isNight ? baseTemp - 3 : baseTemp + 2),
    },
  };
}

function buildDemoDayHours(
  high: number,
  low: number,
  condition: DemoCondition,
  date: string,
): import("@/types/weather").HourlyPoint[] {
  const hours: import("@/types/weather").HourlyPoint[] = [];
  for (let hour = 0; hour < 24; hour += 1) {
    const time = `${date} ${String(hour).padStart(2, "0")}:00`;
    const dayFraction = hour / 24;
    const temp = Math.round(low + (high - low) * Math.sin((dayFraction - 0.25) * Math.PI));
    const nightHour = hour < 6 || hour >= 19;
    hours.push({
      time,
      label: new Date(`${date}T${String(hour).padStart(2, "0")}:00:00+03:00`).toLocaleTimeString(
        "en-UG",
        { hour: "numeric", hour12: true, timeZone: "Africa/Kampala" },
      ),
      temp,
      icon: nightHour && condition.theme !== "rain" && condition.theme !== "thunder"
        ? NIGHT_ICON
        : condition.icon,
      theme: nightHour && condition.theme !== "rain" && condition.theme !== "thunder"
        ? "night"
        : condition.theme,
      isDay: !nightHour,
      kind: "hour",
    });
  }
  return hours;
}

function buildDemoBundle(district: District, hadLiveProvider: boolean) {
  const baseCondition = getDemoConditionForDistrict(district.slug);
  const now = new Date();
  const isKampalaNight = isNightHour(now, 18 * 60 + 52, 6 * 60 + 43);
  const condition: DemoCondition =
    isKampalaNight && baseCondition.theme !== "rain" && baseCondition.theme !== "thunder"
      ? {
          ...baseCondition,
          icon: NIGHT_ICON,
          theme: "night",
        }
      : baseCondition;
  const baseTemp = 24 + district.coordinates.lat * 2;
  const metrics = demoMetrics(condition, district, baseTemp);
  const demoIsDay = !isKampalaNight && condition.theme !== "night";
  const today = currentUgandaLocalTimeString(now).slice(0, 10);

  const dailyForecast = DAY_NAMES.map((day, dayIndex) => {
    const date = new Date(`${today}T12:00:00+03:00`);
    date.setDate(date.getDate() + dayIndex);
    const dateStr = date.toISOString().slice(0, 10);
    const high = Math.round(baseTemp + 4 - dayIndex * 0.6);
    const low = Math.round(baseTemp - 3 - dayIndex * 0.5);

    return {
      day,
      date: dateStr,
      high,
      low,
      icon: condition.icon,
      theme: condition.theme,
      isToday: dayIndex === 0,
      rainChance: metrics.precipitation.chance,
      hours: buildDemoDayHours(high, low, condition, dateStr),
    };
  });

  return {
    district,
    isDay: demoIsDay,
    localTime: currentUgandaLocalTimeString(),
    timezone: "Africa/Kampala",
    temperature: metrics.temperature,
    condition,
    wind: metrics.wind,
    humidity: metrics.humidity,
    uvIndex: metrics.uvIndex,
    visibilityKm: metrics.visibilityKm,
    pressureMb: metrics.pressureMb,
    precipitation: metrics.precipitation,
    daily: {
      high: dailyForecast[0].high,
      low: dailyForecast[0].low,
    },
    hourly: buildDemoHourly(baseTemp, condition, "6:52 pm"),
    dailyForecast,
    astronomy: {
      sunrise: "6:43 am",
      sunset: "6:52 pm",
      moonPhase: condition.theme === "night" ? "Waning Gibbous" : "Waxing Crescent",
      moonIllumination: condition.theme === "night" ? 78 : 42,
    },
    airQuality: metrics.airQuality,
    alerts: prepareAlerts(demoAlerts(district, condition)),
    updatedAt: new Date().toISOString(),
    source: hadLiveProvider ? "demo-fallback" : "demo",
    stale: false,
    demoHint: DEMO_SCENE_HINT,
  };
}

async function tryWeatherApi(district: District) {
  if (!process.env.WEATHERAPI_KEY) return null;

  try {
    return await fetchWithTimeout(
      (signal) => fetchWeatherApiBundle(district, signal),
      weatherFetchTimeoutMs("primary"),
    );
  } catch (error) {
    console.error(`WeatherAPI failed for ${district.slug}:`, error);
    return null;
  }
}

async function tryOpenMeteo(district: District, asFallback: boolean) {
  try {
    return await fetchWithTimeout(
      (signal) => fetchOpenMeteoBundle(district, signal, { asFallback }),
      weatherFetchTimeoutMs("fallback"),
    );
  } catch (error) {
    console.error(`Open-Meteo failed for ${district.slug}:`, error);
    return null;
  }
}

// Third tier, only reached when both WeatherAPI and Open-Meteo fail for
// the same request — that intersection should be a small slice of total
// traffic, well inside Pirate Weather's 20k/month free tier. Guarded with
// a slightly conservative budget anyway so a genuinely unusual failure
// spike degrades to the demo bundle instead of silently running up calls.
const PIRATE_WEATHER_MONTHLY_BUDGET = 19_000;

async function tryPirateWeather(district: District) {
  if (!process.env.PIRATE_WEATHER_API_KEY) return null;

  const allowed = await reserveQuota("pirate-weather", PIRATE_WEATHER_MONTHLY_BUDGET);
  if (!allowed) {
    console.error(`Pirate Weather monthly budget exhausted, skipping for ${district.slug}`);
    return null;
  }

  try {
    return await fetchWithTimeout(
      (signal) => fetchPirateWeatherBundle(district, signal),
      weatherFetchTimeoutMs("fallback"),
    );
  } catch (error) {
    console.error(`Pirate Weather failed for ${district.slug}:`, error);
    return null;
  }
}

/** How many days the forecast card offers. */
export const FORECAST_DAYS = 10;

/**
 * WeatherAPI is asked for ten days but its free plan silently returns three,
 * so a perfectly healthy primary bundle arrives with a third of the forecast
 * the card promises. Open-Meteo is keyless, free, and already asked for ten,
 * so the missing tail is taken from there rather than left short.
 *
 * The primary's own days always win for the overlap: it stays the source of
 * truth for the near term, and only dates it did not return are appended. If
 * the top up fails the short forecast is returned unchanged, since a shorter
 * forecast is much better than no weather at all.
 */
async function topUpDailyForecast(bundle: WeatherBundle, district: District) {
  if (bundle.dailyForecast.length >= FORECAST_DAYS) return bundle;

  let donor: WeatherBundle | null = await tryOpenMeteo(district, false);
  if (!donor || donor.dailyForecast.length <= bundle.dailyForecast.length) {
    donor = await tryPirateWeather(district);
  }
  if (!donor) return bundle;

  const covered = new Set(
    bundle.dailyForecast.map((day) => day.date).filter((date): date is string => Boolean(date)),
  );
  const tail = donor.dailyForecast.filter((day) => day.date && !covered.has(day.date));
  if (tail.length === 0) return bundle;

  return {
    ...bundle,
    dailyForecast: [...bundle.dailyForecast, ...tail].slice(0, FORECAST_DAYS),
  };
}

/**
 * Whether a locally generated bundle may stand in for a real one.
 *
 * Never in production. A fallback exists to reach a different provider, not
 * to invent numbers: WeatherAPI and Open-Meteo (in the configured order), then
 * Pirate Weather are all tried first, and if every one of them fails then the honest answer is that
 * the weather is unavailable. The routes turn the thrown error into a 503 and
 * the UI into its existing retry state, which is a truthful empty rather than
 * a plausible looking figure nobody can tell apart from a measurement.
 *
 * Local development keeps the synthetic bundle so the app runs without keys
 * or network. Read at call time rather than captured at module load so tests
 * can exercise both paths.
 */
function syntheticWeatherAllowed() {
  return process.env.NODE_ENV !== "production";
}

/**
 * `fullForecast: false` skips the daily top up for callers that only read the
 * current conditions. The chips and points routes fan out over ten or more
 * places at once, and topping each one up would double their outbound calls
 * to fill in a forecast they then throw away. Worse, more concurrent calls
 * means more of them hitting the provider's rate limit and degrading to the
 * demo bundle, which is the opposite of what the top up is for.
 */
export type PrimaryWeatherProvider = "weatherapi" | "open-meteo";

/** Which provider is asked first. Defaults to WeatherAPI. Setting
    WEATHER_PRIMARY_PROVIDER=open-meteo puts the keyless Open-Meteo first and
    keeps WeatherAPI as the backup, so a deployment can choose its order
    without a code change. Read at call time so tests can switch it. */
export function readPrimaryWeatherProvider(): PrimaryWeatherProvider {
  return process.env.WEATHER_PRIMARY_PROVIDER?.trim().toLowerCase() === "open-meteo"
    ? "open-meteo"
    : "weatherapi";
}

async function tryWeatherApiWithTopUp(district: District, fullForecast: boolean) {
  const bundle = await tryWeatherApi(district);
  if (!bundle) return null;
  return fullForecast ? topUpDailyForecast(bundle, district) : bundle;
}

export async function getWeatherBundleForDistrict(
  district: District,
  { fullForecast = true }: { fullForecast?: boolean } = {},
) {
  const hadLiveProvider = Boolean(process.env.WEATHERAPI_KEY);
  const openMeteoFirst = readPrimaryWeatherProvider() === "open-meteo";

  const attempts = openMeteoFirst
    ? [() => tryOpenMeteo(district, false), () => tryWeatherApiWithTopUp(district, fullForecast)]
    : [() => tryWeatherApiWithTopUp(district, fullForecast), () => tryOpenMeteo(district, hadLiveProvider)];

  for (const attempt of attempts) {
    const bundle = await attempt();
    if (bundle) {
      validateWeatherBundle(bundle, district.slug);
      return bundle;
    }
  }

  const tertiary = await tryPirateWeather(district);
  if (tertiary) {
    validateWeatherBundle(tertiary, district.slug);
    return tertiary;
  }

  if (!syntheticWeatherAllowed()) {
    throw new Error(
      `Every weather provider failed for ${district.slug}; refusing to serve synthetic data`,
    );
  }

  const demo = buildDemoBundle(district, hadLiveProvider);
  validateWeatherBundle(demo, district.slug);
  return demo;
}

export async function getCurrentWeatherForDistrict(district: District) {
  return getWeatherBundleForDistrict(district);
}
