import type { WeatherTheme } from "@/types/weather";
import { parseUgandaLocalTime } from "@/lib/time/uganda";
import { conditionCodeToTheme } from "./conditions";

/** Map Open-Meteo WMO weather codes to WeatherAPI-style codes for themes/icons. */
export function wmoToWeatherApiCode(wmo: number): number {
  if (wmo === 0) return 1000;
  if (wmo === 1) return 1003;
  if (wmo === 2) return 1003;
  if (wmo === 3) return 1006;
  if (wmo === 45 || wmo === 48) return 1030;
  if (wmo >= 51 && wmo <= 57) return 1153;
  if (wmo >= 61 && wmo <= 67) return 1183;
  if (wmo >= 71 && wmo <= 77) return 1210;
  if (wmo >= 80 && wmo <= 82) return 1240;
  if (wmo === 95) return 1087;
  if (wmo === 96 || wmo === 99) return 1282;
  return 1003;
}

const WMO_LABELS: Record<number, string> = {
  0: "Clear",
  1: "Mostly Clear",
  2: "Partly Cloudy",
  3: "Cloudy",
  45: "Fog",
  48: "Fog",
  51: "Light Drizzle",
  53: "Drizzle",
  55: "Heavy Drizzle",
  61: "Light Rain",
  63: "Rain",
  65: "Heavy Rain",
  71: "Light Snow",
  73: "Snow",
  75: "Heavy Snow",
  80: "Rain Showers",
  81: "Rain Showers",
  82: "Heavy Rain",
  95: "Thunderstorms",
  96: "Thunderstorms",
  99: "Thunderstorms",
};

export function wmoLabel(wmo: number, isDay = true): string {
  // WMO code 0 ("clear sky") is the one code where the label itself is
  // conventionally day/night-aware, "Sunny" in daylight, "Clear" at
  // night for the same condition, matching WeatherAPI's own text and
  // the convention this app otherwise follows.
  if (wmo === 0) return isDay ? "Sunny" : "Clear";
  return WMO_LABELS[wmo] ?? "Partly Cloudy";
}

const WEATHERAPI_ICON_BY_CODE: Record<number, string> = {
  1000: "113",
  1003: "116",
  1006: "119",
  1030: "143",
  1087: "200",
  1153: "266",
  1183: "296",
  1240: "353",
  1282: "200",
  1210: "227",
};

export function weatherApiIconUrl(code: number, isDay: boolean): string {
  const icon = WEATHERAPI_ICON_BY_CODE[code] ?? "116";
  const period = isDay ? "day" : "night";
  return `https://cdn.weatherapi.com/weather/64x64/${period}/${icon}.png`;
}

export function themeFromWmo(wmo: number, isDay: boolean): WeatherTheme {
  return conditionCodeToTheme(wmoToWeatherApiCode(wmo), isDay);
}

export function degreesToCompass(degree: number): string {
  if (!Number.isFinite(degree)) return "N";
  const normalized = ((Math.round(degree / 22.5) % 16) + 16) % 16;
  const directions = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return directions[normalized] ?? "N";
}

export function aqiFromPm25(value?: number | null) {
  if (value == null) {
    return { aqi: 42, category: "Good", advice: "Air quality is satisfactory." };
  }
  if (value <= 12) return { aqi: 40, category: "Good", advice: "Air quality is satisfactory." };
  if (value <= 35) return { aqi: 65, category: "Moderate", advice: "Air quality is acceptable for most people." };
  if (value <= 55) return { aqi: 95, category: "Moderate", advice: "Sensitive groups should limit prolonged outdoor exertion." };
  return { aqi: 130, category: "Unhealthy for Sensitive Groups", advice: "Consider reducing outdoor activity if you are sensitive." };
}

export function moonInfo(date: Date): { phase: string; illumination: number } {
  const lunarCycle = 29.530588853;
  const knownNewMoon = Date.UTC(2000, 0, 6, 18, 14, 0);
  const days = (date.getTime() - knownNewMoon) / 86_400_000;
  const phase = ((days % lunarCycle) + lunarCycle) % lunarCycle;
  const fraction = phase / lunarCycle;
  const illumination = Math.round((1 - Math.cos(fraction * 2 * Math.PI)) / 2 * 100);

  const phases = [
    "New Moon",
    "Waxing Crescent",
    "First Quarter",
    "Waxing Gibbous",
    "Full Moon",
    "Waning Gibbous",
    "Last Quarter",
    "Waning Crescent",
  ];
  const index = Math.floor(((fraction + 0.0625) % 1) * 8);

  return { phase: phases[index] ?? "Waxing Crescent", illumination };
}

function parseClockLabel(value: string) {
  return value.replace(/^0/, "").replace(" AM", " am").replace(" PM", " pm");
}

export function formatSunTime(isoLocal: string): string {
  const normalized = isoLocal.replace("T", " ").slice(0, 16);
  const date = parseUgandaLocalTime(normalized);
  if (Number.isNaN(date.getTime())) return isoLocal;
  return parseClockLabel(
    date.toLocaleTimeString("en-UG", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Africa/Kampala",
    }),
  );
}

export function visibilityKmFromWmo(wmo: number): number {
  if (wmo === 45 || wmo === 48) return 4;
  if (wmo >= 51 && wmo <= 67) return 8;
  if (wmo >= 80 && wmo <= 99) return 7;
  return 12;
}
