"use client";

import { WidgetTile } from "@/components/glass/WidgetTile";
import { MoonDetailContent } from "@/components/weather/MoonDetailContent";
import { useTranslation } from "@/lib/i18n";
import { formatMoonPhaseLg } from "@/lib/weather/copy-lg";
import type { WeatherBundle } from "@/types/weather";

export function MoonWidget({ weather }: { weather: WeatherBundle }) {
  const { dict, uiLanguage } = useTranslation();
  const isLuganda = uiLanguage === "lg";
  const phaseLabel = isLuganda
    ? formatMoonPhaseLg(weather.astronomy.moonPhase)
    : weather.astronomy.moonPhase;
  const footer = isLuganda
    ? `Ekitangaala kiri ku ${weather.astronomy.moonIllumination}% leero ekiro.`
    : `${weather.astronomy.moonIllumination}% illuminated tonight.`;

  const illuminationLabel = isLuganda
    ? `Ekitangaala ${weather.astronomy.moonIllumination}%`
    : `Illumination ${weather.astronomy.moonIllumination}%`;

  return (
    <WidgetTile
      title={dict.metrics.moonPhase}
      footer={footer}
      className={isLuganda ? "min-h-[176px]" : "min-h-[148px]"}
      theme={weather.condition.theme}
      detail={<MoonDetailContent />}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[20px] font-semibold leading-snug text-white">
            {phaseLabel}
          </p>
          <p className="mt-1.5 text-[14px] font-normal leading-snug text-white/80">
            {illuminationLabel}
          </p>
        </div>
        <div className="h-14 w-14 shrink-0 rounded-full bg-gradient-to-br from-[#e8ecf4] to-[#8a96b0] shadow-[inset_-4px_-4px_8px_rgba(0,0,0,0.25)]" />
      </div>
    </WidgetTile>
  );
}
