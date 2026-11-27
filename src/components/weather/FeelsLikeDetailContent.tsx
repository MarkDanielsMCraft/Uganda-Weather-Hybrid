"use client";

import { useState } from "react";
import { DaySelector } from "@/components/sheet/DaySelector";
import { HourlySeriesGraph } from "@/components/sheet/HourlySeriesGraph";
import { currentUgandaLocalTimeString, formatClockLabelForLanguage, parseUgandaLocalTime } from "@/lib/time/uganda";
import { useTranslation } from "@/lib/i18n";
import { formatDayPrepositionLg } from "@/lib/weather/copy-lg";
import type { HourlyPoint, WeatherBundle } from "@/types/weather";

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

/** "Conditions" sheet — Actual/Feels Like segmented toggle over a real
    hourly curve for whichever is selected (both are genuine per-hour
    provider data now, not one derived from the other), day/night icons
    and H/L markers on the graph, then a secondary Chance of Precipitation
    graph and a plain-language forecast summary built entirely from data
    already on the bundle. No "last 24 hours" or day-over-day comparison
    section — this app has no historical actuals to back either claim, and
    fabricating one would violate the sourcing standard the rest of the
    site follows. */
/** Finds which day (by index into dailyForecast) contains an hour matching
    the given time — used when opening from a specific hour in the hourly
    strip, so the day picker lands on the right day even for an hour just
    after midnight that technically belongs to tomorrow. */
function dayIndexForHourTime(days: WeatherBundle["dailyForecast"], time: string): number {
  for (let i = 0; i < days.length; i += 1) {
    if (days[i].hours?.some((hour) => hour.time === time)) return i;
  }
  return Math.max(0, days.findIndex((day) => day.isToday));
}

export function FeelsLikeDetailContent({
  weather,
  initialDayIndex,
  initialHourTime,
}: {
  weather: WeatherBundle;
  initialDayIndex?: number;
  initialHourTime?: string;
}) {
  const { dict, uiLanguage } = useTranslation();
  const isLuganda = uiLanguage === "lg";
  const fl = dict.sheets.feelsLike;
  const days = weather.dailyForecast;
  const [selectedIndex, setSelectedIndex] = useState(
    initialDayIndex ??
      (initialHourTime
        ? dayIndexForHourTime(days, initialHourTime)
        : Math.max(0, days.findIndex((day) => day.isToday))),
  );
  const [tab, setTab] = useState<"actual" | "feelsLike">("actual");
  const selectedDay = days[selectedIndex] ?? days[0];
  const isToday = selectedDay?.isToday ?? true;
  const hours = selectedDay?.hours ?? [];
  const nowHour = isToday ? findNowHour(hours) : undefined;

  // When opened from a specific hour (the Hourly Strip or a 10-Day row),
  // the graph should visibly start there, not just mark it somewhere in
  // the middle of the full day. Only while still viewing that same day:
  // switching days via the day picker reverts to that day's full range.
  const initialHourDayIndex = initialHourTime ? dayIndexForHourTime(days, initialHourTime) : null;
  const isInitialHourDay = initialHourDayIndex != null && selectedIndex === initialHourDayIndex;
  const graphHours = isInitialHourDay
    ? (() => {
        const startIndex = hours.findIndex((hour) => hour.time === initialHourTime);
        if (startIndex < 0) return hours;
        const remaining = hours.slice(startIndex);
        if (remaining.length >= 6) return remaining;
        const nextDayHours = days[selectedIndex + 1]?.hours ?? [];
        const combined = [...remaining, ...nextDayHours.slice(0, 12 - remaining.length)];
        return combined.length >= 2 ? combined : hours;
      })()
    : hours;

  const tempHours = hours.filter((hour) => hour.kind === "hour");
  const actualValues = tempHours.map((hour) => hour.temp);
  const feelsValues = tempHours.map((hour) => hour.feelsLike).filter((v): v is number => v != null);
  const allValues = [...actualValues, ...feelsValues];
  const min = allValues.length > 0 ? Math.min(...allValues) - 2 : 10;
  const max = allValues.length > 0 ? Math.max(...allValues) + 2 : 35;

  const displayValue = isToday
    ? tab === "actual"
      ? weather.temperature.celsius
      : weather.temperature.feelsLike
    : tab === "actual"
      ? selectedDay?.high
      : (tempHours.reduce<number | undefined>(
          (max, hour) => (hour.feelsLike != null && (max == null || hour.feelsLike > max) ? hour.feelsLike : max),
          undefined,
        ) ?? selectedDay?.high);

  const rainHours = hours.filter((hour) => hour.kind === "hour" && hour.rainChance != null);

  const feelsLow = feelsValues.length > 0 ? Math.min(...feelsValues) : selectedDay?.low;
  const feelsHigh = feelsValues.length > 0 ? Math.max(...feelsValues) : selectedDay?.high;
  const feelsWarmer = feelsLow != null && feelsHigh != null && selectedDay
    ? feelsHigh - selectedDay.high
    : 0;

  const lowHour = tempHours.length > 0 ? tempHours.reduce((min, hour) => (hour.temp < min.temp ? hour : min)) : undefined;
  const highHour = tempHours.length > 0 ? tempHours.reduce((max, hour) => (hour.temp > max.temp ? hour : max)) : undefined;

  return (
    <div>
      <DaySelector days={days} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />

      <p className="text-[36px] font-medium leading-tight text-white">{displayValue}°</p>
      {isToday && (
        <p className="mt-1 text-[13px] text-white/45">
          {tab === "actual"
            ? fl.feelsLikeValue.replace("{temp}", String(weather.temperature.feelsLike))
            : fl.actualValue.replace("{temp}", String(weather.temperature.celsius))}
        </p>
      )}

      {tempHours.length > 2 && (
        <div className="mt-4">
          <HourlySeriesGraph
            hours={graphHours}
            valueOf={(hour) => (tab === "actual" ? hour.temp : hour.feelsLike)}
            min={min}
            max={max}
            nowTime={nowHour?.time}
            showDayNightIcons
            showPeakLabels
            unit="°"
            initialActiveTime={initialHourTime}
          />
        </div>
      )}

      <div data-no-narrate className="mt-3 flex rounded-full border border-white/15 bg-white/[0.05] p-1">
        <button
          type="button"
          onClick={() => setTab("actual")}
          className={`flex-1 rounded-full py-1.5 text-[14px] font-medium transition ${
            tab === "actual" ? "bg-white/15 text-white" : "text-white/55"
          }`}
        >
          {fl.actualTab}
        </button>
        <button
          type="button"
          onClick={() => setTab("feelsLike")}
          className={`flex-1 rounded-full py-1.5 text-[14px] font-medium transition ${
            tab === "feelsLike" ? "bg-white/15 text-white" : "text-white/55"
          }`}
        >
          {fl.feelsLikeTab}
        </button>
      </div>

      <p className="mt-3 text-[14px] leading-relaxed text-white/72">
        {tab === "actual" ? fl.actualExplain : fl.feelsLikeExplain}
      </p>

      {rainHours.length > 2 && (
        <div className="mt-4 pt-3">
          <p
            className={
              isLuganda
                ? "text-[13px] font-semibold text-white/60"
                : "text-[12px] font-semibold uppercase tracking-[0.1rem] text-white/50"
            }
          >
            {dict.metrics.chanceOfPrecipitation}
          </p>
          <p className="mt-1 text-[13px] text-white/50">
            {fl.chanceFormat
              .replace(
                "{possessive}",
                isToday
                  ? fl.todayPossessive
                  : fl.dayPossessive.replace(
                      "{day}",
                      isLuganda
                        ? formatDayPrepositionLg(selectedDay?.day ?? "")
                        : (selectedDay?.day ?? ""),
                    ),
              )
              .replace("{chance}", String(selectedDay?.rainChance ?? 0))}
          </p>
          <div className="mt-2">
            <HourlySeriesGraph hours={graphHours} valueOf={(hour) => hour.rainChance} min={0} max={100} nowTime={nowHour?.time} unit="%" />
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-white/55">
            {fl.dailyChanceExplain}
          </p>
        </div>
      )}

      {isToday && (
        <div className="mt-4 pt-3">
          <p
            className={
              isLuganda
                ? "text-[13px] font-semibold text-white/60"
                : "text-[12px] font-semibold uppercase tracking-[0.1rem] text-white/50"
            }
          >
            {fl.precipitationTotalLabel}
          </p>
          <div className="mt-1.5 flex items-center justify-between text-[14px]">
            <span className="text-white/70">{fl.precipitationRow}</span>
            <span className="text-white">
              {isLuganda ? `mm ${weather.precipitation.mm}` : `${weather.precipitation.mm} mm`}
            </span>
          </div>
        </div>
      )}

      <div className="mt-4 pt-3">
        <p className="text-[15px] font-semibold text-white/90">{dict.metrics.dailySummary}</p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-white/78">
          {fl.dayLowHighSummary
            .replace(
              "{day}",
              isLuganda
                ? formatDayPrepositionLg(selectedDay?.day ?? "")
                : (selectedDay?.day ?? ""),
            )
            .replace("{low}", String(selectedDay?.low ?? ""))
            .replace(
              "{lowAt}",
              lowHour
                ? lowHour.label.trim().toLowerCase() === "now"
                  ? isLuganda
                    ? " kati"
                    : " right now"
                  : fl.aroundHour.replace(
                      "{hour}",
                      formatClockLabelForLanguage(lowHour.label, uiLanguage, "medium"),
                    )
                : "",
            )
            .replace("{high}", String(selectedDay?.high ?? ""))
            .replace(
              "{highAt}",
              highHour
                ? highHour.label.trim().toLowerCase() === "now"
                  ? isLuganda
                    ? " kati"
                    : " right now"
                  : fl.aroundHour.replace(
                      "{hour}",
                      formatClockLabelForLanguage(highHour.label, uiLanguage, "medium"),
                    )
                : "",
            )}
          {feelsLow != null && feelsHigh != null
            ? fl.feelsRangeClause
                .replace("{low}", String(feelsLow))
                .replace("{high}", String(feelsHigh))
            : ""}
          {Math.abs(feelsWarmer) >= 2
            ? feelsWarmer > 0
              ? fl.feelsWarmerClause
              : fl.feelsCoolerClause
            : ""}
        </p>
      </div>

      <div className="mt-4 pt-3">
        <p className="text-[15px] font-semibold text-white/90">{fl.aboutTitle}</p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-white/78">
          {fl.aboutBody}
        </p>
      </div>
    </div>
  );
}
