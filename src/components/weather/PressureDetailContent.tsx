"use client";

import { useState } from "react";
import { DaySelector } from "@/components/sheet/DaySelector";
import { HourlySeriesGraph } from "@/components/sheet/HourlySeriesGraph";
import {
  currentUgandaLocalTimeString,
  formatClockLabelForLanguage,
  parseUgandaLocalTime,
} from "@/lib/time/uganda";
import { useTranslation } from "@/lib/i18n";
import { formatDayPrepositionLg } from "@/lib/weather/copy-lg";
import type { HourlyPoint, WeatherBundle } from "@/types/weather";

const PRESSURE_LINE_COLOR = "#c266f0";

function findNowHour(hours: HourlyPoint[]): HourlyPoint | undefined {
  const nowMs = parseUgandaLocalTime(currentUgandaLocalTimeString()).getTime();
  let match: HourlyPoint | undefined;
  for (const hour of hours) {
    if (hour.kind !== "hour") continue;
    const hourMs = parseUgandaLocalTime(hour.time).getTime();
    if (hourMs > nowMs) break;
    match = hour;
  }
  return match;
}

export function PressureDetailContent({ weather }: { weather: WeatherBundle }) {
  const { dict, uiLanguage } = useTranslation();
  const isLuganda = uiLanguage === "lg";
  const p = dict.sheets.pressure;
  const days = weather.dailyForecast;
  const [selectedIndex, setSelectedIndex] = useState(
    Math.max(0, days.findIndex((day) => day.isToday)),
  );
  const selectedDay = days[selectedIndex] ?? days[0];
  const isToday = selectedDay?.isToday ?? true;
  const hours = selectedDay?.hours ?? [];
  const nowHour = isToday ? findNowHour(hours) : undefined;

  const pressureHours = hours.filter((hour) => hour.kind === "hour" && hour.pressureMb != null);
  const displayPressure = isToday ? weather.pressureMb : (pressureHours[0]?.pressureMb ?? 1013);

  // Rising/falling/steady from the day's own first-to-last hourly reading —
  // a real trend derived from the graphed data, not a separate forecast
  // claim we can't back up.
  const first = pressureHours[0]?.pressureMb;
  const last = pressureHours[pressureHours.length - 1]?.pressureMb;
  const trendDiff = first != null && last != null ? last - first : 0;
  const trend = trendDiff > 1.5 ? p.rising : trendDiff < -1.5 ? p.falling : p.steady;

  const values = pressureHours.map((hour) => hour.pressureMb ?? 1013);
  const avgPressure = values.length > 0 ? Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10 : displayPressure;
  const lowPressure = values.length > 0 ? Math.round(Math.min(...values) * 10) / 10 : displayPressure;
  const highPressure = values.length > 0 ? Math.round(Math.max(...values) * 10) / 10 : displayPressure;
  const min = Math.floor(Math.min(...values, displayPressure) / 4) * 4 - 4;
  const max = Math.ceil(Math.max(...values, displayPressure) / 4) * 4 + 4;

  return (
    <div>
      <DaySelector days={days} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />

      {nowHour && (
        <p className="text-[13px] text-white/45">
          {formatClockLabelForLanguage(nowHour.label, uiLanguage, "medium")}
        </p>
      )}
      <div className="flex items-baseline gap-3">
        <p className="text-[36px] font-medium leading-tight text-white">
          {isLuganda ? (
            <>
              <span className="mr-1 text-[18px] font-normal text-white/75">hPa</span>
              {displayPressure}
            </>
          ) : (
            <>
              {displayPressure}
              <span className="ml-1 text-[18px] font-normal text-white/75">hPa</span>
            </>
          )}
        </p>
        <span className="text-[15px] font-medium text-white/70">{trend}</span>
      </div>

      {pressureHours.length > 2 && (
        <div className="mt-4">
          <HourlySeriesGraph
            hours={hours}
            valueOf={(hour) => hour.pressureMb}
            min={min}
            max={max}
            unit=" hPa"
            nowTime={nowHour?.time}
            lineColor={PRESSURE_LINE_COLOR}
          />
        </div>
      )}

      <div className="mt-4 pt-3">
        <p className="text-[15px] font-semibold text-white/90">{dict.metrics.dailySummary}</p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-white/78">
          {p.summaryText
            .replace("{pressure}", String(displayPressure))
            .replace("{trend}", trend.toLowerCase())
            .replace(
              "{day}",
              isLuganda
                ? formatDayPrepositionLg(selectedDay?.day ?? "")
                : (selectedDay?.day ?? ""),
            )
            .replace("{avg}", String(avgPressure))
            .replace("{low}", String(lowPressure))
            .replace("{high}", String(highPressure))}
        </p>
      </div>

      <div className="mt-4 pt-3">
        <p className="text-[15px] font-semibold text-white/90">{p.aboutTitle}</p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-white/78">
          {p.aboutBody1}
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-white/78">
          {p.aboutBody2}
        </p>
      </div>
    </div>
  );
}
