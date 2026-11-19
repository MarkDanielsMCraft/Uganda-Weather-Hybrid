"use client";

import { useId, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useTranslation } from "@/lib/i18n";
import { formatClockLabelForLanguage } from "@/lib/time/uganda";
import type { HourlyPoint } from "@/types/weather";

export interface ColorStop {
  value: number;
  color: string;
}

export interface BandLabel {
  value: number;
  label: string;
}

/** Picks a colour by linear interpolation between the nearest stops —
    used for severity-graded lines like UV (green through red) instead of
    a single flat accent colour. */
function colorAt(value: number, stops: ColorStop[]): string {
  if (stops.length === 0) return "#5ac8fa";
  if (value <= stops[0].value) return stops[0].color;
  const last = stops[stops.length - 1];
  if (value >= last.value) return last.color;

  for (let i = 0; i < stops.length - 1; i += 1) {
    const a = stops[i];
    const b = stops[i + 1];
    if (value >= a.value && value <= b.value) return b.color;
  }
  return last.color;
}

function formatSeriesValue(value: number, unitStr: string, isLg: boolean): string {
  const rounded = Math.round(value);
  const trimmed = unitStr.trim();
  if (isLg && trimmed && trimmed !== "°" && trimmed !== "°C" && trimmed !== "%") {
    return `${trimmed} ${rounded}`;
  }
  return `${rounded}${unitStr}`;
}

function buildPath(points: Array<{ x: number; y: number }>): string {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
}

const WIDTH = 300;
const HEIGHT = 120;
const PAD_TOP = 8;
const PAD_BOTTOM = 20;

/** A 24-hour line graph shared by every metric detail sheet — hour axis
    along the bottom, numeric or category-band labels on the sides, an
    optional colour-graded line (UV's green-to-red severity, for example),
    an optional second overlaid line (e.g. wind gusts alongside sustained
    speed), an optional per-hour direction-arrow row (wind only), a
    dashed-before-solid-after split at "now" so already-elapsed hours read
    as history rather than forecast, and hover/touch interactivity — a
    vertical indicator snapped to the nearest hour with a tooltip, on both
    mouse and touch. One component instead of every tile hand-rolling its
    own SVG graph. */
export function HourlySeriesGraph({
  hours,
  valueOf,
  max,
  min = 0,
  colorStops,
  bandLabels,
  nowTime,
  secondary,
  directionOf,
  showDayNightIcons,
  showPeakLabels,
  unit = "",
  initialActiveTime,
  sampledValueOf,
  sampledValueUnit = "",
  lineColor = "#5ac8fa",
}: {
  hours: HourlyPoint[];
  valueOf: (hour: HourlyPoint) => number | undefined;
  max: number;
  min?: number;
  /** Colour-grades the line by value (e.g. UV's Low->Extreme gradient).
      Omit for a flat single-colour line. */
  colorStops?: ColorStop[];
  /** Category labels down the left edge (e.g. UV's Extreme/High/Moderate/Low)
      instead of plain numeric ticks. */
  bandLabels?: BandLabel[];
  /** Hour.time of "now" — draws the now-marker and splits the line dashed
      (elapsed hours) vs solid (current + forecast) here. Omit when the
      selected day isn't today, so the whole line renders solid. */
  nowTime?: string;
  /** A second overlaid line with no area fill, in a muted colour — e.g.
      gusts drawn alongside sustained wind speed. */
  secondary?: { valueOf: (hour: HourlyPoint) => number | undefined; color?: string; label?: string };
  /** Renders a row of small arrows above the graph, one per sampled hour,
      rotated to the wind's "blowing from" degree — same convention as the
      compass elsewhere in the app. Wind only. */
  directionOf?: (hour: HourlyPoint) => number | undefined;
  /** Renders a row of small sun/moon glyphs above the graph, one per
      sampled hour, from each hour's own isDay flag. Temperature-style
      graphs only. */
  showDayNightIcons?: boolean;
  /** Labels the highest and lowest points on the primary line "H"/"L",
      matching the day's high/low the way the compact 10-day rows already
      do. Skipped when the line is flat enough that both would land on the
      same point. */
  showPeakLabels?: boolean;
  /** Appended after the value in the hover tooltip, e.g. "km/h" or "%". */
  unit?: string;
  /** Pre-selects a point (tooltip + vertical indicator shown immediately,
      no hover needed) — e.g. tapping a specific hour in the hourly strip
      and landing here with that exact hour already highlighted. */
  initialActiveTime?: string;
  /** Renders a row of sampled values above the graph (e.g. dew point
      alongside the humidity curve), each with a thin dotted guide line
      down through the chart at that hour — a second, secondary reading
      shown at a few points rather than as its own full line. */
  sampledValueOf?: (hour: HourlyPoint) => number | undefined;
  sampledValueUnit?: string;
  /** Primary line/fill colour — most tiles use the default blue, but a
      few (pressure's magenta, for instance) use their own to stay visually
      distinct from temperature/humidity-style graphs at a glance. */
  lineColor?: string;
}) {
  const { dict, uiLanguage } = useTranslation();
  const isLuganda = uiLanguage === "lg";
  const gradientId = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const series = hours.filter((hour) => hour.kind === "hour" && valueOf(hour) != null);
  const firstSeriesTime = series[0]?.time;
  const resolvedInitialIndex = initialActiveTime
    ? series.findIndex((hour) => hour.time === initialActiveTime)
    : -1;
  const [trackedFirstTime, setTrackedFirstTime] = useState<string | undefined>(firstSeriesTime);
  const [activeIndex, setActiveIndex] = useState<number | null>(
    resolvedInitialIndex >= 0 ? resolvedInitialIndex : null,
  );
  if (firstSeriesTime !== trackedFirstTime) {
    setTrackedFirstTime(firstSeriesTime);
    setActiveIndex(resolvedInitialIndex >= 0 ? resolvedInitialIndex : null);
  }
  if (series.length < 2) return null;

  const span = Math.max(max - min, 1);

  const toY = (value: number) => {
    const t = Math.min(1, Math.max(0, (value - min) / span));
    return PAD_TOP + (1 - t) * (HEIGHT - PAD_TOP - PAD_BOTTOM);
  };

  const points = series.map((hour, index) => ({
    x: (index / (series.length - 1)) * WIDTH,
    y: toY(valueOf(hour) ?? min),
    value: valueOf(hour) ?? min,
    hour,
  }));

  const areaPath = `${buildPath(points)} L${WIDTH},${HEIGHT - PAD_BOTTOM} L0,${HEIGHT - PAD_BOTTOM} Z`;

  const nowIndex = nowTime ? series.findIndex((hour) => hour.time === nowTime) : -1;
  const nowPoint = nowIndex >= 0 ? points[nowIndex] : undefined;
  const historyPoints = nowIndex > 0 ? points.slice(0, nowIndex + 1) : [];
  const forwardPoints = nowIndex >= 0 ? points.slice(nowIndex) : points;

  const secondaryPoints = secondary
    ? series.map((hour, index) => ({
        x: (index / (series.length - 1)) * WIDTH,
        y: toY(secondary.valueOf(hour) ?? min),
        value: secondary.valueOf(hour),
      }))
    : null;

  const hourTickIndexes = Array.from(
    new Set(
      [0, Math.round(series.length / 3), Math.round((series.length * 2) / 3), series.length - 1].filter(
        (i) => i >= 0 && i < series.length,
      ),
    ),
  );

  const sampleCount = 9;
  const directionSamples = directionOf
    ? Array.from({ length: sampleCount }, (_, i) => {
        const index = Math.round((i / (sampleCount - 1)) * (series.length - 1));
        return { degree: directionOf(series[index]), index };
      })
    : [];
  const dayNightSamples = showDayNightIcons
    ? Array.from({ length: sampleCount }, (_, i) => {
        const index = Math.round((i / (sampleCount - 1)) * (series.length - 1));
        return { isDay: series[index]?.isDay, index };
      })
    : [];
  const valueSamples = sampledValueOf
    ? Array.from({ length: sampleCount }, (_, i) => {
        const index = Math.round((i / (sampleCount - 1)) * (series.length - 1));
        return { value: sampledValueOf(series[index]), x: points[index]?.x ?? 0, index };
      })
    : [];

  let peakPoint: (typeof points)[number] | undefined;
  let troughPoint: (typeof points)[number] | undefined;
  if (showPeakLabels) {
    for (const point of points) {
      if (!peakPoint || point.value > peakPoint.value) peakPoint = point;
      if (!troughPoint || point.value < troughPoint.value) troughPoint = point;
    }
    if (peakPoint && troughPoint && peakPoint.x === troughPoint.x) troughPoint = undefined;
  }

  function updateActiveFromClientX(clientX: number) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const index = Math.round(ratio * (series.length - 1));
    setActiveIndex(index);
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    updateActiveFromClientX(event.clientX);
  }

  function handlePointerLeave() {
    setActiveIndex(null);
  }

  const activePoint = activeIndex != null ? points[activeIndex] : undefined;
  const activeSecondary = activeIndex != null ? secondaryPoints?.[activeIndex] : undefined;

  // Interpolate both left position and translateX across [0%, 100%] so the
  // tooltip stays strictly inside the graph container on narrow sheets.
  const tooltipAnchorPct =
    activePoint != null ? Math.min(100, Math.max(0, (activePoint.x / WIDTH) * 100)) : 50;

  return (
    <div className="mt-1">
      {(directionOf || showDayNightIcons) && (
        <div className="mb-1 flex justify-between">
          {(directionOf ? directionSamples : dayNightSamples).map((sample, i) => (
            <span key={i} className="inline-block text-[11px] text-white/45" aria-hidden="true">
              {directionOf
                ? "degree" in sample && sample.degree != null
                  ? <span style={{ display: "inline-block", transform: `rotate(${sample.degree}deg)` }}>↑</span>
                  : ""
                : "isDay" in sample
                  ? sample.isDay
                    ? "☀"
                    : "☾"
                  : ""}
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        {bandLabels && (
          <div
            className={`flex shrink-0 flex-col justify-between py-1 text-right text-[11px] leading-tight text-white/45 ${
              uiLanguage === "lg" ? "w-[6.5rem]" : "w-16"
            }`}
          >
            {/* Highest value first — y=0 is the top of the SVG, and the
                graph maps the max value to the smallest y, so the label
                column has to read highest-to-lowest top-to-bottom
                regardless of what order the caller's array happens to be
                in. */}
            {[...bandLabels]
              .sort((a, b) => b.value - a.value)
              .map((band) => (
                <span key={band.label}>{band.label}</span>
              ))}
          </div>
        )}

        <div className="relative min-w-0 flex-1">
          {valueSamples.length > 0 && (
            <div className="relative h-4 text-[11px] text-white/50">
              {valueSamples.map((sample, sampleIdx) => {
                if (sample.value == null) return null;
                const alignClass =
                  sampleIdx === 0
                    ? "translate-x-0"
                    : sampleIdx === valueSamples.length - 1
                      ? "-translate-x-full"
                      : "-translate-x-1/2";
                return (
                  <span
                    key={sample.index}
                    className={`absolute whitespace-nowrap ${alignClass}`}
                    style={{ left: `${(sample.x / WIDTH) * 100}%` }}
                  >
                    {formatSeriesValue(sample.value, sampledValueUnit, isLuganda)}
                  </span>
                );
              })}
            </div>
          )}

          {activePoint && (
            <div
              className="pointer-events-none absolute z-10 max-w-[min(195px,100%)] rounded-lg border border-white/15 bg-[rgba(15,18,32,0.95)] px-2.5 py-1.5 text-[12px] leading-tight shadow-[0_8px_20px_rgba(0,0,0,0.4)]"
              style={{
                left: `${tooltipAnchorPct.toFixed(1)}%`,
                top: 0,
                transform: `translate(-${tooltipAnchorPct.toFixed(1)}%, 0)`,
              }}
            >
              <p className="font-medium text-white">
                <span className="whitespace-nowrap">
                  {formatSeriesValue(activePoint.value, unit, isLuganda)}
                </span>
                {activeSecondary?.value != null && (
                  <span className="ml-1.5 inline-block text-white/55">
                    / {formatSeriesValue(activeSecondary.value, unit, isLuganda)} {secondary?.label ?? ""}
                  </span>
                )}
              </p>
              <p className="whitespace-nowrap text-white/50">
                {activePoint.hour.label.trim().toLowerCase() === "now"
                  ? dict.common.now
                  : formatClockLabelForLanguage(activePoint.hour.label, uiLanguage, "compact")}
              </p>
            </div>
          )}

          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            preserveAspectRatio="none"
            className="h-[120px] w-full touch-none overflow-visible"
            role="img"
            aria-label={dict.sheets.graphAriaLabel}
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerMove}
            onPointerLeave={handlePointerLeave}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={lineColor} stopOpacity="0.35" />
                <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
              </linearGradient>
            </defs>

            {valueSamples.map((sample) =>
              sample.value == null ? null : (
                <line
                  key={`sample-${sample.index}`}
                  x1={sample.x}
                  y1={PAD_TOP}
                  x2={sample.x}
                  y2={HEIGHT - PAD_BOTTOM}
                  stroke="rgba(255,255,255,0.18)"
                  strokeWidth="1"
                  strokeDasharray="1 3"
                  vectorEffect="non-scaling-stroke"
                />
              ),
            )}

            {bandLabels?.map((band) => {
              const y = toY(band.value);
              return (
                <line
                  key={band.label}
                  x1="0"
                  y1={y}
                  x2={WIDTH}
                  y2={y}
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}

            <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />

            {secondaryPoints && (
              <path
                d={buildPath(secondaryPoints)}
                fill="none"
                stroke={secondary?.color ?? "rgba(90,200,250,0.55)"}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {colorStops ? (
              points.slice(1).map((point, index) => {
                const prev = points[index];
                return (
                  <line
                    key={index}
                    x1={prev.x}
                    y1={prev.y}
                    x2={point.x}
                    y2={point.y}
                    stroke={colorAt((prev.value + point.value) / 2, colorStops)}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                );
              })
            ) : historyPoints.length > 1 ? (
              <>
                <path
                  d={buildPath(historyPoints)}
                  fill="none"
                  stroke={lineColor}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeDasharray="1.5 4"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={buildPath(forwardPoints)}
                  fill="none"
                  stroke={lineColor}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </>
            ) : (
              <path
                d={buildPath(points)}
                fill="none"
                stroke={lineColor}
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {peakPoint && (
              <>
                <circle cx={peakPoint.x} cy={peakPoint.y} r="2.5" fill={lineColor} />
                <text
                  x={peakPoint.x}
                  y={Math.max(8, peakPoint.y - 8)}
                  textAnchor="middle"
                  fontSize="9"
                  fill="rgba(255,255,255,0.55)"
                >
                  {isLuganda ? "Wg" : "H"}
                </text>
              </>
            )}
            {troughPoint && (
              <>
                <circle cx={troughPoint.x} cy={troughPoint.y} r="2.5" fill={lineColor} />
                <text
                  x={troughPoint.x}
                  y={Math.min(HEIGHT - PAD_BOTTOM - 4, troughPoint.y + 14)}
                  textAnchor="middle"
                  fontSize="9"
                  fill="rgba(255,255,255,0.55)"
                >
                  {isLuganda ? "Wn" : "L"}
                </text>
              </>
            )}

            {nowPoint && (
              <circle
                cx={nowPoint.x}
                cy={nowPoint.y}
                r="4"
                fill="white"
                stroke="#1a1524"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {activePoint && (
              <>
                <line
                  x1={activePoint.x}
                  y1={PAD_TOP}
                  x2={activePoint.x}
                  y2={HEIGHT - PAD_BOTTOM}
                  stroke="rgba(255,255,255,0.35)"
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
                <circle
                  cx={activePoint.x}
                  cy={activePoint.y}
                  r="3.5"
                  fill={lineColor}
                  stroke="white"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
                {activeSecondary && (
                  <circle
                    cx={activeSecondary.x}
                    cy={activeSecondary.y}
                    r="3"
                    fill={secondary?.color ?? "rgba(90,200,250,0.9)"}
                    stroke="white"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </>
            )}
          </svg>

          <div className="mt-1 flex justify-between text-[11px] text-white/40">
            {hourTickIndexes.map((index, i) => {
              const rawLabel = series[index]?.label ?? "";
              const formatted =
                rawLabel.trim().toLowerCase() === "now"
                  ? dict.common.now
                  : formatClockLabelForLanguage(rawLabel, uiLanguage, "compact");
              return (
                <span key={i} className="whitespace-nowrap">
                  {formatted}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
