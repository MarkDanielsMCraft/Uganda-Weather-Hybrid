"use client";

import { WidgetTile } from "@/components/glass/WidgetTile";
import { HumidityDetailContent } from "@/components/weather/HumidityDetailContent";
import { useTranslation } from "@/lib/i18n";
import { formatHumidityFooterLg } from "@/lib/weather/copy-lg";
import type { WeatherBundle } from "@/types/weather";

/** Magnus-Tetens approximation, the standard formula for converting
    temperature and relative humidity into a dew point. More accurate than
    reading dew point off humidity percentage alone, since the same
    humidity means very different dew points at different temperatures. */
export function dewPointCelsius(tempC: number, humidityPercent: number): number {
  const a = 17.27;
  const b = 237.7;
  const clampedHumidity = Math.min(100, Math.max(1, humidityPercent));
  const alpha = (a * tempC) / (b + tempC) + Math.log(clampedHumidity / 100);
  return Math.round((b * alpha) / (a - alpha));
}

export function humidityCopy(weather: WeatherBundle): string {
  const dewPoint = weather.dewPointC ?? dewPointCelsius(weather.temperature.celsius, weather.humidity);
  if (weather.humidity >= 75) return `The air feels heavy and close. Dew point ${dewPoint}°.`;
  if (weather.humidity <= 35) return `Dry air. Hydration matters outdoors. Dew point ${dewPoint}°.`;
  return `The dew point is ${dewPoint}° right now.`;
}

export function HumidityWidget({ weather }: { weather: WeatherBundle }) {
  const { dict, uiLanguage } = useTranslation();
  const dewPoint = weather.dewPointC ?? dewPointCelsius(weather.temperature.celsius, weather.humidity);
  const footer = uiLanguage === "lg"
    ? formatHumidityFooterLg(weather.humidity, dewPoint)
    : humidityCopy(weather);

  return (
    <WidgetTile
      title={dict.metrics.humidity}
      footer={footer}
      theme={weather.condition.theme}
      detail={<HumidityDetailContent weather={weather} />}
    >
      <p className="text-[34px] font-medium text-white">{weather.humidity}%</p>
    </WidgetTile>
  );
}
