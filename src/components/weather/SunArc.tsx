"use client";

import { useEffect, useId, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { nowInUgandaMinutes } from "@/lib/time/uganda";
export { nowInUgandaMinutes };

export function useUgandaNowMinutes(): number | null {
  const [nowMin, setNowMin] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNowMin(nowInUgandaMinutes());
    update();
    const id = window.setInterval(update, 60_000);
    return () => window.clearInterval(id);
  }, []);
  return nowMin;
}

/** Parses the app's own "6:59 pm" style time labels — nothing more is
    available from the astronomy data, so the sun-arc graph and daylight
    stats below are built entirely from sunrise/sunset rather than
    claiming twilight or seasonal-average data we don't actually have. */
export function clockLabelToMinutes(label: string): number | null {
  const match = label.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!match) return null;
  let hour = Number(match[1]) % 12;
  const minute = Number(match[2]);
  if (/pm/i.test(match[3])) hour += 12;
  return hour * 60 + minute;
}

export function formatMinutes(totalMinutes: number): string {
  const rounded = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(rounded / 60);
  const minutes = rounded % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export function SunArc({
  sunrise,
  sunset,
  compact = false,
}: {
  sunrise: string;
  sunset: string;
  compact?: boolean;
}) {
  const { dict } = useTranslation();
  const gradientId = useId();
  const nowMin = useUgandaNowMinutes();
  const sunriseMin = clockLabelToMinutes(sunrise);
  const sunsetMin = clockLabelToMinutes(sunset);
  if (sunriseMin == null || sunsetMin == null || sunsetMin <= sunriseMin) return null;

  const span = sunsetMin - sunriseMin;
  const progress = nowMin != null ? Math.min(1, Math.max(0, (nowMin - sunriseMin) / span)) : 0;
  const isDaytime = nowMin != null && nowMin >= sunriseMin && nowMin <= sunsetMin;

  const width = 100;
  const height = compact ? 26 : 40;
  const baseline = height - 3;
  const amplitude = height - (compact ? 7 : 10);
  const arcY = (t: number) => baseline - Math.sin(t * Math.PI) * amplitude;

  const points = Array.from({ length: 21 }, (_, i) => {
    const t = i / 20;
    return { x: t * width, y: arcY(t) };
  });
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ");
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  return (
    <div className={compact ? "mt-3" : "mt-1"}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className={compact ? "h-7 w-full overflow-visible" : "h-12 w-full overflow-visible"}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f0c060" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#f0c060" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
        <path
          d={linePath}
          fill="none"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        {isDaytime && (
          <circle
            cx={progress * width}
            cy={arcY(progress)}
            r={compact ? 2.6 : 3.2}
            fill="#f0c060"
            stroke="#1a1524"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      {!compact && (
        <div className="mt-1 flex justify-between text-[11px] text-white/40">
          <span>{dict.sheets.sunset.sunrise}</span>
          <span>{dict.common.solarNoon}</span>
          <span>{dict.sheets.sunset.sunset}</span>
        </div>
      )}
    </div>
  );
}
