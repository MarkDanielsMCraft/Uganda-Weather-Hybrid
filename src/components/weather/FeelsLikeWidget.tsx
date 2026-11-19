"use client";

import { WidgetTile } from "@/components/glass/WidgetTile";
import { FeelsLikeDetailContent } from "@/components/weather/FeelsLikeDetailContent";
import { useTranslation } from "@/lib/i18n";
import { formatFeelsLikeFooterLg } from "@/lib/weather/copy-lg";
import type { WeatherBundle } from "@/types/weather";

export function FeelsLikeWidget({ weather }: { weather: WeatherBundle }) {
  const { dict, uiLanguage } = useTranslation();
  const diff = weather.temperature.feelsLike - weather.temperature.celsius;
  const footer =
    uiLanguage === "lg"
      ? formatFeelsLikeFooterLg(diff)
      : Math.abs(diff) < 1
        ? "Feels the same as the actual temperature right now."
        : diff > 0
          ? `Feels ${diff}° warmer because of humidity.`
          : `Feels ${Math.abs(diff)}° cooler because of the wind.`;

  const title = dict.metrics.feelsLikeTitle;

  return (
    <WidgetTile
      title={title}
      footer={footer}
      theme={weather.condition.theme}
      detail={<FeelsLikeDetailContent weather={weather} />}
    >
      <p className="text-[34px] font-medium text-white">{weather.temperature.feelsLike}°</p>
    </WidgetTile>
  );
}
