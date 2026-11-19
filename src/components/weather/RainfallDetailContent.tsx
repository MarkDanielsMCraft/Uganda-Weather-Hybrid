"use client";

import { useState } from "react";
import { DaySelector } from "@/components/sheet/DaySelector";
import { HourlySeriesGraph } from "@/components/sheet/HourlySeriesGraph";
import { useTranslation } from "@/lib/i18n";
import { formatDayLg, formatDayPrepositionLg } from "@/lib/weather/copy-lg";
import type { WeatherBundle } from "@/types/weather";

/** Named "Rainfall" not "Precipitation" to avoid colliding with the
    module's own component name and the radar tile's title, which also
    used to say "Precipitation" before that got renamed to "Radar". */
export function RainfallDetailContent({ weather }: { weather: WeatherBundle }) {
  const { dict, uiLanguage } = useTranslation();
  const isLuganda = uiLanguage === "lg";
  const r = dict.sheets.rainfall;
  const days = weather.dailyForecast;
  const [selectedIndex, setSelectedIndex] = useState(
    Math.max(0, days.findIndex((day) => day.isToday)),
  );
  const selectedDay = days[selectedIndex] ?? days[0];
  const isToday = selectedDay?.isToday ?? true;
  const hours = selectedDay?.hours ?? [];

  const rainHours = hours.filter((hour) => hour.kind === "hour" && hour.rainChance != null);
  const displayMm = isToday ? weather.precipitation.mm : undefined;
  const displayChance = isToday ? weather.precipitation.chance : (selectedDay?.rainChance ?? 0);

  const nextRainDay = days
    .slice(1)
    .find((day) => (day.rainChance ?? 0) >= 40);

  return (
    <div>
      <DaySelector days={days} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />

      <p className="text-[36px] font-medium leading-tight text-white">
        {displayMm != null
          ? isLuganda
            ? `mm ${displayMm}`
            : `${displayMm} mm`
          : `${displayChance}%`}
        {displayMm != null && (
          <span className="ml-2 text-[18px] font-normal text-white/75">
            {r.chanceFormat.replace("{chance}", String(displayChance))}
          </span>
        )}
      </p>
      <p className="mt-1 text-[13px] text-white/45">
        {isToday
          ? dict.common.today
          : isLuganda
            ? formatDayLg(selectedDay?.day ?? "")
            : (selectedDay?.day ?? "")}
      </p>

      {rainHours.length > 2 && (
        <div className="mt-4">
          <HourlySeriesGraph hours={hours} valueOf={(hour) => hour.rainChance} min={0} max={100} unit="%" />
        </div>
      )}

      <p className="mt-4 text-[15px] leading-relaxed text-white/85">
        {nextRainDay
          ? r.nextRainExpected
              .replace(
                "{day}",
                isLuganda ? formatDayPrepositionLg(nextRainDay.day, false) : nextRainDay.day,
              )
              .replace("{chance}", String(nextRainDay.rainChance ?? 0))
          : r.noSignificantRain}
      </p>

      <div className="mt-4 pt-3">
        <p className="text-[13px] leading-relaxed text-white/50">
          {r.ugandaContext}
        </p>
      </div>
    </div>
  );
}
