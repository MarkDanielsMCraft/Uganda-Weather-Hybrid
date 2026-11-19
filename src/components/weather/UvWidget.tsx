"use client";

import { ScaleBar, WidgetTile } from "@/components/glass/WidgetTile";
import { UvDetailContent } from "@/components/weather/UvDetailContent";
import { useTranslation } from "@/lib/i18n";
import { formatUvFooterLg, formatUvLabelLg } from "@/lib/weather/copy-lg";
import type { WeatherBundle } from "@/types/weather";

export function uvLabel(value: number): string {
  if (value <= 2) return "Low";
  if (value <= 5) return "Moderate";
  if (value <= 7) return "High";
  return "Very High";
}

export function UvWidget({ weather }: { weather: WeatherBundle }) {
  const { dict, uiLanguage } = useTranslation();
  const isLuganda = uiLanguage === "lg";
  const label = isLuganda ? formatUvLabelLg(weather.uvIndex) : uvLabel(weather.uvIndex);
  const footer = isLuganda
    ? formatUvFooterLg(weather.uvIndex)
    : weather.uvIndex <= 2
      ? "Low UV for the rest of the day."
      : "Use shade during the brightest hours.";

  return (
    <WidgetTile
      title={dict.metrics.uvIndex}
      footer={footer}
      theme={weather.condition.theme}
      detail={<UvDetailContent weather={weather} />}
    >
      <p
        className={`flex flex-wrap items-baseline gap-x-2 font-medium leading-tight text-white ${
          isLuganda ? "text-[30px]" : "text-[34px]"
        }`}
      >
        <span>{weather.uvIndex}</span>
        <span
          className={`font-normal text-white/80 ${
            isLuganda ? "text-[17px] leading-snug" : "text-[20px]"
          }`}
        >
          {label}
        </span>
      </p>
      <ScaleBar value={weather.uvIndex} max={11} colors="from-[#5ac8fa] via-caution to-[#E07A5F]" />
    </WidgetTile>
  );
}
