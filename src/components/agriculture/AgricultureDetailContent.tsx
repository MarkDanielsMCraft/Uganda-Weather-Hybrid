"use client";

import { SheetSection } from "@/components/sheet/SheetSection";
import { WeeklyRainOutlook } from "@/components/agriculture/WeeklyRainOutlook";
import { AGRO_ZONE_DESCRIPTIONS, type AgricultureAdvisory } from "@/lib/agriculture/advisory";
import { useTranslation } from "@/lib/i18n";
import {
  formatAgroZoneLg,
  formatCropStatusLg,
  formatSeasonLabelLg,
  formatSeasonPhaseLg,
  formatSoilMoistureLg,
} from "@/lib/weather/copy-lg";
import type { WeeklyRainDay } from "@/hooks/useAgricultureAdvisory";
import type { WeatherBundle } from "@/types/weather";

const MOISTURE_COLORS = {
  low: "text-[#E07A5F]",
  moderate: "text-caution",
  high: "text-[#1B8A7A]",
};

const CROP_STATUS_TEXT = {
  good: "text-[#1B8A7A]",
  caution: "text-caution",
  hold: "text-white/55",
};

type AdvisoryPayload = AgricultureAdvisory & {
  agroZoneLabel: string;
  weeklyRainChance?: WeeklyRainDay[];
};

/** Full agriculture advisory body — season, soil moisture, crop outlook,
    rain outlook, recommendations — extracted from what used to be a
    standalone page body so it can render inside the shared detail sheet
    as well as (once that route just opens this same tile) the direct
    /agriculture link. Sections sit directly on the sheet's own glass,
    separated by a divider, rather than each wrapped in its own card,
    keeping colour reserved for small accents (a status dot, a number)
    instead of tinting whole boxes. */
export function AgricultureDetailContent({
  weather,
  advisory,
}: {
  weather: WeatherBundle;
  advisory: AdvisoryPayload;
}) {
  const { dict, uiLanguage } = useTranslation();
  const isLg = uiLanguage === "lg";
  const weeklyRain =
    advisory.weeklyRainChance ??
    weather.dailyForecast.slice(0, 7).map((day) => ({
      day: day.day,
      date: day.date,
      rainChance: day.rainChance ?? 0,
    }));

  const weekRainTotal = weeklyRain.reduce((sum, day) => sum + day.rainChance, 0);
  const weekRainAvg = weeklyRain.length > 0 ? Math.round(weekRainTotal / weeklyRain.length) : 0;
  const isPlantingTime =
    advisory.season.phase === "planting_time" || advisory.season.phase === "planting_window";
  const rainfallLabel =
    weather.district.rainfallPattern === "unimodal"
      ? dict.agriculture.unimodal
      : dict.agriculture.bimodal;
  const seasonLabel = isLg ? formatSeasonLabelLg(advisory.season.label) : advisory.season.label;
  const lowerSeasonLabel =
    seasonLabel.charAt(0).toLowerCase() + seasonLabel.slice(1);
  const phaseLabel =
    dict.agriculture.phaseLabels[advisory.season.phase] ??
    (isLg ? formatSeasonPhaseLg(advisory.season.phase) : advisory.season.phase.replace(/_/g, " "));
  const agroZoneLabel = isLg
    ? formatAgroZoneLg(advisory.agroZone, advisory.agroZoneLabel)
    : advisory.agroZoneLabel;
  const soilLabel = isLg
    ? formatSoilMoistureLg(advisory.soilMoisture.level, advisory.soilMoisture.label)
    : advisory.soilMoisture.label;

  return (
    <div>
      {isPlantingTime && (
        <SheetSection label={dict.agriculture.plantingTitle}>
          <p className="text-[16px] leading-relaxed text-white/85">
            {advisory.soilMoisture.level === "low"
              ? dict.agriculture.plantingBuilding
              : dict.agriculture.plantingGood}
          </p>
        </SheetSection>
      )}

      <SheetSection>
        <WeeklyRainOutlook days={weather.dailyForecast} weekAverage={weekRainAvg} />
      </SheetSection>

      <SheetSection label={dict.agriculture.farmingRegionTitle}>
        <p className="text-[22px] font-medium text-white">{agroZoneLabel}</p>
        {(dict.agriculture.zones[advisory.agroZone]?.description ??
          AGRO_ZONE_DESCRIPTIONS[advisory.agroZone]) && (
          <p className="mt-1 text-[14px] leading-relaxed text-white/75">
            {dict.agriculture.zones[advisory.agroZone]?.description ??
              AGRO_ZONE_DESCRIPTIONS[advisory.agroZone]}
          </p>
        )}
        <p className="mt-2 text-[15px] text-white/75">
          {rainfallLabel}, {lowerSeasonLabel}
        </p>
      </SheetSection>

      <SheetSection>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p
              className={
                isLg
                  ? "text-[13px] font-semibold text-white/55"
                  : "text-[13px] font-semibold uppercase tracking-[0.14rem] text-white/45"
              }
            >
              {dict.agriculture.seasonTitle}
            </p>
            <p className="mt-2 text-[17px] font-medium text-white">{seasonLabel}</p>
            <p className="mt-1 text-[14px] text-white/72">
              {phaseLabel}
            </p>
          </div>
          <div>
            <p
              className={
                isLg
                  ? "text-[13px] font-semibold text-white/55"
                  : "text-[13px] font-semibold uppercase tracking-[0.14rem] text-white/45"
              }
            >
              {dict.agriculture.soilMoistureTitle}
            </p>
            <p className={`mt-2 text-[17px] font-medium ${MOISTURE_COLORS[advisory.soilMoisture.level]}`}>
              {soilLabel}
            </p>
            <p className="mt-1 text-[14px] text-white/72">
              {dict.agriculture.todayRainChance
                .replace("{mm}", String(weather.precipitation.mm))
                .replace("{chance}", String(weather.precipitation.chance))}
            </p>
          </div>
        </div>
      </SheetSection>

      <SheetSection label={dict.agriculture.keyCropsTitle}>
        <div className="flex flex-wrap gap-2">
          {advisory.crops.map((crop) => (
            <span
              key={crop}
              className="rounded-full border border-white/12 px-3 py-1 text-[14px] text-white/85"
            >
              {crop}
            </span>
          ))}
        </div>
      </SheetSection>

      {advisory.cropAdvisories.length > 0 && (
        <SheetSection label={dict.agriculture.cropOutlookTitle}>
          <div className="space-y-3">
            {advisory.cropAdvisories.map((crop) => (
              <div key={crop.id}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[15px] font-medium text-white">
                    {crop.name}
                  </span>
                  <span
                    className={`text-[13px] font-medium ${CROP_STATUS_TEXT[crop.status]}`}
                  >
                    {isLg ? formatCropStatusLg(crop.status, crop.statusLabel) : crop.statusLabel}
                  </span>
                </div>
                <p className="mt-1 text-[14px] leading-relaxed text-white/72">{crop.summary}</p>
              </div>
            ))}
          </div>
        </SheetSection>
      )}

      <SheetSection label={dict.agriculture.recommendationsTitle}>
        <ul className="space-y-3 text-[15px] leading-relaxed text-white/78">
          {advisory.recommendations.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-white/40">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </SheetSection>

      <SheetSection>
        <p className="text-[14px] leading-relaxed text-white/60">
          {dict.agriculture.disclaimer}
        </p>
      </SheetSection>
    </div>
  );
}
