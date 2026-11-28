"use client";

import { useTranslation } from "@/lib/i18n";
import { formatWindDirectionLg } from "@/lib/weather/copy-lg";
import { degreesToCompass } from "@/lib/weather/wmo";

const VIEW = 240;
const C = VIEW / 2;
const CARDINALS = [
  { label: "N", deg: 0 },
  { label: "E", deg: 90 },
  { label: "S", deg: 180 },
  { label: "W", deg: 270 },
] as const;

/** Sizes at or above this render full degree numerals around the bezel. */
const NUMERALS_MIN_SIZE = 160;

export function normalizeDegree(degree: number): number {
  return Number.isFinite(degree) ? ((Math.round(degree) % 360) + 360) % 360 : 0;
}

export function formatDmsCoordinates(lat: number, lon: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return "";
  const formatCoord = (val: number, posCard: string, negCard: string) => {
    const card = val >= 0 ? posCard : negCard;
    const abs = Math.abs(val);
    const deg = Math.floor(abs);
    const minFloat = (abs - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = Math.round((minFloat - min) * 60);
    return `${deg}°${min}'${sec}" ${card}`;
  };
  return `${formatCoord(lat, "N", "S")}  ${formatCoord(lon, "E", "W")}`;
}

function polar(radius: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: C + radius * Math.cos(rad), y: C + radius * Math.sin(rad) };
}

/**
 * Precision navigational compass dial.
 * The bezel and rose rotate with the wind bearing to align directly with the
 * top 12 o'clock index line, displaying the exact heading angle, cardinal point,
 * and North reference.
 */
export function WindCompass({ degree, size = 96 }: { degree: number; size?: number }) {
  const safeSize = Number.isFinite(size) && size > 0 ? size : 96;
  const deg = normalizeDegree(degree);
  const showNumerals = safeSize >= NUMERALS_MIN_SIZE;

  // Geometry
  const outerR = showNumerals ? 88 : 98;
  const tickStep = showNumerals ? 2 : 5;
  const cardinalR = showNumerals ? 56 : 64;

  const ticks = [];
  for (let d = 0; d < 360; d += tickStep) {
    const major = d % 30 === 0;
    const mid = !major && d % 10 === 0;
    const innerR = outerR - (major ? 13 : mid ? 9 : 5);
    const a = polar(outerR, d);
    const b = polar(innerR, d);
    ticks.push(
      <line
        key={d}
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke="white"
        strokeOpacity={major ? 0.95 : mid ? 0.65 : 0.35}
        strokeWidth={major ? 2 : 1}
        strokeLinecap="round"
      />,
    );
  }

  const { dict, uiLanguage } = useTranslation();
  const direction = degreesToCompass(deg);
  const localizedDirection =
    uiLanguage === "lg" ? formatWindDirectionLg(direction) : direction;
  const ariaLabel = dict.common.windCompassAria
    .replace("{deg}", String(deg))
    .replace("{direction}", localizedDirection);
  const rotationAngle = deg === 0 ? 0 : -deg;

  return (
    <div
      data-no-narrate
      className="relative shrink-0 select-none"
      style={{ height: safeSize, width: safeSize }}
      role="img"
      aria-label={ariaLabel}
    >
      <svg viewBox={`0 0 ${VIEW} ${VIEW}`} width="100%" height="100%" aria-hidden="true">
        {/* Recessed dial plate */}
        <circle cx={C} cy={C} r={outerR + 2} fill="rgba(0, 0, 0, 0.45)" />

        {/* Rotating compass card (rose, numerals, ticks, North marker) */}
        <g
          data-testid="wind-compass-needle"
          style={{
            transform: `rotate(${rotationAngle}deg)`,
            transformOrigin: `${C}px ${C}px`,
            transition: "transform 0.3s ease-out",
          }}
        >
          {/* Degree ticks */}
          <g>{ticks}</g>

          {/* Prominent Red North indicator triangle at 0 degrees, pointing inward toward ticks */}
          <polygon
            points={`${polar(outerR + 12, 0).x - 6},${polar(outerR + 12, 0).y} ${polar(outerR + 12, 0).x + 6},${polar(outerR + 12, 0).y} ${polar(outerR - 2, 0).x},${polar(outerR - 2, 0).y}`}
            fill="#FF3B30"
          />

          {/* 30 degree bezel numerals on large dials */}
          {showNumerals &&
            Array.from({ length: 12 }, (_, i) => i * 30).map((d) => {
              // Offset the 0 numeral slightly so it sits neatly outside the red North pointer
              const p = polar(outerR + (d === 0 ? 24 : 18), d);
              return (
                <text
                  key={d}
                  x={p.x}
                  y={p.y}
                  fill={d === 0 ? "#FF3B30" : "white"}
                  fillOpacity={d === 0 ? 1 : 0.75}
                  fontSize={10.5}
                  fontWeight={d === 0 ? 700 : 500}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {d}
                </text>
              );
            })}

          {/* Cardinal direction labels */}
          {CARDINALS.map(({ label, deg: d }) => {
            const p = polar(cardinalR, d);
            const isNorth = label === "N";
            return (
              <text
                key={label}
                x={p.x}
                y={p.y}
                fill="white"
                fillOpacity={isNorth ? 1 : 0.85}
                fontSize={showNumerals ? 18 : 20}
                fontWeight={isNorth ? 700 : 600}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {label}
              </text>
            );
          })}
        </g>

        {/* Center reticle and crosshairs */}
        <circle
          cx={C}
          cy={C}
          r={showNumerals ? 28 : 22}
          fill="rgba(255, 255, 255, 0.06)"
          stroke="rgba(255, 255, 255, 0.16)"
          strokeWidth={1}
        />
        <line
          x1={C - (showNumerals ? 40 : 26)}
          y1={C}
          x2={C + (showNumerals ? 40 : 26)}
          y2={C}
          stroke="rgba(255, 255, 255, 0.3)"
          strokeWidth={1}
        />
        <line
          x1={C}
          y1={C - (showNumerals ? 40 : 26)}
          x2={C}
          y2={C + (showNumerals ? 40 : 26)}
          stroke="rgba(255, 255, 255, 0.3)"
          strokeWidth={1}
        />

        {/* Center micro-crosshair */}
        {showNumerals && (
          <>
            <line
              x1={C - 5}
              y1={C}
              x2={C + 5}
              y2={C}
              stroke="rgba(255, 255, 255, 0.7)"
              strokeWidth={1.5}
            />
            <line
              x1={C}
              y1={C - 5}
              x2={C}
              y2={C + 5}
              stroke="rgba(255, 255, 255, 0.7)"
              strokeWidth={1.5}
            />
          </>
        )}

        {/* In small dials without external labels, render clean center degree readout */}
        {!showNumerals && (
          <g>
            <rect
              x={C - 26}
              y={C - 16}
              width={52}
              height={32}
              rx={6}
              fill="rgba(18, 16, 26, 0.88)"
              stroke="rgba(255, 255, 255, 0.2)"
              strokeWidth={1}
            />
            <text
              x={C}
              y={C - 4}
              fill="white"
              fontSize={14}
              fontWeight={700}
              textAnchor="middle"
              dominantBaseline="central"
              data-testid="wind-compass-degree"
            >
              {deg}°
            </text>
            <text
              x={C}
              y={C + 7}
              fill="white"
              fillOpacity={0.7}
              fontSize={9}
              fontWeight={600}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {direction}
            </text>
          </g>
        )}

        {/* Fixed 12 o'clock lubber pointer marking exact heading bearing */}
        <g id="compass-lubber-pointer" style={{ filter: "drop-shadow(0 0 3px rgba(0,0,0,0.85))" }}>
          <line
            x1={C}
            y1={6}
            x2={C}
            y2={showNumerals ? 46 : 34}
            stroke="#FFFFFF"
            strokeWidth={showNumerals ? 3.5 : 2.5}
            strokeLinecap="round"
          />
        </g>
      </svg>
    </div>
  );
}
