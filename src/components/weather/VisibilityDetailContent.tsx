"use client";

import { useState } from "react";
import { DaySelector } from "@/components/sheet/DaySelector";
import { HourlySeriesGraph } from "@/components/sheet/HourlySeriesGraph";
import { useTranslation } from "@/lib/i18n";
import { formatConditionLg, formatDayLg } from "@/lib/weather/copy-lg";
import type { WeatherBundle } from "@/types/weather";

export function VisibilityDetailContent({ weather }: { weather: WeatherBundle }) {
  const { dict, uiLanguage } = useTranslation();
  const isLuganda = uiLanguage === "lg";
  const vis = dict.sheets.visibility;
  const days = weather.dailyForecast;
  const [selectedIndex, setSelectedIndex] = useState(
    Math.max(0, days.findIndex((day) => day.isToday)),
  );
  const selectedDay = days[selectedIndex] ?? days[0];
  const isToday = selectedDay?.isToday ?? true;
  const hours = selectedDay?.hours ?? [];

  const visibilityHours = hours.filter((hour) => hour.kind === "hour" && hour.visibilityKm != null);
  const displayVisibility = isToday ? weather.visibilityKm : (visibilityHours[0]?.visibilityKm ?? 10);
  const maxVisibility = Math.max(20, ...visibilityHours.map((hour) => hour.visibilityKm ?? 0));

  return (
    <div>
      <DaySelector days={days} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />

      <p className="text-[36px] font-medium leading-tight text-white">
        {isLuganda ? (
          <>
            <span className="text-[18px] font-normal text-white/75">km</span>{" "}
            {displayVisibility}
          </>
        ) : (
          <>
            {displayVisibility}{" "}
            <span className="text-[18px] font-normal text-white/75">km</span>
          </>
        )}
      </p>
      <p className="mt-1 text-[13px] text-white/45">
        {isToday
          ? isLuganda
            ? formatConditionLg(weather.condition.text, weather.isDay)
            : weather.condition.text
          : isLuganda
            ? formatDayLg(selectedDay?.day ?? "")
            : (selectedDay?.day ?? "")}
      </p>

      {visibilityHours.length > 2 && (
        <div className="mt-4">
          <HourlySeriesGraph
            hours={hours}
            valueOf={(hour) => hour.visibilityKm}
            min={0}
            max={maxVisibility}
            unit=" km"
          />
        </div>
      )}

      <p className="mt-4 text-[15px] leading-relaxed text-white/85">
        {displayVisibility >= 15
          ? vis.clear
          : displayVisibility >= 8
            ? vis.good
            : displayVisibility >= 4
              ? vis.reduced
              : vis.poor}
      </p>

      <div className="mt-4 pt-3">
        <p
          className={
            isLuganda
              ? "text-[13px] font-semibold text-white/60"
              : "text-[12px] font-semibold uppercase tracking-[0.1rem] text-white/50"
          }
        >
          {vis.whatLimitsTitle}
        </p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-white/78">
          {vis.ugandaContext}
        </p>
      </div>
    </div>
  );
}
