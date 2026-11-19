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
import type { TranslationDictionary } from "@/lib/i18n/types";
import type { HourlyPoint, WeatherBundle } from "@/types/weather";

const UV_COLOR_STOPS = [
  { value: 0, color: "#4CAF50" },
  { value: 3, color: "#CDDC39" },
  { value: 6, color: "#FFC107" },
  { value: 8, color: "#FF5722" },
  { value: 11, color: "#E040FB" },
];

function uvLabel(value: number, labels: TranslationDictionary["sheets"]["uv"]) {
  if (value <= 2) return labels.bandLow;
  if (value <= 5) return labels.bandModerate;
  if (value <= 7) return labels.bandHigh;
  if (value <= 10) return labels.bandVeryHigh;
  return labels.bandExtreme;
}

/** The hour bucket at or just before "now", for marking the current
    position on a day's graph — only meaningful for the day that actually
    contains today, so callers should only pass this for that day. */
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

/** UV Index detail sheet — the reference implementation of the shared
    metric-sheet shell (day picker, big value + scale citation, banded
    severity graph, current-status sentence, protection guidance). Other
    metric tiles (wind, humidity, pressure, visibility, feels like,
    precipitation) follow this same structure with their own graph
    styling and copy. */
export function UvDetailContent({ weather }: { weather: WeatherBundle }) {
  const { dict, uiLanguage } = useTranslation();
  const uv = dict.sheets.uv;
  const uvBands = [
    { value: 11, label: uv.bandExtreme },
    { value: 8, label: uv.bandVeryHigh },
    { value: 6, label: uv.bandHigh },
    { value: 3, label: uv.bandModerate },
    { value: 0, label: uv.bandLow },
  ];
  const days = weather.dailyForecast;
  const [selectedIndex, setSelectedIndex] = useState(
    Math.max(0, days.findIndex((day) => day.isToday)),
  );
  const selectedDay = days[selectedIndex] ?? days[0];
  const isToday = selectedDay?.isToday ?? true;
  const hours = selectedDay?.hours ?? [];
  const nowHour = isToday ? findNowHour(hours) : undefined;

  const uvHours = hours.filter((hour) => hour.kind === "hour" && hour.uvIndex != null);
  const peak = uvHours.reduce<HourlyPoint | undefined>(
    (max, hour) => ((hour.uvIndex ?? 0) > (max?.uvIndex ?? -1) ? hour : max),
    undefined,
  );
  const moderateOrHigher = uvHours.filter((hour) => (hour.uvIndex ?? 0) >= 3);
  const windowStartRaw = moderateOrHigher[0]?.label;
  const windowEndRaw = moderateOrHigher[moderateOrHigher.length - 1]?.label;
  const windowStart = windowStartRaw
    ? formatClockLabelForLanguage(windowStartRaw, uiLanguage, "medium")
    : undefined;
  const windowEnd = windowEndRaw
    ? formatClockLabelForLanguage(windowEndRaw, uiLanguage, "medium")
    : undefined;

  const displayValue = isToday ? weather.uvIndex : (peak?.uvIndex ?? 0);
  const currentLabel = uvLabel(displayValue, uv);

  return (
    <div>
      <DaySelector days={days} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />

      <p className="text-[36px] font-medium leading-tight text-white">
        {displayValue}
        <span className="ml-2 text-[20px] font-normal text-white/75">{currentLabel}</span>
      </p>
      <p className="mt-1 text-[13px] text-white/45">{uv.whoScale}</p>

      {uvHours.length > 2 && (
        <div className="mt-4">
          <HourlySeriesGraph
            hours={hours}
            valueOf={(hour) => hour.uvIndex}
            min={0}
            max={11}
            colorStops={UV_COLOR_STOPS}
            bandLabels={uvBands}
            nowTime={nowHour?.time}
          />
        </div>
      )}

      <p className="mt-4 text-[15px] leading-relaxed text-white/85">
        {isToday
          ? windowStart && windowEnd && windowStart !== windowEnd
            ? uv.todayWindow
                .replace("{label}", currentLabel)
                .replace("{start}", windowStart)
                .replace("{end}", windowEnd)
            : uv.todaySteady.replace("{label}", currentLabel)
          : windowStart && windowEnd
            ? uv.otherDayWindow
                .replace("{start}", windowStart)
                .replace("{end}", windowEnd)
            : uv.otherDayLow}
      </p>

      <div className="mt-4 pt-3">
        <p
          className={
            uiLanguage === "lg"
              ? "text-[13px] font-semibold text-white/60"
              : "text-[12px] font-semibold uppercase tracking-[0.1rem] text-white/50"
          }
        >
          {uv.protectionTitle}
        </p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-white/78">
          {displayValue >= 8
            ? uv.protectionVeryHigh
            : displayValue >= 3
              ? uv.protectionModerate
              : uv.protectionLow}
        </p>
      </div>

      <div className="mt-4 pt-3">
        <p className="text-[15px] font-semibold text-white/90">{uv.aboutTitle}</p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-white/78">
          {uv.aboutBody}
        </p>
      </div>

      <div className="mt-4 pt-3">
        <p className="text-[13px] leading-relaxed text-white/50">
          {uv.ugandaContext}
        </p>
      </div>
    </div>
  );
}
