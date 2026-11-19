import { WeatherThemeIcon, IconSunset, IconSunrise } from "@/components/icons/weather-icons";
import { resolveWeatherTheme } from "@/lib/weather/theme-from-icon";
import type { WeatherTheme } from "@/types/weather";

export function WeatherIcon({
  theme,
  icon,
  code,
  isDay,
  kind = "hour",
  size = 24,
  className,
  animated,
}: {
  theme?: WeatherTheme;
  icon?: string;
  code?: number;
  isDay?: boolean;
  kind?: "hour" | "sunset" | "sunrise";
  size?: number;
  className?: string;
  animated?: boolean;
}) {
  if (kind === "sunrise") {
    return <IconSunrise size={size} className={className} />;
  }

  if (kind === "sunset") {
    return <IconSunset size={size} className={className} />;
  }

  const resolved = resolveWeatherTheme(theme, icon ?? "", code, isDay ?? true);
  return <WeatherThemeIcon theme={resolved} size={size} className={className} animated={animated} />;
}
