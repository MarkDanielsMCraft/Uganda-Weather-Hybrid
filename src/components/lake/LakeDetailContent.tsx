"use client";

import { SheetSection } from "@/components/sheet/SheetSection";
import { LakeHourlyRisk } from "@/components/lake-victoria/LakeHourlyRisk";
import { LakeShorelinePicker } from "@/components/lake/LakeShorelinePicker";
import { formatDistrictPhrase, useTranslation } from "@/lib/i18n";
import {
  formatConditionLg,
  formatMarineSafetyLg,
  formatWindDirectionLg,
} from "@/lib/weather/copy-lg";
import type { LakeConditions, LakeConfig } from "@/lib/marine/lake-conditions";
import type { WeatherBundle } from "@/types/weather";

/** Generic version of `LakeVictoriaDetailContent` for Kyoga, Albert, and
    Edward — same body (fishing safety, marine conditions, hourly risk,
    shoreline picker), parametrized by `LakeConfig` for the lake's own
    name and shoreline list. */
export function LakeDetailContent({
  weather,
  config,
  conditions,
  usingLakeReference,
  homeDistrictName,
  lakeDistrictSlug,
}: {
  weather: WeatherBundle;
  config: LakeConfig;
  conditions: LakeConditions;
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
  const lakeNameMap: Record<string, string> = {
    victoria: dict.marine.lakeVictoria,
    kyoga: dict.marine.lakeKyoga,
    albert: dict.marine.lakeAlbert,
    edward: dict.marine.lakeEdward,
    "lake-victoria": dict.marine.lakeVictoria,
    "lake-kyoga": dict.marine.lakeKyoga,
    "lake-albert": dict.marine.lakeAlbert,
    "lake-edward": dict.marine.lakeEdward,
  };
  const localizedLakeName = lakeNameMap[config.key] ?? config.name;

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
            <p
              className={
                isLg
                  ? "text-[13px] font-semibold text-white/55"
                  : "text-[13px] font-semibold uppercase tracking-[0.14rem] text-white/45"
              }
            >
              {dict.marine.wavesLabel}
            </p>
            <p className="mt-2 text-[28px] font-light text-white">
              {isLg ? `mita ${conditions.waveHeightM}` : `${conditions.waveHeightM} m`}
            </p>
            <p className="mt-1 text-[14px] text-white/55">{dict.marine.estimatedFromWind}</p>
          </div>
          <div>
            <p
              className={
                isLg
                  ? "text-[13px] font-semibold text-white/55"
                  : "text-[13px] font-semibold uppercase tracking-[0.14rem] text-white/45"
              }
            >
              {dict.metrics.wind}
            </p>
            <p className="mt-2 text-[28px] font-light text-white">
              {isLg ? (
                <>
                  <span className="text-[16px] text-white/70">km/h</span>{" "}
                  {conditions.windSpeedKph}
                </>
              ) : (
                <>
                  {conditions.windSpeedKph}{" "}
                  <span className="text-[16px] text-white/70">km/h</span>
                </>
              )}
            </p>
            <p className="mt-1 text-[14px] text-white/55">{windDirection}</p>
          </div>
          <div>
            <p
              className={
                isLg
                  ? "text-[13px] font-semibold text-white/55"
                  : "text-[13px] font-semibold uppercase tracking-[0.14rem] text-white/45"
              }
            >
              {dict.marine.waterTempLabel}
            </p>
            <p className="mt-2 text-[28px] font-light text-white">{conditions.waterTempC}°</p>
            <p className="mt-1 text-[14px] text-white/55">{dict.marine.estimatedFromAir}</p>
          </div>
          <div>
            <p
              className={
                isLg
                  ? "text-[13px] font-semibold text-white/55"
                  : "text-[13px] font-semibold uppercase tracking-[0.14rem] text-white/45"
              }
            >
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

      {config.shorelineDistricts.length > 1 && (
        <SheetSection>
          <LakeShorelinePicker config={config} activeSlug={lakeDistrictSlug} />
        </SheetSection>
      )}

      <SheetSection>
        <p className="text-[14px] leading-relaxed text-white/72">
          {dict.marine.lakeGeneralNote.replace("{lake}", localizedLakeName)}
        </p>
      </SheetSection>
    </div>
  );
}
