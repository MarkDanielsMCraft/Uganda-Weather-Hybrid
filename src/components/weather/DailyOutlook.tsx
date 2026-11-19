"use client";

import { useId, useRef } from "react";
import { Panel } from "@/components/glass/GlassCard";
import { WeatherIcon } from "@/components/weather/WeatherIcon";
import { FeelsLikeDetailContent } from "@/components/weather/FeelsLikeDetailContent";
import { useDetailSheet } from "@/components/sheet/DetailSheetProvider";
import { useTranslation } from "@/lib/i18n";
import { formatDayLg } from "@/lib/weather/copy-lg";
import type { DailyPoint, WeatherBundle } from "@/types/weather";

function forecastScale(weather: WeatherBundle) {
  const lows = weather.dailyForecast.map((day) => day.low);
  const highs = weather.dailyForecast.map((day) => day.high);
  const min = Math.min(...lows) - 1;
  const max = Math.max(...highs) + 1;
  const span = Math.max(max - min, 1);
  return { min, max, span };
}

function scalePosition(value: number, min: number, span: number) {
  return Math.min(100, Math.max(0, ((value - min) / span) * 100));
}

function ForecastRow({
  day,
  dayIndex,
  weather,
  min,
  span,
  todayTemp,
  compact = false,
}: {
  day: DailyPoint;
  dayIndex: number;
  weather: WeatherBundle;
  min: number;
  span: number;
  todayTemp: number;
  compact?: boolean;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tileId = useId();
  const { sheet, openSheet, closeSheet } = useDetailSheet();
  const left = scalePosition(day.low, min, span);
  const right = scalePosition(day.high, min, span);
  const width = Math.max(right - left, 1.5);
  const dotLeft = day.isToday ? scalePosition(todayTemp, min, span) : null;
  const isOpen = sheet?.tileId === tileId;
  const { dict, uiLanguage } = useTranslation();
  const isLuganda = uiLanguage === "lg";
  const dayLabel = isLuganda ? formatDayLg(day.day) : day.day;

  function handleClick() {
    if (isOpen) {
      closeSheet();
      return;
    }
    openSheet({
      tileId,
      title: dict.common.conditionsTitle,
      anchorEl: buttonRef.current,
      content: <FeelsLikeDetailContent weather={weather} initialDayIndex={dayIndex} />,
    });
  }

  const gridClass = compact
    ? isLuganda
      ? "grid-cols-[5.35rem_1.45rem_1.5rem_minmax(0,1fr)_1.5rem] gap-x-1 px-2.5 py-2 text-[13px]"
      : "grid-cols-[2.75rem_1.75rem_1.75rem_minmax(0,1fr)_1.75rem] gap-x-1.5 px-3 py-2 text-[14px]"
    : isLuganda
      ? "grid-cols-[6.25rem_2rem_2rem_minmax(0,1fr)_2rem] gap-x-1.5 px-3.5 py-2.5 text-[14px]"
      : "grid-cols-[3.25rem_2.5rem_2.25rem_minmax(0,1fr)_2.25rem] gap-x-2 px-4 py-2.5 text-[15px]";

  const dayTextClass = compact
    ? isLuganda
      ? "whitespace-nowrap text-[12.5px]"
      : "truncate text-[14px]"
    : isLuganda
      ? "whitespace-nowrap text-[14.5px]"
      : "truncate text-[16px]";

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={handleClick}
      className={`grid w-full items-center text-left transition hover:bg-white/[0.04] ${
        compact ? "flex-1" : ""
      } ${gridClass}`}
    >
      <span className={`text-white ${dayTextClass}`}>{dayLabel}</span>
      <div className="flex flex-col items-center gap-0.5">
        <WeatherIcon
          theme={day.theme}
          icon={day.icon}
          isDay={day.isToday ? weather.isDay : true}
          size={compact ? 22 : 26}
          className="shrink-0 drop-shadow-sm"
        />
        {day.rainChance != null && day.rainChance >= 15 && (
          <span className="text-[11px] font-medium text-[#7CE0FF]">{day.rainChance}%</span>
        )}
      </div>
      <span className="text-right tabular-nums text-white/75">{day.low}°</span>
      <div className="relative h-[4px] min-w-0 rounded-full bg-black/35 shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]">
        <div
          className="absolute inset-y-0 rounded-full bg-gradient-to-r from-[#7CE0FF] via-[#ffd060] to-[#ff8a50]"
          style={{ left: `${left}%`, width: `${width}%` }}
        />
        {dotLeft !== null && (
          <div
            className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/40 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
            style={{ left: `${dotLeft}%` }}
          />
        )}
      </div>
      <span className="text-right tabular-nums text-white">{day.high}°</span>
    </button>
  );
}

export function DailyOutlook({
  weather,
  compact = false,
}: {
  weather: WeatherBundle;
  compact?: boolean;
}) {
  const { min, span } = forecastScale(weather);
  const todayTemp = weather.temperature.celsius;
  const { t, uiLanguage } = useTranslation();

  return (
    <Panel className={compact ? "flex h-full min-h-0 flex-col" : ""}>
      <div className="shrink-0 px-4 pt-4">
        {/* Titled by what is actually in the list. The forecast is topped up
            to ten days from a second provider when the primary returns fewer,
            but if that top up fails the card should say three rather than
            promise ten and show three. */}
        {uiLanguage === "lg" ? (
          <p className="mb-3 text-[13px] font-semibold leading-snug text-white/75">
            {t("metrics.dailyForecastCount", { count: weather.dailyForecast.length })}
          </p>
        ) : (
          <p className="mb-3 text-[13px] font-semibold leading-snug text-white/75">
            {weather.dailyForecast.length} Day Forecast
          </p>
        )}
      </div>
      <div
        className={
          compact
            ? "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-auto [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20"
            : ""
        }
      >
        {weather.dailyForecast.map((day, index) => (
          <ForecastRow
            key={`${day.day}-${day.date ?? index}`}
            day={day}
            dayIndex={index}
            weather={weather}
            min={min}
            span={span}
            todayTemp={todayTemp}
            compact={compact}
          />
        ))}
      </div>
    </Panel>
  );
}
