import type { District } from "@/types/weather";
import { normalizeWeatherApiAlerts, prepareAlerts } from "@/lib/alerts";
import { formatCondition } from "./copy";
import { weatherApiQueryForDistrict } from "./location-query";
import {
  currentUgandaLocalTimeString,
  formatUgandaTimeLabel,
  parseUgandaLocalTime,
  ugandaNowFromLocalTime,
} from "@/lib/time/uganda";
import { conditionCodeToTheme } from "./conditions";

export { conditionCodeToTheme } from "./conditions";

function parseClockLabel(value: string) {
  return value.replace(/^0/, "").replace(" AM", " am").replace(" PM", " pm");
}

function aqiFromPm25(value?: number) {
  if (!value) return { aqi: 42, category: "Good", advice: "Air quality is satisfactory." };
  if (value <= 12) return { aqi: 40, category: "Good", advice: "Air quality is satisfactory." };
  if (value <= 35) return { aqi: 65, category: "Moderate", advice: "Air quality is acceptable for most people." };
  if (value <= 55) return { aqi: 95, category: "Moderate", advice: "Sensitive groups should limit prolonged outdoor exertion." };
  return { aqi: 130, category: "Unhealthy for Sensitive Groups", advice: "Consider reducing outdoor activity if you are sensitive." };
}

interface WeatherApiBundleResponse {
  location: {
    name: string;
    region: string;
    localtime: string;
    tz_id: string;
  };
  current: {
    temp_c: number;
    feelslike_c: number;
    dewpoint_c: number;
    condition: { code: number; text: string; icon: string };
    wind_kph: number;
    gust_kph: number;
    wind_dir: string;
    wind_degree: number;
    humidity: number;
    uv: number;
    precip_mm: number;
    vis_km: number;
    pressure_mb: number;
    last_updated: string;
    is_day: number;
  };
  forecast: {
    forecastday: Array<{
      date: string;
      day: {
        maxtemp_c: number;
        mintemp_c: number;
        daily_chance_of_rain: number;
        condition: { code: number; text: string; icon: string };
      };
      astro: {
        sunrise: string;
        sunset: string;
        moon_phase: string;
        moon_illumination: string;
      };
      hour: Array<{
        time: string;
        temp_c: number;
        feelslike_c: number;
        dewpoint_c: number;
        is_day: number;
        chance_of_rain?: number;
        condition: { code: number; icon: string };
        uv: number;
        humidity: number;
        wind_kph: number;
        gust_kph: number;
        wind_degree: number;
        vis_km: number;
        pressure_mb: number;
      }>;
    }>;
  };
  alerts?: {
    alert?: Array<{
      headline: string;
      msgtype: string;
      severity: string;
      urgency: string;
      areas: string;
      desc: string;
      effective: string;
      expires: string;
    }>;
  };
}

export async function fetchWeatherApiBundle(district: District, signal?: AbortSignal) {
  const key = process.env.WEATHERAPI_KEY;
  if (!key) throw new Error("WEATHERAPI_KEY not configured");

  const query = weatherApiQueryForDistrict(district);
  const url = new URL("https://api.weatherapi.com/v1/forecast.json");
  url.searchParams.set("key", key);
  url.searchParams.set("q", query);
  url.searchParams.set("days", "10");
  url.searchParams.set("aqi", "yes");
  url.searchParams.set("alerts", "yes");

  const response = await fetch(url, { next: { revalidate: 0 }, signal });
  if (!response.ok) throw new Error(`WeatherAPI error: ${response.status}`);

  const payload = (await response.json()) as WeatherApiBundleResponse;
  const current = payload.current;
  if (!current) throw new Error("WeatherAPI missing current conditions");

  const isDay = current.is_day === 1;
  const rawNowMs = ugandaNowFromLocalTime(payload.location.localtime);
  const realNowMs = Date.now();
  const nowMs =
    Math.abs(realNowMs - rawNowMs) < 2 * 3600_000
      ? Math.max(rawNowMs, realNowMs)
      : rawNowMs;
  const effectiveLocalTime =
    nowMs > rawNowMs
      ? currentUgandaLocalTimeString(new Date(nowMs))
      : payload.location.localtime;
  const today = payload.forecast.forecastday[0];
  const astro = today.astro;

  const currentTheme = conditionCodeToTheme(current.condition.code, isDay);
  const currentIcon = current.condition.icon.replace(/^\/\//, "https://");

  let currentHourRainChance = today.day.daily_chance_of_rain;
  for (const day of payload.forecast.forecastday) {
    for (const hour of day.hour) {
      const hourMs = parseUgandaLocalTime(hour.time).getTime();
      if (hourMs <= nowMs && hour.chance_of_rain != null) {
        currentHourRainChance = hour.chance_of_rain;
      }
    }
  }

  const hourly: import("@/types/weather").HourlyPoint[] = [
    {
      time: effectiveLocalTime,
      label: "Now",
      temp: Math.round(current.temp_c),
      icon: currentIcon,
      theme: currentTheme,
      isDay,
      kind: "hour",
      rainChance: currentHourRainChance,
      uvIndex: Math.round(current.uv),
      windSpeedKph: Math.round(current.wind_kph),
      humidity: current.humidity,
      pressureMb: Math.round(current.pressure_mb),
      visibilityKm: Math.round(current.vis_km),
      feelsLike: Math.round(current.feelslike_c),
      dewPointC: Math.round(current.dewpoint_c),
      gustKph: Math.round(current.gust_kph),
      windDegree: current.wind_degree,
    },
  ];

  for (const day of payload.forecast.forecastday) {
    for (const hour of day.hour) {
      const hourMs = parseUgandaLocalTime(hour.time).getTime();
      if (hourMs <= nowMs) continue;
      if (hourly.length >= 24) break;
      const hourIsDay = hour.is_day === 1;
      hourly.push({
        time: hour.time,
        label: formatUgandaTimeLabel(hour.time),
        temp: Math.round(hour.temp_c),
        icon: hour.condition.icon.replace(/^\/\//, "https://"),
        theme: conditionCodeToTheme(hour.condition.code, hourIsDay),
        isDay: hourIsDay,
        kind: "hour",
        rainChance: hour.chance_of_rain,
        uvIndex: Math.round(hour.uv),
        windSpeedKph: Math.round(hour.wind_kph),
        humidity: hour.humidity,
        pressureMb: Math.round(hour.pressure_mb),
        visibilityKm: Math.round(hour.vis_km),
        feelsLike: Math.round(hour.feelslike_c),
        dewPointC: Math.round(hour.dewpoint_c),
        gustKph: Math.round(hour.gust_kph),
        windDegree: hour.wind_degree,
      });
    }
    if (hourly.length >= 24) break;
  }

  for (const day of payload.forecast.forecastday.slice(0, 2)) {
    if (day.astro?.sunrise) {
      const sunriseTime = `${day.date} ${day.astro.sunrise}`;
      const sunriseMs = parseUgandaLocalTime(sunriseTime).getTime();
      const sunriseIndex = hourly.findIndex(
        (point) => point.kind === "hour" && parseUgandaLocalTime(point.time).getTime() > sunriseMs,
      );
      if (sunriseMs > nowMs && sunriseIndex > 0) {
        hourly.splice(sunriseIndex, 0, {
          time: sunriseTime,
          label: parseClockLabel(day.astro.sunrise),
          temp: 0,
          icon: "",
          kind: "sunrise",
        });
      }
    }

    if (day.astro?.sunset) {
      const sunsetTime = `${day.date} ${day.astro.sunset}`;
      const sunsetMs = parseUgandaLocalTime(sunsetTime).getTime();
      const sunsetIndex = hourly.findIndex(
        (point) => point.kind === "hour" && parseUgandaLocalTime(point.time).getTime() > sunsetMs,
      );
      if (sunsetMs > nowMs && sunsetIndex > 0) {
        hourly.splice(sunsetIndex, 0, {
          time: sunsetTime,
          label: parseClockLabel(day.astro.sunset),
          temp: 0,
          icon: "",
          kind: "sunset",
        });
      }
    }
  }

  const dailyForecast = payload.forecast.forecastday.map((day, index) => {
    const isToday = index === 0;
    const dayCode = isToday ? current.condition.code : day.day.condition.code;
    const dayIcon = isToday
      ? currentIcon
      : day.day.condition.icon.replace(/^\/\//, "https://");

    const hours = day.hour.map((hour) => {
      const hourIsDay = hour.is_day === 1;
      return {
        time: hour.time,
        label: formatUgandaTimeLabel(hour.time),
        temp: Math.round(hour.temp_c),
        icon: hour.condition.icon.replace(/^\/\//, "https://"),
        theme: conditionCodeToTheme(hour.condition.code, hourIsDay),
        isDay: hourIsDay,
        kind: "hour" as const,
        rainChance: hour.chance_of_rain,
        uvIndex: Math.round(hour.uv),
        windSpeedKph: Math.round(hour.wind_kph),
        humidity: hour.humidity,
        pressureMb: Math.round(hour.pressure_mb),
        visibilityKm: Math.round(hour.vis_km),
        feelsLike: Math.round(hour.feelslike_c),
        dewPointC: Math.round(hour.dewpoint_c),
        gustKph: Math.round(hour.gust_kph),
        windDegree: hour.wind_degree,
      };
    });

    return {
      day: isToday ? "Today" : new Date(`${day.date}T12:00:00+03:00`).toLocaleDateString("en-UG", { weekday: "short", timeZone: "Africa/Kampala" }),
      date: day.date,
      high: Math.round(day.day.maxtemp_c),
      low: Math.round(day.day.mintemp_c),
      icon: dayIcon,
      theme: conditionCodeToTheme(dayCode, isToday ? isDay : true),
      isToday,
      rainChance: day.day.daily_chance_of_rain,
      hours,
    };
  });

  const alerts = prepareAlerts(
    normalizeWeatherApiAlerts(district.slug, payload.alerts?.alert),
  );

  const pm25 = (current as { air_quality?: { pm2_5?: number } }).air_quality?.pm2_5;
  const air = aqiFromPm25(pm25);

  return {
    district,
    isDay,
    localTime: payload.location.localtime,
    timezone: payload.location.tz_id || "Africa/Kampala",
    temperature: {
      celsius: Math.round(current.temp_c),
      feelsLike: Math.round(current.feelslike_c),
    },
    condition: {
      code: current.condition.code,
      text: formatCondition(current.condition.text),
      icon: currentIcon,
      theme: currentTheme,
    },
    wind: {
      speedKph: Math.round(current.wind_kph),
      gustKph: Math.round(current.gust_kph),
      direction: current.wind_dir,
      degree: current.wind_degree,
    },
    humidity: current.humidity,
    dewPointC: Math.round(current.dewpoint_c),
    uvIndex: Math.round(current.uv),
    visibilityKm: Math.round(current.vis_km),
    pressureMb: Math.round(current.pressure_mb),
    precipitation: {
      mm: current.precip_mm,
      chance: today.day.daily_chance_of_rain,
    },
    daily: {
      high: Math.round(today.day.maxtemp_c),
      low: Math.round(today.day.mintemp_c),
    },
    hourly,
    dailyForecast,
    astronomy: {
      sunrise: parseClockLabel(astro.sunrise),
      sunset: parseClockLabel(astro.sunset),
      moonPhase: astro.moon_phase,
      moonIllumination: Number(astro.moon_illumination),
    },
    airQuality: {
      aqi: air.aqi,
      category: air.category,
      advice:
        district.slug === "kampala"
          ? `Air quality is similar to recent days in Kampala. ${air.advice}`
          : air.advice,
      pm25: pm25 != null ? Math.round(pm25 * 10) / 10 : undefined,
    },
    alerts,
    updatedAt: parseUgandaLocalTime(current.last_updated).toISOString(),
    source: "weatherapi.com",
    stale: false,
  };
}
