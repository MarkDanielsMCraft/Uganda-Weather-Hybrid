"use client";

import { WidgetPanelLike, WidgetTile } from "@/components/glass/WidgetTile";
import { LakeDetailContent } from "@/components/lake/LakeDetailContent";
import { buildLakeConditions, type LakeConfig } from "@/lib/marine/lake-conditions";
import { useLakeConditions } from "@/hooks/useLakeConditions";
import { useTranslation } from "@/lib/i18n";
import { formatMarineSafetyLg } from "@/lib/weather/copy-lg";

/** Generic version of `LakeVictoriaTile` for Kyoga, Albert, and Edward —
    resolves its own reference-shoreline weather bundle the same way,
    parametrized by `LakeConfig` instead of being Victoria-specific. */
export function LakeTile({
  config,
  shoreOverride = null,
}: {
  config: LakeConfig;
  shoreOverride?: string | null;
}) {
  const { dict, uiLanguage } = useTranslation();
  const { weather, waiting, isError, usingLakeReference, homeDistrictName, lakeDistrictSlug } =
    useLakeConditions(config, shoreOverride);

  const lakeName =
    uiLanguage === "lg"
      ? config.key === "victoria"
        ? dict.marine.lakeVictoria
        : config.key === "albert"
          ? dict.marine.lakeAlbert
          : config.key === "kyoga"
            ? dict.marine.lakeKyoga
            : config.key === "edward"
              ? dict.marine.lakeEdward
              : config.name
      : config.name;

  if (waiting) {
    return (
      <WidgetPanelLike className="min-h-[148px]">
        <p className="text-[13px] font-semibold leading-snug text-white/75">
          {lakeName}
        </p>
        <p className="mt-3 text-[14px] font-normal text-white/65">
          {dict.marine.loadingConditions}
        </p>
      </WidgetPanelLike>
    );
  }

  if (isError || !weather) return null;

  const conditions = buildLakeConditions(weather, config);
  const fishingSafety =
    uiLanguage === "lg"
      ? formatMarineSafetyLg(conditions.fishingSafety)
      : conditions.fishingSafety;

  const wavesWindText = dict.marine.wavesAndWind
    .replace("{waves}", String(conditions.waveHeightM))
    .replace("{wind}", String(conditions.windSpeedKph));

  return (
    <WidgetTile
      title={lakeName}
      theme={weather.condition.theme}
      footer={fishingSafety.summary}
      detail={
        <LakeDetailContent
          weather={weather}
          config={config}
          conditions={conditions}
          usingLakeReference={usingLakeReference}
          homeDistrictName={homeDistrictName}
          lakeDistrictSlug={lakeDistrictSlug}
        />
      }
    >
      <p className="text-[20px] font-semibold leading-snug text-white">
        {fishingSafety.label}
      </p>
      <p className="mt-1.5 text-[14px] font-normal leading-snug text-white/80">{wavesWindText}</p>
    </WidgetTile>
  );
}
