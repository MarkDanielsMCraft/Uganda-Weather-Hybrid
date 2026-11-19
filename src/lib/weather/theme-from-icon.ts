import type { WeatherTheme } from "@/types/weather";
import { conditionCodeToTheme } from "./conditions";

/** Infer theme from a WeatherAPI icon URL when theme is not on the point. */
export function themeFromIconUrl(icon: string, isDay = true): WeatherTheme {
  if (!icon) return isDay ? "partly_cloudy" : "night";
  if (/\/(149|248|260|263)\./.test(icon)) return "fog";
  if (/\/(143|1135|1147)\./.test(icon)) return "fog";
  if (!isDay && icon.includes("/night/113")) return "night";
  if (icon.includes("/day/113")) return "clear";
  if (/\/(116|117)\./.test(icon)) return isDay ? "partly_cloudy" : "night";
  if (/\/(119|122)\./.test(icon)) return isDay ? "cloudy" : "night";
  if (/\/(200|386|389|392)\./.test(icon)) return "thunder";
  if (/\/(176|185|263|266|281|284|293|296|299|302|305|308|311|314|317|320|323|326|329|332|335|338|350|353|356|359|362|365|368|371|374|377|386|389|392|395)\./.test(icon)) {
    return "rain";
  }
  if (!isDay) return "night";
  return "partly_cloudy";
}

export function resolveWeatherTheme(
  theme: WeatherTheme | undefined,
  icon: string,
  code?: number,
  isDay = true,
): WeatherTheme {
  if (code !== undefined) return conditionCodeToTheme(code, isDay);
  if (theme) return theme;
  return themeFromIconUrl(icon, isDay);
}
