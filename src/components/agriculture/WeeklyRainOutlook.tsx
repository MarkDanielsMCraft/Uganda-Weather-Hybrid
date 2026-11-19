"use client";

import { useTranslation } from "@/lib/i18n";
import { formatDayLg } from "@/lib/weather/copy-lg";
import type { DailyPoint } from "@/types/weather";

export function WeeklyRainOutlook({
  days,
  weekAverage,
}: {
  days: DailyPoint[];
  weekAverage?: number;
}) {
  const { dict, uiLanguage } = useTranslation();
  const isLg = uiLanguage === "lg";
  const outlook = days.slice(0, 7);
  if (outlook.length === 0) return null;

  const maxChance = Math.max(...outlook.map((day) => day.rainChance ?? 0), 1);
  const average =
    weekAverage ??
    Math.round(
      outlook.reduce((sum, day) => sum + (day.rainChance ?? 0), 0) / Math.max(outlook.length, 1),
    );

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <p
          className={
            isLg
              ? "text-[13px] font-semibold text-white/55"
              : "text-[13px] font-semibold uppercase tracking-[0.14rem] text-white/45"
          }
        >
          {dict.agriculture.weeklyTitle}
        </p>
        <p className="text-[13px] text-white/55">
          {dict.agriculture.avgChance.replace("{avg}", String(average))}
        </p>
      </div>
      {isLg ? (
        <div className="mt-3 space-y-2">
          {outlook.map((day) => {
            const chance = day.rainChance ?? 0;
            const widthPct = Math.max(8, Math.round((chance / maxChance) * 100));
            return (
              <div
                key={day.day}
                className="flex items-center gap-2.5 text-[13px]"
                title={dict.agriculture.rainChanceTooltip.replace("{chance}", String(chance))}
              >
                <span className="w-[6rem] shrink-0 text-white/85 whitespace-nowrap">
                  {formatDayLg(day.day)}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[#5ac8fa]"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
                <span className="w-9 shrink-0 text-right font-medium text-[#5ac8fa]">
                  {chance}%
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-7 gap-2">
          {outlook.map((day) => {
            const chance = day.rainChance ?? 0;
            const height = Math.max(8, Math.round((chance / maxChance) * 56));

            return (
              <div key={day.day} className="flex flex-col items-center gap-2">
                <div className="flex h-14 w-full items-end justify-center">
                  <div
                    className="w-full max-w-[28px] rounded-t-md bg-[#5ac8fa]"
                    style={{ height }}
                    title={dict.agriculture.rainChanceTooltip.replace("{chance}", String(chance))}
                  />
                </div>
                <p className="text-[11px] text-white/55">{day.day.slice(0, 3)}</p>
                <p className="text-[12px] font-medium text-[#5ac8fa]">{chance}%</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
