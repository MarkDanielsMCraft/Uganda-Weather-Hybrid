"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import {
  CLOUD_BACK_LOBES,
  CLOUD_BODY,
  CLOUD_FRONT_LOBES,
  CLOUD_SHADE,
  MARK_COLORS,
  MARK_GRADIENTS,
  RAIN_LINES,
  SUN_CIRCLE,
  SUN_RAYS,
  UGANDA_OUTLINE_PATH,
  WEATHER_PLACEMENT,
} from "@/lib/design/brand-mark";

/** The Uganda Weather mark, drawn from the shared definition in
    `brand-mark.ts` so the header, the app icon and the share card are one
    mark rather than three that drift apart. The land follows the theme
    token here; the static icon files carry the same value as a literal
    because a file served from disk has no stylesheet to read. */
export function WeatherGlyph({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <defs>
        {MARK_GRADIENTS.map((gradient) =>
          gradient.kind === "radial" ? (
            <radialGradient key={gradient.id} id={gradient.id} cx={gradient.cx} cy={gradient.cy} r={gradient.r}>
              {gradient.stops.map((stop) => (
                <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
              ))}
            </radialGradient>
          ) : (
            <linearGradient
              key={gradient.id}
              id={gradient.id}
              x1={gradient.x1}
              y1={gradient.y1}
              x2={gradient.x2}
              y2={gradient.y2}
            >
              {gradient.stops.map((stop) => (
                <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
              ))}
            </linearGradient>
          ),
        )}
      </defs>
      <path d={UGANDA_OUTLINE_PATH} fill="var(--color-brand-green)" />
      <g transform={WEATHER_PLACEMENT}>
        <circle {...SUN_CIRCLE} fill="url(#uwSun)" />
        <g stroke={MARK_COLORS.sunRay} strokeLinecap="round">
          {SUN_RAYS.map((ray) => (
            <line key={`${ray.x1}-${ray.y1}`} x1={ray.x1} y1={ray.y1} x2={ray.x2} y2={ray.y2} strokeWidth={ray.width} />
          ))}
        </g>
        <g fill={CLOUD_SHADE}>
          {CLOUD_BACK_LOBES.map((lobe) => (
            <circle key={`${lobe.cx}-${lobe.cy}`} {...lobe} />
          ))}
        </g>
        <g fill="url(#uwCloud)">
          <rect {...CLOUD_BODY} />
          {CLOUD_FRONT_LOBES.map((lobe) => (
            <circle key={`${lobe.cx}-${lobe.cy}`} {...lobe} />
          ))}
        </g>
        <g stroke="url(#uwRain)" strokeLinecap="round">
          {RAIN_LINES.map((line) => (
            <line key={`${line.x1}-${line.y1}`} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} strokeWidth={line.width} />
          ))}
        </g>
      </g>
    </svg>
  );
}

/** The clickable glyph lockup, shared by the desktop and
    mobile headers so "tap the logo, go home" works everywhere instead of
    the brand text being inert in one of the two. */
export function BrandMark({
  wordmarkClassName,
  glyphSize = 28,
  showWordmark = false,
}: {
  wordmarkClassName?: string;
  glyphSize?: number;
  showWordmark?: boolean;
}) {
  const { dict } = useTranslation();

  return (
    <Link
      href="/"
      aria-label={dict.common.goToHomeAria}
      className="flex shrink-0 items-center gap-2"
    >
      <WeatherGlyph size={glyphSize} />
      {showWordmark && wordmarkClassName && <p className={wordmarkClassName}>Uganda Weather</p>}
    </Link>
  );
}
