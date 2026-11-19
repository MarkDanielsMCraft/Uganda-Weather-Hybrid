"use client";

import { WidgetTile } from "@/components/glass/WidgetTile";
import { PressureDetailContent } from "@/components/weather/PressureDetailContent";
import { useTranslation } from "@/lib/i18n";
import { formatPressureFooterLg } from "@/lib/weather/copy-lg";
import type { WeatherBundle } from "@/types/weather";

export function PressureWidget({ weather }: { weather: WeatherBundle }) {
  const { dict, uiLanguage } = useTranslation();
  const diff = Math.round(weather.pressureMb - 1013);
  const footer = uiLanguage === "lg"
    ? formatPressureFooterLg(diff)
    : `${diff >= 0 ? "+" : ""}${diff} mb vs. sea-level average.`;

  return (
    <WidgetTile
      title={dict.metrics.pressure}
      footer={footer}
      theme={weather.condition.theme}
      detail={<PressureDetailContent weather={weather} />}
    >
      <p className="text-[34px] font-medium text-white">
        {uiLanguage === "lg" ? (
          <>
            <span className="mr-1 text-[18px] font-normal text-white/75">mb</span>
            {weather.pressureMb}
          </>
        ) : (
          <>
            {weather.pressureMb}
            <span className="ml-1 text-[18px] font-normal text-white/75">mb</span>
          </>
        )}
      </p>
    </WidgetTile>
  );
}
