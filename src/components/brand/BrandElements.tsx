"use client";

import type { Region } from "@/types/weather";
import { getRegionStyle } from "@/lib/design/regions";
import { useTranslation } from "@/lib/i18n";

export function RegionBadge({ region }: { region: Region }) {
  const { dict, uiLanguage } = useTranslation();
  const style = getRegionStyle(region);
  const localizedRegion = dict.common.regions[region] ?? style.label;
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-[12px] font-medium text-white"
      style={{ backgroundColor: style.soft, border: `1px solid ${style.accent}55` }}
    >
      {uiLanguage === "lg" ? `Ekitundu kya ${localizedRegion}` : `${style.label} Region`}
    </span>
  );
}

export function SectionLabel({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  const { uiLanguage } = useTranslation();
  const isLuganda = uiLanguage === "lg";
  return (
    <div className="mb-3">
      <p
        className={
          isLuganda
            ? "text-on-sky text-[14px] font-semibold text-white/85"
            : "text-on-sky text-[13px] font-semibold uppercase tracking-[0.14rem] text-white/85"
        }
      >
        {title}
      </p>
      {hint && <p className="text-on-sky mt-1 text-[14px] text-white/80">{hint}</p>}
    </div>
  );
}
