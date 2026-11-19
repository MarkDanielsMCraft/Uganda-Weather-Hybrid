"use client";

import { WidgetTile } from "@/components/glass/WidgetTile";
import { RainfallDetailContent } from "@/components/weather/RainfallDetailContent";
import { useTranslation } from "@/lib/i18n";
import { formatPrecipitationFooterLg } from "@/lib/weather/copy-lg";
import type { WeatherBundle } from "@/types/weather";

export function PrecipitationWidget({ weather }: { weather: WeatherBundle }) {
  const { dict, uiLanguage } = useTranslation();
  const footer =
    uiLanguage === "lg"
      ? formatPrecipitationFooterLg(weather.precipitation.mm, weather.precipitation.chance)
      : weather.precipitation.mm > 0
        ? `${weather.precipitation.chance}% chance of rain in the forecast.`
        : "No rain expected today.";

  return (
    <WidgetTile
      title={uiLanguage === "lg" ? dict.metrics.rainfall : "Precipitation"}
      footer={footer}
      theme={weather.condition.theme}
      detail={<RainfallDetailContent weather={weather} />}
    >
      <p className="flex flex-wrap items-baseline gap-x-2 text-[34px] font-medium leading-tight text-white">
        <span>{uiLanguage === "lg" ? `mm ${weather.precipitation.mm}` : `${weather.precipitation.mm} mm`}</span>
        <span className={`${uiLanguage === "lg" ? "text-[17px]" : "text-[18px]"} font-normal text-white/75`}>
          {dict.common.today}
        </span>
      </p>
    </WidgetTile>
  );
}
