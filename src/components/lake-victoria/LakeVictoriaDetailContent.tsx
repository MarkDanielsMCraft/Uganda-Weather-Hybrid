"use client";

import { SheetSection } from "@/components/sheet/SheetSection";
import { LakeHourlyRisk } from "@/components/lake-victoria/LakeHourlyRisk";
import { LakeShorelinePicker } from "@/components/lake-victoria/LakeShorelinePicker";
import { formatDistrictPhrase, useTranslation } from "@/lib/i18n";
import {
  formatConditionLg,
  formatMarineSafetyLg,
  formatWindDirectionLg,
} from "@/lib/weather/copy-lg";
import type { LakeVictoriaConditions } from "@/lib/marine/lake-victoria";
import type { WeatherBundle } from "@/types/weather";

/** Full Lake Victoria body — fishing safety, marine conditions, hourly risk,
    and the shoreline picker — extracted from what used to be a standalone
    page body so it can render inside the shared detail sheet as well as
    (through the same route, once it just redirects into the tile) the
    direct /lake-victoria link. */
export function LakeVictoriaDetailContent({
  weather,
  conditions,
  usingLakeReference,
  homeDistrictName,
  lakeDistrictSlug,
}: {
  weather: WeatherBundle;
  conditions: LakeVictoriaConditions;
  usingLakeReference?: boolean;
  homeDistrictName?: string;
  lakeDistrictSlug: string;
}) {
  const { dict, uiLanguage } = useTranslation();
  const isLg = uiLanguage === "lg";
  const safety = isLg ? formatMarineSafetyLg(conditions.fishingSafety) : conditions.fishingSafety;
  const windDirection = isLg
    ? formatWindDirectionLg(conditions.windDirection)
    : conditions.windDirection;
  const conditionText = isLg
    ? formatConditionLg(weather.condition.text, weather.isDay)
    : weather.condition.text;
  const localizedZone = dict.marine.zones[conditions.zone] ?? conditions.zoneLabel;

  return (
    <div>
      {usingLakeReference && homeDistrictName && (
        <SheetSection>
          <p className="text-[14px] leading-relaxed text-white/60">
            {formatDistrictPhrase(
              dict.marine.nearestShorelineNote,
              homeDistrictName,
              dict,
              uiLanguage,
            ).replace("{zone}", localizedZone)}
          </p>
        </SheetSection>
      )}

      <SheetSection>
        <div className="text-white/85">
          {dict.marine.fishingSafetyPrefix.replace("{label}", safety.label)}
        </div>
        <p className="mt-3 text-[20px] font-medium leading-snug text-white">
          {safety.summary}
        </p>
      </SheetSection>

      <SheetSection>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[13px] font-semibold text-white/55">
              {dict.marine.wavesLabel}
            </p>
            <p className="mt-2 text-[28px] font-light text-white">
              {isLg ? `mita ${conditions.waveHeightM}` : `${conditions.waveHeightM} m`}
            </p>
            <p className="mt-1 text-[14px] text-white/55">{dict.marine.estimatedFromWind}</p>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-white/55">
              {dict.metrics.wind}
            </p>
            <p className="mt-2 text-[28px] font-light text-white">
              {isLg ? (
                <>
                  <span className="mr-1 text-[16px] text-white/70">km/h</span>
                  {conditions.windSpeedKph}
                </>
              ) : (
                <>
                  {conditions.windSpeedKph}
                  <span className="ml-1 text-[16px] text-white/70">km/h</span>
                </>
              )}
            </p>
            <p className="mt-1 text-[14px] text-white/55">{windDirection}</p>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-white/55">
              {dict.marine.waterTempLabel}
            </p>
            <p className="mt-2 text-[28px] font-light text-white">{conditions.waterTempC}°</p>
            <p className="mt-1 text-[14px] text-white/55">{dict.marine.estimatedFromAir}</p>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-white/55">
              {dict.marine.visibilityLabel}
            </p>
            <p className="mt-2 text-[28px] font-light text-white">
              {isLg ? `km ${conditions.visibilityKm}` : `${conditions.visibilityKm} km`}
            </p>
            <p className="mt-1 text-[14px] text-white/55">
              {conditions.hasThunderstorm ? dict.marine.thunderstormsNearby : conditionText}
            </p>
          </div>
        </div>
      </SheetSection>

      <SheetSection>
        <LakeHourlyRisk weather={weather} />
      </SheetSection>

      <SheetSection>
        <LakeShorelinePicker activeSlug={lakeDistrictSlug} />
      </SheetSection>

      <SheetSection>
        <p className="text-[14px] leading-relaxed text-white/72">
          {dict.marine.lakeVictoriaNote}
        </p>
      </SheetSection>
    </div>
  );
}
