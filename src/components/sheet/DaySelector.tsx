"use client";

import { useTranslation } from "@/lib/i18n";
import { formatDayLg, formatFullDateLg } from "@/lib/weather/copy-lg";
import type { DailyPoint } from "@/types/weather";

function weekdayInitial(date: string): string {
  // date is a plain "YYYY-MM-DD" string with no time component — parsing
  // and formatting both in UTC keeps the weekday from shifting a day
  // depending on the browser's local timezone offset.
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "narrow",
    timeZone: "UTC",
  });
}

function weekdayLongEn(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });
}

function dayOfMonth(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    day: "numeric",
    timeZone: "UTC",
  });
}

function fullDateLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** The 7(-10)-day picker shown at the top of every metric detail sheet —
    weekday initials with day numbers, a highlighted selected day, and a
    prev/next row with the full date spelled out. Shared across every tile
    that has day-by-day forecast data (UV, wind, humidity, pressure,
    visibility, precipitation, feels like) so browsing to another day's
    reading works the same way everywhere instead of each tile inventing
    its own version. */
export function DaySelector({
  days,
  selectedIndex,
  onSelect,
}: {
  days: DailyPoint[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const { dict, uiLanguage } = useTranslation();
  const isLuganda = uiLanguage === "lg";
  const selected = days[selectedIndex];
  if (!selected?.date) return null;

  return (
    <div className="mb-4">
      <div className={isLuganda ? "grid grid-cols-4 gap-1" : "grid grid-cols-7 gap-1 sm:grid-cols-8"}>
        {days.slice(0, 8).map((day, index) => {
          if (!day.date) return null;
          const isSelected = index === selectedIndex;
          const lgDayName = day.isToday ? "Leero" : formatDayLg(weekdayLongEn(day.date));
          return (
            <button
              key={day.date}
              type="button"
              onClick={() => onSelect(index)}
              className="flex flex-col items-center gap-1 rounded-lg py-1"
            >
              <span
                className={
                  isLuganda
                    ? "whitespace-nowrap text-[10px] font-medium leading-tight tracking-[-0.02em] text-white/60 sm:text-[11px] sm:tracking-normal"
                    : "text-[11px] font-medium text-white/45"
                }
              >
                {isLuganda ? lgDayName : weekdayInitial(day.date)}
              </span>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-medium transition ${
                  isSelected
                    ? "border border-white/25 bg-white/[0.18] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] backdrop-blur-md"
                    : day.isToday
                      ? "border border-white/30 text-white"
                      : "text-white/75"
                }`}
              >
                {dayOfMonth(day.date)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 pt-3">
        <button
          type="button"
          onClick={() => onSelect(Math.max(0, selectedIndex - 1))}
          disabled={selectedIndex <= 0}
          aria-label={dict.common.previousDay}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white/70 disabled:opacity-30"
        >
          ‹
        </button>
        <p className="min-w-0 flex-1 text-center text-[14px] text-white/80">
          {isLuganda ? formatFullDateLg(selected.date) : fullDateLabel(selected.date)}
        </p>
        <button
          type="button"
          onClick={() => onSelect(Math.min(days.length - 1, selectedIndex + 1))}
          disabled={selectedIndex >= days.length - 1}
          aria-label={dict.common.nextDay}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white/70 disabled:opacity-30"
        >
          ›
        </button>
      </div>
    </div>
  );
}
