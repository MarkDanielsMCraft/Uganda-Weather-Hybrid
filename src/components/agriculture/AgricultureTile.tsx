"use client";

import { WidgetTile } from "@/components/glass/WidgetTile";
import { AgricultureDetailContent } from "@/components/agriculture/AgricultureDetailContent";
import { buildAgricultureAdvisory } from "@/lib/agriculture/advisory";
import { useTranslation } from "@/lib/i18n";
import type { WeatherBundle } from "@/types/weather";

/** Built entirely from the same weather bundle already loaded for the
    home page, no extra fetch — buildAgricultureAdvisory is a pure, fast,
    local computation (season calendar + current conditions), same one
    AgricultureView already fell back to when the richer API advisory
    hadn't loaded yet, so the tile can just use it directly. */
export function AgricultureTile({ weather }: { weather: WeatherBundle }) {
  const { dict, uiLanguage } = useTranslation();
  const isLg = uiLanguage === "lg";
  const advisory = buildAgricultureAdvisory(weather, uiLanguage);
  const agroZoneLabel =
    dict.agriculture.zones[advisory.agroZone]?.label ?? advisory.agroZoneLabel;
  const topCrops = advisory.crops
    .slice(0, 3)
    .map((crop) => (!isLg && crop.startsWith("Irish") ? crop : crop.toLowerCase()))
    .join(", ");

  const moistureSentence = dict.agriculture.soilSentences[advisory.soilMoisture.level];

  return (
    <WidgetTile
      title={dict.agriculture.title}
      theme={weather.condition.theme}
      footer={`${advisory.season.label}. ${moistureSentence}`}
      detail={<AgricultureDetailContent weather={weather} advisory={{ ...advisory, agroZoneLabel }} />}
    >
      <p className="text-[20px] font-semibold leading-snug text-white">
        {agroZoneLabel}
      </p>
      <p className="mt-1.5 text-[14px] font-normal leading-snug text-white/80">
        {dict.agriculture.mainCropsPrefix}{topCrops}
      </p>
    </WidgetTile>
  );
}
