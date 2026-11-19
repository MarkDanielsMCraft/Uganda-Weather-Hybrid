import type { District } from "@/types/weather";
import { parseUgandaLocalTime } from "@/lib/time/uganda";
import { conditionCodeToTheme } from "./weatherapi";

interface WeatherApiCurrentResponse {
  current: {
    temp_c: number;
    feelslike_c: number;
    condition: { code: number; text: string; icon: string };
    wind_kph: number;
    wind_dir: string;
    wind_degree: number;
    humidity: number;
    uv: number;
    precip_mm: number;
    last_updated: string;
    is_day: number;
  };
}

interface WeatherApiForecastDay {
  day: {
    maxtemp_c: number;
    mintemp_c: number;
  };
}

interface WeatherApiForecastResponse {
  forecast: {
    forecastday: WeatherApiForecastDay[];
  };
}

export async function fetchWeatherApiCurrent(district: District) {
  const key = process.env.WEATHERAPI_KEY;
  if (!key) throw new Error("WEATHERAPI_KEY not configured");

  const query = `${district.coordinates.lat},${district.coordinates.lon}`;
  const url = new URL("https://api.weatherapi.com/v1/current.json");
  url.searchParams.set("key", key);
  url.searchParams.set("q", query);
  url.searchParams.set("aqi", "yes");

  const response = await fetch(url, { next: { revalidate: 0 } });
  if (!response.ok) throw new Error(`WeatherAPI error: ${response.status}`);

  const payload = (await response.json()) as WeatherApiCurrentResponse;
  const forecastUrl = new URL("https://api.weatherapi.com/v1/forecast.json");
  forecastUrl.searchParams.set("key", key);
  forecastUrl.searchParams.set("q", query);
  forecastUrl.searchParams.set("days", "1");
  forecastUrl.searchParams.set("aqi", "no");

  const forecastResponse = await fetch(forecastUrl, { next: { revalidate: 0 } });
  const forecastPayload = forecastResponse.ok
    ? ((await forecastResponse.json()) as WeatherApiForecastResponse)
    : null;

  const day = forecastPayload?.forecast.forecastday[0]?.day;

  return {
    district,
    temperature: {
      celsius: Math.round(payload.current.temp_c),
      feelsLike: Math.round(payload.current.feelslike_c),
    },
    condition: {
      code: payload.current.condition.code,
      text: payload.current.condition.text,
      icon: payload.current.condition.icon.replace(/^\/\//, "https://"),
      theme: conditionCodeToTheme(
        payload.current.condition.code,
        payload.current.is_day === 1,
      ),
    },
    wind: {
      speedKph: Math.round(payload.current.wind_kph),
      gustKph: Math.round(payload.current.wind_kph * 1.4),
      direction: payload.current.wind_dir,
      degree: payload.current.wind_degree,
    },
    humidity: payload.current.humidity,
    uvIndex: Math.round(payload.current.uv),
    visibilityKm: 10,
    pressureMb: 1013,
    precipitation: { mm: payload.current.precip_mm, chance: 0 },
    daily: {
      high: Math.round(day?.maxtemp_c ?? payload.current.temp_c),
      low: Math.round(day?.mintemp_c ?? payload.current.temp_c),
    },
    hourly: [],
    dailyForecast: [],
    astronomy: { sunrise: "6:43 am", sunset: "6:52 pm", moonPhase: "Waning Gibbous", moonIllumination: 78 },
    airQuality: { aqi: 50, category: "Moderate", advice: "" },
    alerts: [],
    updatedAt: parseUgandaLocalTime(payload.current.last_updated).toISOString(),
    source: "weatherapi.com",
    stale: false,
  };
}
