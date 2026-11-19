"use client";

import { WidgetPanelLike, WidgetTile } from "@/components/glass/WidgetTile";
import { LakeVictoriaDetailContent } from "@/components/lake-victoria/LakeVictoriaDetailContent";
import { buildLakeVictoriaConditions } from "@/lib/marine/lake-victoria";
import { useLakeVictoriaConditions } from "@/hooks/useLakeVictoriaConditions";
import { useTranslation } from "@/lib/i18n";
import { formatMarineSafetyLg } from "@/lib/weather/copy-lg";

/** Only rendered for lake-zone districts (same `relevantFor` gating
    `modules.ts` already uses for the Lake dock item) — resolves its own
    reference-shoreline weather bundle rather than reusing the home page's
    `weather` prop, since an inland user's home district and their lake
    reference point are two different places. */
export function LakeVictoriaTile({ shoreOverride = null }: { shoreOverride?: string | null }) {
  const { dict, uiLanguage } = useTranslation();
  const { weather, waiting, isError, usingLakeReference, homeDistrictName, lakeDistrictSlug } =
    useLakeVictoriaConditions(shoreOverride);

  const title = uiLanguage === "lg" ? dict.marine.lakeVictoria : "Lake Victoria";

  if (waiting) {
    return (
      <WidgetPanelLike className="min-h-[148px]">
        <p className="text-[13px] font-semibold text-white/80">
          {title}
        </p>
        <p className="mt-3 text-[15px] text-white/55">
          {dict.marine.loadingConditions}
        </p>
      </WidgetPanelLike>
    );
  }

  if (isError || !weather) return null;

  const conditions = buildLakeVictoriaConditions(weather);
  const fishingSafety =
    uiLanguage === "lg"
      ? formatMarineSafetyLg(conditions.fishingSafety)
      : conditions.fishingSafety;

  const wavesWindText = dict.marine.wavesAndWind
    .replace("{waves}", String(conditions.waveHeightM))
    .replace("{wind}", String(conditions.windSpeedKph));

  return (
    <WidgetTile
      title={title}
      theme={weather.condition.theme}
      footer={fishingSafety.summary}
      detail={
        <LakeVictoriaDetailContent
          weather={weather}
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
