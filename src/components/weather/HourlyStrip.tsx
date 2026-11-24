"use client";

import { useId, useRef, useEffect, useCallback, useState, useMemo } from "react";
import { Panel } from "@/components/glass/GlassCard";
import { hoursAheadSummary } from "@/lib/design/context";
import { hoursAheadSummaryLg } from "@/lib/weather/copy-lg";
import { useTranslation } from "@/lib/i18n";
import { WeatherIcon } from "@/components/weather/WeatherIcon";
import { FeelsLikeDetailContent } from "@/components/weather/FeelsLikeDetailContent";
import { useDetailSheet } from "@/components/sheet/DetailSheetProvider";
import {
  currentUgandaLocalTimeString,
  formatClockLabelForLanguage,
  formatUgandaTimeLabel,
  parseUgandaLocalTime,
} from "@/lib/time/uganda";
import type { HourlyPoint, WeatherBundle } from "@/types/weather";

function formatAstroLabel(value: string): string {
  return value
    .trim()
    .replace(/^0/, "")
    .replace(/\s*AM$/i, " am")
    .replace(/\s*PM$/i, " pm");
}

export function prepareDisplayHourly(
  weather: WeatherBundle,
  nowMs = Date.now(),
): HourlyPoint[] {
  if (!weather.hourly || weather.hourly.length === 0) return [];
  const points = weather.hourly.map((point) => ({ ...point }));
  const first = points[0];

  if (first && first.label === "Now") {
    const firstMs = parseUgandaLocalTime(first.time || weather.localTime || "").getTime();
    const isLiveBundle = Number.isFinite(firstMs) && Math.abs(nowMs - firstMs) < 3 * 3600_000;
    const effectiveNowMs = isLiveBundle ? Math.max(firstMs, nowMs) : firstMs;
    const currentHourLabel = Number.isFinite(effectiveNowMs)
      ? formatUgandaTimeLabel(currentUgandaLocalTimeString(new Date(effectiveNowMs)))
          .trim()
          .toLowerCase()
      : "";

    const filtered: HourlyPoint[] = [{ ...first }];
    for (let i = 1; i < points.length; i += 1) {
      const point = points[i];
      if (point.kind === "hour") {
        const pointMs = parseUgandaLocalTime(point.time).getTime();
        const isPastOrCurrentHour =
          (Number.isFinite(pointMs) &&
            Number.isFinite(effectiveNowMs) &&
            pointMs <= effectiveNowMs) ||
          (i <= 2 &&
            currentHourLabel.length > 0 &&
            point.label.trim().toLowerCase() === currentHourLabel);

        if (isPastOrCurrentHour) {
          filtered[0] = {
            ...point,
            ...filtered[0],
            time: point.time || filtered[0].time,
            label: "Now",
            rainChance: point.rainChance ?? filtered[0].rainChance,
          };
          continue;
        }
      }
      filtered.push(point);
    }
    points.splice(0, points.length, ...filtered);
  }

  if (!points.some((point) => point.kind === "sunrise") && weather.astronomy?.sunrise) {
    const sixAmIdx = points.findIndex(
      (point, idx) =>
        point.kind === "hour" &&
        /^0?6(?::00)?\s*am$/i.test(point.label.trim()) &&
        idx < points.length - 1,
    );
    if (sixAmIdx >= 0) {
      points.splice(sixAmIdx + 1, 0, {
        time: points[sixAmIdx].time,
        label: formatAstroLabel(weather.astronomy.sunrise),
        temp: 0,
        icon: "",
        kind: "sunrise",
      });
    }
  }

  if (!points.some((point) => point.kind === "sunset") && weather.astronomy?.sunset) {
    const sixPmIdx = points.findIndex(
      (point, idx) =>
        point.kind === "hour" &&
        /^0?6(?::00)?\s*pm$/i.test(point.label.trim()) &&
        idx < points.length - 1,
    );
    if (sixPmIdx >= 0) {
      points.splice(sixPmIdx + 1, 0, {
        time: points[sixPmIdx].time,
        label: formatAstroLabel(weather.astronomy.sunset),
        temp: 0,
        icon: "",
        kind: "sunset",
      });
    }
  }

  return points;
}

export function HourlyStrip({
  weather,
}: {
  weather: WeatherBundle;
  /** @deprecated No longer used; kept for call-site compatibility. */
  compact?: boolean;
}) {
  const { dict, uiLanguage } = useTranslation();
  const tileId = useId();
  const { sheet, openSheet, closeSheet } = useDetailSheet();
  const isOpen = sheet?.tileId === tileId;
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeftStart = useRef(0);
  const dragDistance = useRef(0);
  const suppressClick = useRef(false);

  function handleHourClick(hourTime: string, anchorEl: HTMLElement) {
    if (suppressClick.current || dragDistance.current > 6) {
      suppressClick.current = false;
      dragDistance.current = 0;
      return;
    }
    if (isOpen) {
      closeSheet();
      return;
    }
    openSheet({
      tileId,
      title: dict.weatherStatus.hourlyFallbackTitle,
      anchorEl,
      content: <FeelsLikeDetailContent weather={weather} initialHourTime={hourTime} />,
    });
  }

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isDragging.current) return;
    const container = trackRef.current;
    if (!container) return;
    const pageX = event.pageX || event.clientX || 0;
    const walk = pageX - startX.current;
    dragDistance.current = Math.abs(walk);
    if (dragDistance.current > 6) {
      suppressClick.current = true;
    }
    container.scrollLeft = scrollLeftStart.current - walk;
  }, []);

  const handleMouseUp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
    window.setTimeout(() => {
      suppressClick.current = false;
      dragDistance.current = 0;
    }, 50);
  }, [handleMouseMove]);

  function handleMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const container = trackRef.current;
    if (!container) return;
    isDragging.current = true;
    const pageX = event.pageX || event.clientX || 0;
    startX.current = pageX;
    scrollLeftStart.current = container.scrollLeft;
    dragDistance.current = 0;
    suppressClick.current = false;

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  const [nowMs, setNowMs] = useState<number | null>(null);

  useEffect(() => {
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 10_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const fallbackNowMs = useMemo(() => {
    const ref = weather.localTime || weather.hourly?.[0]?.time || "";
    const parsed = ref ? parseUgandaLocalTime(ref).getTime() : Number.NaN;
    return Number.isFinite(parsed) ? parsed : 0;
  }, [weather.localTime, weather.hourly]);

  const displayHourly = useMemo(
    () => prepareDisplayHourly(weather, nowMs ?? fallbackNowMs),
    [weather, nowMs, fallbackNowMs],
  );

  return (
    <div data-tile-id="hourly">
      <Panel clip={false} className="px-4 pb-4 pt-4">
        <p className="mb-3 text-[15px] leading-snug text-white/92">
          {uiLanguage === "lg" ? hoursAheadSummaryLg(weather) : hoursAheadSummary(weather)}
        </p>
      {/* Horizontal scrolling track for hourly forecast points.
          Touch scrolling on mobile and mouse wheel scrolling on desktop
          preserve natural vertical page scroll without hijacking or traps. */}
      <div
        ref={trackRef}
        onMouseDown={handleMouseDown}
        className="mt-1 flex gap-4 sm:gap-5 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] cursor-grab active:cursor-grabbing select-none justify-between [&::-webkit-scrollbar]:hidden"
      >
        {displayHourly.map((hour, index) => {
          const isNow = hour.label.trim().toLowerCase() === "now";
          const labelText = isNow
            ? dict.common.now
            : formatClockLabelForLanguage(hour.label, uiLanguage, "compact");
          const isLuganda = uiLanguage === "lg";
          const sunEventLabel =
            hour.kind === "sunrise"
              ? isLuganda
                ? "Okuvaayo"
                : dict.metrics.sunrise
              : isLuganda
                ? "Okugwa"
                : dict.metrics.sunset;

          return hour.kind === "hour" ? (
            <button
              key={`${hour.label}-${index}`}
              type="button"
              onClick={(event) => handleHourClick(hour.time, event.currentTarget)}
              className={`flex shrink-0 flex-col items-center gap-1.5 sm:gap-2 ${
                isLuganda ? "w-[54px] sm:w-[58px]" : "w-[48px] sm:w-[52px]"
              }`}
            >
              <span
                className={`whitespace-nowrap text-white/80 ${
                  isLuganda
                    ? "max-w-[58px] text-[12px] sm:text-[13.5px]"
                    : "max-w-[52px] truncate text-[13px] sm:text-[15px]"
                }`}
              >
                {labelText}
              </span>
              <WeatherIcon
                theme={hour.theme}
                icon={hour.icon}
                isDay={hour.isDay}
                kind={hour.kind}
                size={28}
                className="drop-shadow-sm"
              />
              {hour.rainChance != null && hour.rainChance >= 15 ? (
                <span className="text-[12px] font-medium text-[#7CE0FF]">{hour.rainChance}%</span>
              ) : (
                <span className="h-[14px]" aria-hidden />
              )}
              <span className="text-[18px] font-medium text-white">{hour.temp}°</span>
            </button>
          ) : (
            <div
              key={`${hour.label}-${index}`}
              className={`flex shrink-0 flex-col items-center gap-1.5 sm:gap-2 ${
                isLuganda ? "w-[58px] sm:w-[66px]" : "w-[58px] sm:w-[64px]"
              }`}
            >
              {/* Sunrise and sunset carry minutes ("6:39 pm"), so this column is
                  wider than an hour column instead of cutting the time short. */}
              <span
                className={`whitespace-nowrap text-white/80 ${
                  isLuganda
                    ? "max-w-[64px] text-[12px] sm:text-[13.5px]"
                    : "text-[12.5px] sm:text-[14px]"
                }`}
              >
                {labelText}
              </span>
              <WeatherIcon
                theme={hour.theme}
                icon={hour.icon}
                isDay={hour.isDay}
                kind={hour.kind}
                size={28}
                className="drop-shadow-sm"
              />
              <span className="h-[14px]" aria-hidden />
              <span className="text-[12px] text-white/70">{sunEventLabel}</span>
            </div>
          );
        })}
      </div>
    </Panel>
    </div>
  );
}
