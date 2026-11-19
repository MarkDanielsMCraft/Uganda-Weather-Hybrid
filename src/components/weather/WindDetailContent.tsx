"use client";

import { useState } from "react";
import { DaySelector } from "@/components/sheet/DaySelector";
import { HourlySeriesGraph } from "@/components/sheet/HourlySeriesGraph";
import { formatDmsCoordinates, WindCompass } from "@/components/weather/WindCompass";
import { currentUgandaLocalTimeString, parseUgandaLocalTime } from "@/lib/time/uganda";
import { useTranslation, localizeDistrictName } from "@/lib/i18n";
import { formatDayPrepositionLg, formatWindDirectionLg } from "@/lib/weather/copy-lg";
import type { HourlyPoint, WeatherBundle } from "@/types/weather";

const BEAUFORT_SCALE = [
  { force: 0, label: "Calm", max: 2, color: "#5ac8fa" },
  { force: 1, label: "Light air", max: 5, color: "#5ac8fa" },
  { force: 2, label: "Light breeze", max: 11, color: "#4fd18a" },
  { force: 3, label: "Gentle breeze", max: 19, color: "#7fd14f" },
  { force: 4, label: "Moderate breeze", max: 28, color: "#a8d14f" },
  { force: 5, label: "Fresh breeze", max: 38, color: "#d1c94f" },
  { force: 6, label: "Strong breeze", max: 49, color: "#E8A838" },
  { force: 7, label: "High wind", max: 61, color: "#e89138" },
  { force: 8, label: "Gale", max: 74, color: "#e87a38" },
  { force: 9, label: "Strong gale", max: 87, color: "#e86438" },
  { force: 10, label: "Storm", max: 102, color: "#E07A5F" },
  { force: 11, label: "Violent storm", max: 117, color: "#d1495f" },
  { force: 12, label: "Hurricane-force", max: Infinity, color: "#c22f5f" },
];

const COMPASS_FULL_NAME: Record<string, string> = {
  N: "north",
  NNE: "north-northeast",
  NE: "northeast",
  ENE: "east-northeast",
  E: "east",
  ESE: "east-southeast",
  SE: "southeast",
  SSE: "south-southeast",
  S: "south",
  SSW: "south-southwest",
  SW: "southwest",
  WSW: "west-southwest",
  W: "west",
  WNW: "west-northwest",
  NW: "northwest",
  NNW: "north-northwest",
};

export function beaufortForce(speedKph: number) {
  const safeSpeed = Number.isFinite(speedKph) && speedKph >= 0 ? speedKph : 0;
  return BEAUFORT_SCALE.find((row) => safeSpeed <= row.max) ?? BEAUFORT_SCALE[0];
}

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

/** Wind detail sheet — day picker, combined speed+direction value, a
    dual-line graph (sustained speed filled, gusts as a lighter overlay
    line) with a direction-arrow row above it, a real Daily Summary built
    from the day's own min/max/gust range, and the Beaufort scale as a
    fixed reference table (a universal physical scale, not something that
    needs a citation). */
export function WindDetailContent({ weather }: { weather: WeatherBundle }) {
  const { dict, uiLanguage } = useTranslation();
  const isLuganda = uiLanguage === "lg";
  const w = dict.sheets.wind;
  const days = weather.dailyForecast;
  const [selectedIndex, setSelectedIndex] = useState(
    Math.max(0, days.findIndex((day) => day.isToday)),
  );
  const selectedDay = days[selectedIndex] ?? days[0];
  const isToday = selectedDay?.isToday ?? true;
  const hours = selectedDay?.hours ?? [];
  const nowHour = isToday ? findNowHour(hours) : undefined;

  const windHours = hours.filter((hour) => hour.kind === "hour" && hour.windSpeedKph != null);
  const speeds = windHours.map((hour) => hour.windSpeedKph ?? 0);
  const gusts = windHours.map((hour) => hour.gustKph ?? 0);
  const maxSeriesValue = Math.max(weather.wind.gustKph, ...speeds, ...gusts, 10);

  const displaySpeed = isToday ? weather.wind.speedKph : (windHours[0]?.windSpeedKph ?? 0);
  const displayDirection = isToday ? weather.wind.direction : undefined;
  const minSpeed = speeds.length > 0 ? Math.min(...speeds) : displaySpeed;
  const maxSpeed = speeds.length > 0 ? Math.max(...speeds) : displaySpeed;
  const maxGust = gusts.length > 0 ? Math.max(...gusts) : weather.wind.gustKph;
  const force = beaufortForce(displaySpeed);

  return (
    <div>
      <DaySelector days={days} selectedIndex={selectedIndex} onSelect={setSelectedIndex} />

      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-2">
            <p className="text-[36px] font-medium leading-tight text-white">
              {isLuganda ? (
                <>
                  <span className="mr-1 text-[18px] font-normal text-white/75">km/h</span>
                  {displaySpeed}
                </>
              ) : (
                <>
                  {displaySpeed}
                  <span className="ml-1 text-[18px] font-normal text-white/75">km/h</span>
                </>
              )}
            </p>
            {displayDirection && (
              <span className="text-[20px] font-medium text-white/70">
                {isLuganda ? formatWindDirectionLg(displayDirection) : displayDirection}
              </span>
            )}
          </div>
          {isToday && (
            <p className="mt-1 text-[13px] text-white/50">
              {w.upToGust.replace("{gust}", String(weather.wind.gustKph))}
            </p>
          )}
        </div>
      </div>

      {isToday && (
        <div className="mt-4 flex flex-col items-center justify-center text-center">
          <WindCompass degree={weather.wind.degree} size={220} />
          <div className="mt-4 flex flex-col items-center">
            <p className="text-[36px] font-semibold tracking-tight text-white tabular-nums">
              {weather.wind.degree}°{" "}
              {displayDirection
                ? isLuganda
                  ? formatWindDirectionLg(displayDirection)
                  : displayDirection
                : ""}
            </p>
            {weather.district.coordinates && (
              <p className="mt-1 text-[13px] font-medium tracking-wide text-white/70 tabular-nums">
                {formatDmsCoordinates(
                  weather.district.coordinates.lat,
                  weather.district.coordinates.lon,
                )}
              </p>
            )}
            <p className="text-[13px] text-white/60">
              {localizeDistrictName(weather.district.name, dict)}, Uganda
            </p>
            <p className="text-[12px] text-white/50">
              {w.windAndGust
                .replace("{speed}", String(displaySpeed))
                .replace("{gust}", String(weather.wind.gustKph))}
            </p>
          </div>
        </div>
      )}

      {windHours.length > 2 && (
        <div className="mt-4">
          <HourlySeriesGraph
            hours={hours}
            valueOf={(hour) => hour.windSpeedKph}
            secondary={{ valueOf: (hour) => hour.gustKph, color: "rgba(90,209,138,0.7)", label: w.topSpeed }}
            directionOf={(hour) => hour.windDegree}
            min={0}
            max={Math.ceil(maxSeriesValue / 10) * 10}
            nowTime={nowHour?.time}
            unit=" km/h"
          />
          <div className="mt-2 flex items-center gap-4 text-[12px] text-white/55">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#5ac8fa]" />
              {w.averageWind}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: "rgba(90,209,138,0.9)" }} />
              {w.strongestWind}
            </span>
          </div>
        </div>
      )}

      <div className="mt-4 pt-3">
        <p
          className={
            isLuganda
              ? "text-[13px] font-semibold text-white/60"
              : "text-[12px] font-semibold uppercase tracking-[0.1rem] text-white/50"
          }
        >
          {dict.metrics.dailySummary}
        </p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-white/78">
          {isToday
            ? w.todaySummary
                .replace("{speed}", String(weather.wind.speedKph))
                .replace(
                  "{direction}",
                  w.compassFullNames[weather.wind.direction] ??
                    COMPASS_FULL_NAME[weather.wind.direction] ??
                    weather.wind.direction,
                )
                .replace("{min}", String(minSpeed))
                .replace("{max}", String(maxSpeed))
                .replace("{gust}", String(maxGust))
            : w.otherDaySummary
                .replace(
                  "{day}",
                  isLuganda
                    ? formatDayPrepositionLg(selectedDay?.day ?? "", false)
                    : (selectedDay?.day ?? ""),
                )
                .replace("{min}", String(minSpeed))
                .replace("{max}", String(maxSpeed))
                .replace("{gust}", String(maxGust))}
        </p>
      </div>

      <div className="mt-4 pt-3">
        <p
          className={
            isLuganda
              ? "text-[13px] font-semibold text-white/60"
              : "text-[12px] font-semibold uppercase tracking-[0.1rem] text-white/50"
          }
        >
          {w.onWaterTitle}
        </p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-white/78">
          {w.onWaterBody}
        </p>
      </div>

      <div className="mt-4 pt-3">
        <p className="text-[15px] font-semibold text-white/90">{w.beaufortTitle}</p>
        <div
          className={
            isLuganda
              ? "mt-2 grid grid-cols-[2rem_1fr_5rem] gap-2 pb-1.5 text-[12px] font-semibold text-white/50"
              : "mt-2 grid grid-cols-[2rem_1fr_5rem] gap-2 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.06rem] text-white/40"
          }
        >
          <span>{w.bftCol}</span>
          <span>{w.descCol}</span>
          <span className="text-right">km/h</span>
        </div>
        {BEAUFORT_SCALE.map((row, index) => {
          const prevMax = index === 0 ? 0 : BEAUFORT_SCALE[index - 1].max;
          const rangeLabel =
            row.max === Infinity ? `> ${prevMax}` : index === 0 ? `< ${row.max}` : `${prevMax + 1} - ${row.max}`;
          const isCurrent = force.force === row.force;
          return (
            <div
              key={row.force}
              className={`grid grid-cols-[2rem_1fr_5rem] items-center gap-2 py-2 text-[14px] ${
                isCurrent ? "text-white" : "text-white/70"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: row.color }} />
                {row.force}
              </span>
              <span>{w.beaufortScale[row.force] ?? row.label}</span>
              <span className="text-right tabular-nums">{rangeLabel}</span>
            </div>
          );
        })}
        <p className="mt-3 text-[13px] leading-relaxed text-white/60">
          {w.beaufortIntro}
        </p>
      </div>
    </div>
  );
}
