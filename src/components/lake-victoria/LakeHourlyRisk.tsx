"use client";

import { useRef } from "react";
import { WeatherIcon } from "@/components/weather/WeatherIcon";
import { useTranslation } from "@/lib/i18n";
import { formatClockLabelForLanguage } from "@/lib/time/uganda";
import type { WeatherBundle } from "@/types/weather";

export function LakeHourlyRisk({ weather }: { weather: WeatherBundle }) {
  const { dict, uiLanguage } = useTranslation();
  const isLg = uiLanguage === "lg";
  const trackRef = useRef<HTMLDivElement>(null);
  const hours = weather.hourly.filter((hour) => hour.kind === "hour").slice(0, 10);
  if (hours.length === 0) return null;

  const formatLabel = (raw: string, style: "compact" | "medium") =>
    raw.trim().toLowerCase() === "now"
      ? dict.common.now
      : formatClockLabelForLanguage(raw, uiLanguage, style);

  const stormHours = hours.filter(
    (hour) => hour.theme === "thunder" || hour.theme === "rain",
  );

  const formatStormHoursPhrase = () => {
    if (!isLg) {
      return stormHours.map((h) => formatLabel(h.label, "medium")).join(", ");
    }
    const startsWithNow = stormHours[0]?.label.trim().toLowerCase() === "now";
    const clockParts = (startsWithNow ? stormHours.slice(1) : stormHours).map((h) =>
      formatClockLabelForLanguage(h.label, "lg", "medium"),
    );
    if (startsWithNow && clockParts.length === 0) {
      return "kati";
    }
    if (startsWithNow) {
      return `kati ne ku ssaawa ${clockParts.join(", ")}`;
    }
    return `ku ssaawa ${clockParts.join(", ")}`;
  };

  return (
    <div>
      <p className="text-[13px] font-semibold text-white/55">
        {dict.marine.nextHoursOnLake}
      </p>
      {stormHours.length > 0 ? (
        <p className="mt-2 text-[15px] leading-relaxed text-white/80">
          {dict.marine.rainOrStormsPossible.replace(
            "{hours}",
            formatStormHoursPhrase(),
          )}
        </p>
      ) : (
        <p className="mt-2 text-[15px] leading-relaxed text-white/72">
          {dict.marine.noRainInHourly}
        </p>
      )}
      <div
        ref={trackRef}
        data-no-narrate
        className="mt-3 flex justify-between gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {hours.map((hour, index) => (
          <div
            key={`${hour.label}-${index}`}
            className={`flex shrink-0 flex-col items-center gap-1.5 ${
              isLg ? "w-14" : "w-11"
            }`}
          >
            <span className="whitespace-nowrap text-[11px] text-white/50">
              {formatLabel(hour.label, "compact")}
            </span>
            <WeatherIcon
              theme={hour.theme}
              icon={hour.icon}
              isDay={hour.isDay}
              kind={hour.kind}
              size={26}
            />
            {hour.rainChance != null && hour.rainChance >= 15 ? (
              <span className="text-[11px] font-medium text-[#5ac8fa]">{hour.rainChance}%</span>
            ) : (
              <span className="h-[11px]" aria-hidden />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
