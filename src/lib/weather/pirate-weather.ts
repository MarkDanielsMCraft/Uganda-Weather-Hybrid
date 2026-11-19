import type { District } from "@/types/weather";
import { openMeteoCoordsForDistrict } from "./location-query";
import { conditionCodeToTheme } from "./conditions";
import { formatUgandaClock, formatUgandaTimeLabel, ugandaCalendarDate } from "@/lib/time/uganda";
import { aqiFromPm25, degreesToCompass, moonInfo, weatherApiIconUrl } from "./wmo";

/** Pirate Weather is a Dark Sky compatible API: plain icon strings rather
    than WMO or WeatherAPI numeric codes. Mapped to WeatherAPI-style codes
    so the existing conditionCodeToTheme/weatherApiIconUrl helpers (already
    shared by weatherapi.ts and open-meteo.ts) work unchanged here too. */
function pirateIconToWeatherApiCode(icon: string | undefined): number {
  switch (icon) {
    case "clear-day":
    case "clear-night":
      return 1000;
    case "partly-cloudy-day":
    case "partly-cloudy-night":
      return 1003;
    case "cloudy":
    case "wind":
      return 1006;
    case "fog":
      return 1030;
    case "rain":
      return 1183;
    case "sleet":
      return 1204;
    case "snow":
      return 1210;
    case "thunderstorm":
      return 1087;
    default:
      return 1003;
  }
}

interface PirateWeatherDataPoint {
  time: number;
  icon?: string;
  temperature?: number;
  apparentTemperature?: number;
  humidity?: number;
  dewPoint?: number;
  pressure?: number;
  windSpeed?: number;
  windGust?: number;
  windBearing?: number;
  visibility?: number;
  uvIndex?: number;
  precipIntensity?: number;
  precipProbability?: number;
}

interface PirateWeatherDailyPoint extends PirateWeatherDataPoint {
  temperatureHigh?: number;
  temperatureLow?: number;
  sunriseTime?: number;
  sunsetTime?: number;
}

interface PirateWeatherResponse {
  timezone: string;
  currently: PirateWeatherDataPoint;
  hourly: { data: PirateWeatherDataPoint[] };
  daily: { data: PirateWeatherDailyPoint[] };
}

async function fetchPirateWeatherForecast(
  district: District,
  signal: AbortSignal,
): Promise<PirateWeatherResponse> {
  const key = process.env.PIRATE_WEATHER_API_KEY;
  if (!key) throw new Error("PIRATE_WEATHER_API_KEY not configured");

  const coords = openMeteoCoordsForDistrict(district);
  // "ca" units give Celsius and km/h directly, matching this app's units
  // everywhere else, no conversion math needed.
  const url = `https://api.pirateweather.net/forecast/${key}/${coords.lat},${coords.lon}?units=ca&exclude=minutely,alerts`;

  const USER_AGENT =
    "uganda-weather/1.0 (https://uganda-weather.com; contact@uganda-weather.com)";

  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal,
    next: { revalidate: 0 },
  });
  if (!response.ok) {
    throw new Error(`Pirate Weather error: ${response.status}`);
  }

  return response.json() as Promise<PirateWeatherResponse>;
}

export async function fetchPirateWeatherBundle(district: District, signal: AbortSignal) {
  const payload = await fetchPirateWeatherForecast(district, signal);
  const current = payload.currently;

  const rawNowMs = current.time * 1000;
  const realNowMs = Date.now();
  const nowMs =
    Math.abs(realNowMs - rawNowMs) < 2 * 3600_000
      ? Math.max(rawNowMs, realNowMs)
      : rawNowMs;
  const now = new Date(nowMs);
  const today = payload.daily.data[0];
  const sunriseMs = today?.sunriseTime ? today.sunriseTime * 1000 : nowMs;
  const sunsetMs = today?.sunsetTime ? today.sunsetTime * 1000 : nowMs;
  const isDay = nowMs >= sunriseMs && nowMs < sunsetMs;

  const currentCode = pirateIconToWeatherApiCode(current.icon);
  const currentTheme = conditionCodeToTheme(currentCode, isDay);
  const currentIcon = weatherApiIconUrl(currentCode, isDay);

  const hourly: import("@/types/weather").HourlyPoint[] = [
    {
      time: now.toISOString(),
      label: "Now",
      temp: Math.round(current.temperature ?? 0),
      icon: currentIcon,
      theme: currentTheme,
      isDay,
      kind: "hour",
      rainChance: Math.round((current.precipProbability ?? 0) * 100),
    },
  ];

  for (const point of payload.hourly.data) {
    const pointMs = point.time * 1000;
    if (pointMs <= nowMs) continue;
    if (hourly.length >= 24) break;

    const pointDate = new Date(pointMs);
    const pointIsDay = payload.daily.data.some((day) => {
      if (!day.sunriseTime || !day.sunsetTime) return false;
      return pointMs >= day.sunriseTime * 1000 && pointMs < day.sunsetTime * 1000;
    });
    const pointCode = pirateIconToWeatherApiCode(point.icon);

    hourly.push({
      time: pointDate.toISOString(),
      label: formatUgandaTimeLabel(pointDate.toISOString()),
      temp: Math.round(point.temperature ?? 0),
      icon: weatherApiIconUrl(pointCode, pointIsDay),
      theme: conditionCodeToTheme(pointCode, pointIsDay),
      isDay: pointIsDay,
      kind: "hour",
      rainChance: Math.round((point.precipProbability ?? 0) * 100),
    });
  }

  for (const day of payload.daily.data.slice(0, 2)) {
    if (day.sunriseTime) {
      const daySunriseMs = day.sunriseTime * 1000;
      const sunriseLabel = formatUgandaClock(new Date(daySunriseMs)).replace(" AM", " am").replace(" PM", " pm");
      const sunriseIndex = hourly.findIndex(
        (point) => point.kind === "hour" && new Date(point.time).getTime() > daySunriseMs,
      );
      if (daySunriseMs > nowMs && sunriseIndex > 0) {
        hourly.splice(sunriseIndex, 0, {
          time: new Date(daySunriseMs).toISOString(),
          label: sunriseLabel,
          temp: 0,
          icon: "",
          kind: "sunrise",
        });
      }
    }

    if (day.sunsetTime) {
      const daySunsetMs = day.sunsetTime * 1000;
      const daySunsetLabel = formatUgandaClock(new Date(daySunsetMs)).replace(" AM", " am").replace(" PM", " pm");
      const sunsetIndex = hourly.findIndex(
        (point) => point.kind === "hour" && new Date(point.time).getTime() > daySunsetMs,
      );
      if (daySunsetMs > nowMs && sunsetIndex > 0) {
        hourly.splice(sunsetIndex, 0, {
          time: new Date(daySunsetMs).toISOString(),
          label: daySunsetLabel,
          temp: 0,
          icon: "",
          kind: "sunset",
        });
      }
    }
  }

  const dailyForecast = payload.daily.data.map((day, index) => {
    const isToday = index === 0;
    const dayCode = pirateIconToWeatherApiCode(day.icon);
    const dayDate = new Date(day.time * 1000);
    const dateStr = ugandaCalendarDate(dayDate);
    const daySunriseMs = day.sunriseTime ? day.sunriseTime * 1000 : sunriseMs;
    const daySunsetMs = day.sunsetTime ? day.sunsetTime * 1000 : sunsetMs;

    const hours: import("@/types/weather").HourlyPoint[] = [];
    for (const point of payload.hourly.data) {
      const pointMs = point.time * 1000;
      const pointDate = new Date(pointMs);
      if (ugandaCalendarDate(pointDate) !== dateStr) continue;
      const pointIsDay = pointMs >= daySunriseMs && pointMs < daySunsetMs;
      const pointCode = pirateIconToWeatherApiCode(point.icon);
      hours.push({
        time: pointDate.toISOString(),
        label: formatUgandaTimeLabel(pointDate.toISOString()),
        temp: Math.round(point.temperature ?? 0),
        icon: weatherApiIconUrl(pointCode, pointIsDay),
        theme: conditionCodeToTheme(pointCode, pointIsDay),
        isDay: pointIsDay,
        kind: "hour",
        rainChance: Math.round((point.precipProbability ?? 0) * 100),
      });
    }

    return {
      day: isToday
        ? "Today"
        : dayDate.toLocaleDateString("en-UG", { weekday: "short", timeZone: "Africa/Kampala" }),
      // Kampala's calendar date, not the UTC one. Pirate Weather reports a
      // day as the instant of its local midnight, which for UTC+3 is 21:00
      // the previous day in UTC, so `toISOString()` labelled every entry
      // with yesterday's date while the weekday beside it read correctly.
      date: dateStr,
      high: Math.round(day.temperatureHigh ?? day.temperature ?? 0),
      low: Math.round(day.temperatureLow ?? day.temperature ?? 0),
      icon: isToday ? currentIcon : weatherApiIconUrl(dayCode, true),
      theme: conditionCodeToTheme(dayCode, isToday ? isDay : true),
      isToday,
      rainChance: Math.round((day.precipProbability ?? 0) * 100),
      hours,
    };
  });

  const moon = moonInfo(now);
  const air = aqiFromPm25(undefined);

  return {
    district,
    isDay,
    localTime: now.toISOString(),
    timezone: payload.timezone || "Africa/Kampala",
    temperature: {
      celsius: Math.round(current.temperature ?? 0),
      feelsLike: Math.round(current.apparentTemperature ?? current.temperature ?? 0),
    },
    condition: {
      code: currentCode,
      text: currentTheme === "thunder" ? "Thunderstorms" : currentTheme === "rain" ? "Rain" : isDay ? "Sunny" : "Clear",
      icon: currentIcon,
      theme: currentTheme,
    },
    wind: {
      speedKph: Math.round(current.windSpeed ?? 0),
      gustKph: Math.round(current.windGust ?? current.windSpeed ?? 0),
      direction: degreesToCompass(current.windBearing ?? 0),
      degree: Math.round(current.windBearing ?? 0),
    },
    humidity: Math.round((current.humidity ?? 0.5) * 100),
    dewPointC: Math.round(current.dewPoint ?? current.temperature ?? 0),
    uvIndex: Math.round(current.uvIndex ?? 0),
    visibilityKm: Math.round(current.visibility ?? 10),
    pressureMb: Math.round(current.pressure ?? 1013),
    precipitation: {
      mm: Math.round((current.precipIntensity ?? 0) * 10) / 10,
      chance: Math.round((today?.precipProbability ?? 0) * 100),
    },
    daily: {
      high: Math.round(today?.temperatureHigh ?? current.temperature ?? 0),
      low: Math.round(today?.temperatureLow ?? current.temperature ?? 0),
    },
    hourly,
    dailyForecast,
    astronomy: {
      sunrise: formatUgandaClock(new Date(sunriseMs)).replace(" AM", " am").replace(" PM", " pm"),
      sunset: formatUgandaClock(new Date(sunsetMs)).replace(" AM", " am").replace(" PM", " pm"),
      moonPhase: moon.phase,
      moonIllumination: moon.illumination,
    },
    airQuality: {
      aqi: air.aqi,
      category: air.category,
      advice: air.advice,
      pm25: undefined,
    },
    alerts: [],
    updatedAt: now.toISOString(),
    source: "pirateweather.net",
    stale: false,
  };
}
