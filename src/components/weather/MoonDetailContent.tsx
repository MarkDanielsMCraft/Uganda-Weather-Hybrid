"use client";

import { useState } from "react";
import { moonInfo } from "@/lib/weather/wmo";
import { useTranslation } from "@/lib/i18n";
import { ugandaCalendarDate } from "@/lib/time/uganda";
import { formatMonthYearLg, formatShortDateLg } from "@/lib/weather/copy-lg";

const LUNAR_CYCLE = 29.530588853;
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14, 0);

function daysSinceNewMoon(date: Date): number {
  const days = (date.getTime() - KNOWN_NEW_MOON) / 86_400_000;
  return ((days % LUNAR_CYCLE) + LUNAR_CYCLE) % LUNAR_CYCLE;
}

function nextNewMoon(from: Date): Date {
  const daysUntil = LUNAR_CYCLE - daysSinceNewMoon(from);
  return new Date(from.getTime() + daysUntil * 86_400_000);
}

function nextFullMoon(from: Date): Date {
  const phase = daysSinceNewMoon(from);
  const half = LUNAR_CYCLE / 2;
  const daysUntil = phase < half ? half - phase : half - phase + LUNAR_CYCLE;
  return new Date(from.getTime() + daysUntil * 86_400_000);
}

function sameUtcDate(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function formatMonthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** Renders the moon's lit region as a circle split by a terminator
    ellipse, the standard technique for a phase icon: the terminator's
    horizontal radius is R*cos(theta), where theta runs 0 (new) to pi
    (full) to 2*pi (back to new) — positive values curve the terminator
    one way (crescent), negative the other (gibbous). */
function MoonPhaseIcon({
  illumination,
  waxing,
  size = 20,
}: {
  illumination: number;
  waxing: boolean;
  size?: number;
}) {
  const r = size / 2 - 0.75;
  const cx = size / 2;
  const cy = size / 2;
  const fraction = Math.min(1, Math.max(0, illumination / 100));
  const theta = Math.acos(1 - 2 * fraction);
  const rx = Math.abs(r * Math.cos(theta));
  const bulgesOut = Math.cos(theta) < 0;
  const litOnRight = waxing;

  const top = `${cx},${cy - r}`;
  const bottom = `${cx},${cy + r}`;
  const outerSweep = litOnRight ? 1 : 0;
  const terminatorSweep = bulgesOut ? outerSweep : 1 - outerSweep;

  const path = `M ${top} A ${r} ${r} 0 0 ${outerSweep} ${bottom} A ${rx} ${r} 0 0 ${terminatorSweep} ${top} Z`;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} fill="#2a2f45" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" />
      <path d={path} fill="#e8ecf4" />
    </svg>
  );
}

/** Moon's detail sheet — a month calendar of phases plus New/Full Moon
    dates, not the hourly-graph shell every other metric sheet uses, since
    moon phase is a ~29.5 day cycle, not something that changes hour to
    hour. New/Full Moon dates come from the same phase formula already
    used for today's reading (`moonInfo` in wmo.ts), just solved for the
    date instead of evaluated at it — no extra data source needed, it's
    deterministic astronomy. */
export function MoonDetailContent() {
  const { dict, uiLanguage } = useTranslation();
  const isLuganda = uiLanguage === "lg";
  const m = dict.sheets.moon;
  const [todayYear, todayMonth, todayDay] = ugandaCalendarDate(new Date()).split("-").map(Number);
  const today = new Date(Date.UTC(todayYear, todayMonth - 1, todayDay, 12));
  const [viewYear, setViewYear] = useState(today.getUTCFullYear());
  const [viewMonth, setViewMonth] = useState(today.getUTCMonth());

  function goToMonth(delta: number) {
    const next = new Date(Date.UTC(viewYear, viewMonth + delta, 1));
    setViewYear(next.getUTCFullYear());
    setViewMonth(next.getUTCMonth());
  }

  const firstOfMonth = new Date(Date.UTC(viewYear, viewMonth, 1));
  const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
  const firstWeekdayMondayFirst = (firstOfMonth.getUTCDay() + 6) % 7;

  const cells: Array<{ day: number; date: Date } | null> = [];
  for (let i = 0; i < firstWeekdayMondayFirst; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ day, date: new Date(Date.UTC(viewYear, viewMonth, day, 12)) });
  }

  const newMoon = nextNewMoon(today);
  const fullMoon = nextFullMoon(today);

  return (
    <div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => goToMonth(-1)}
          aria-label={dict.common.previousMonth}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white/70"
        >
          ‹
        </button>
        <p className="text-[15px] font-medium text-white">
          {isLuganda ? formatMonthYearLg(viewYear, viewMonth) : formatMonthLabel(viewYear, viewMonth)}
        </p>
        <button
          type="button"
          onClick={() => goToMonth(1)}
          aria-label={dict.common.nextMonth}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white/70"
        >
          ›
        </button>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-y-2 text-center">
        {dict.common.weekdayInitials.map((label, index) => (
          <span key={`${label}-${index}`} className="text-[11px] font-medium text-white/40">
            {label}
          </span>
        ))}
        {cells.map((cell, index) => {
          if (!cell) return <div key={`empty-${index}`} />;
          const { illumination } = moonInfo(cell.date);
          const waxing = daysSinceNewMoon(cell.date) < LUNAR_CYCLE / 2;
          const isToday = sameUtcDate(cell.date, today);
          return (
            <div
              key={cell.day}
              className={`flex flex-col items-center gap-1 rounded-lg py-1 ${
                isToday ? "bg-white/10" : ""
              }`}
            >
              <span className={`text-[12px] ${isToday ? "font-semibold text-white" : "text-white/70"}`}>
                {cell.day}
              </span>
              <MoonPhaseIcon illumination={illumination} waxing={waxing} />
            </div>
          );
        })}
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between py-2.5 text-[14px]">
          <span className="text-white/70">{m.newMoon}</span>
          <span className="text-white">{isLuganda ? formatShortDateLg(newMoon) : formatShortDate(newMoon)}</span>
        </div>
        <div className="flex items-center justify-between py-2.5 text-[14px]">
          <span className="text-white/70">{m.fullMoon}</span>
          <span className="text-white">{isLuganda ? formatShortDateLg(fullMoon) : formatShortDate(fullMoon)}</span>
        </div>
      </div>

      <div className="mt-4 pt-3">
        <p className="text-[13px] font-semibold text-white/85">{m.aboutIlluminationTitle}</p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-white/72">
          {m.aboutIlluminationBody}
        </p>
      </div>

      <div className="mt-4 pt-3">
        <p className="text-[13px] font-semibold text-white/85">{m.aboutDistanceTitle}</p>
        <p className="mt-1.5 text-[14px] leading-relaxed text-white/72">
          {m.aboutDistanceBody}
        </p>
      </div>
    </div>
  );
}
