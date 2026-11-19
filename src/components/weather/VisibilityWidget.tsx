"use client";

import { WidgetTile } from "@/components/glass/WidgetTile";
import { VisibilityDetailContent } from "@/components/weather/VisibilityDetailContent";
import { useTranslation } from "@/lib/i18n";
import { formatVisibilityFooterLg } from "@/lib/weather/copy-lg";
import type { WeatherBundle } from "@/types/weather";

export function visibilityCopy(km: number): string {
  if (km >= 15) return "Perfectly clear view across the district.";
  if (km >= 8) return "Good visibility for travel and outdoor work.";
  return "Reduced visibility. Take care on roads.";
}

export function VisibilityWidget({ weather }: { weather: WeatherBundle }) {
  const { dict, uiLanguage } = useTranslation();
  const footer = uiLanguage === "lg"
    ? formatVisibilityFooterLg(weather.visibilityKm)
    : visibilityCopy(weather.visibilityKm);

  return (
    <WidgetTile
      title={dict.metrics.visibility}
      footer={footer}
      theme={weather.condition.theme}
      detail={<VisibilityDetailContent weather={weather} />}
    >
      <p className="text-[34px] font-medium text-white">
        {uiLanguage === "lg" ? `km ${weather.visibilityKm}` : `${weather.visibilityKm} km`}
      </p>
    </WidgetTile>
  );
}
