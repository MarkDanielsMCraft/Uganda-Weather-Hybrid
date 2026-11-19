import type { WeatherTheme } from "@/types/weather";

/** Mist, haze, smoke, dust, fog — WeatherAPI visibility codes (incl. 1036 smoky haze). */
export function isAtmosphericVisibility(code: number): boolean {
  return (code >= 1030 && code <= 1049) || [1135, 1147].includes(code);
}

function isRainCode(code: number): boolean {
  return (code >= 1063 && code < 1087) || (code >= 1150 && code <= 1282);
}

function isThunderCode(code: number): boolean {
  return [1087, 1273, 1276, 1279, 1282].includes(code);
}

export function conditionCodeToTheme(code: number, isDay = true): WeatherTheme {
  if (isThunderCode(code)) return "thunder";
  if (isRainCode(code)) return "rain";
  if (isAtmosphericVisibility(code)) return "fog";

  if (!isDay) {
    return "night";
  }

  if (code === 1000) return "clear";
  if (code === 1003) return "partly_cloudy";
  if ([1006, 1009].includes(code)) return "cloudy";
  return "partly_cloudy";
}

/** Sky canvas theme — night base when the sun is down (except rain/storm). */
export function sceneThemeFor(
  theme: WeatherTheme,
  isDay: boolean,
): WeatherTheme {
  if (isDay) return theme;
  if (theme === "rain" || theme === "thunder") return theme;
  return "night";
}

export function shouldDrawSun(theme: WeatherTheme, isDay: boolean): boolean {
  if (!isDay) return false;
  return theme === "clear" || theme === "partly_cloudy" || theme === "fog";
}

export function shouldDrawNightSky(theme: WeatherTheme, isDay: boolean): boolean {
  if (isDay) return theme === "night";
  return true;
}

export function shouldDrawFogLayer(theme: WeatherTheme): boolean {
  return theme === "fog";
}
