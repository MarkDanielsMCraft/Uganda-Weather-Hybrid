import { useId, type ReactNode } from "react";
import { WEATHER_PALETTE as P } from "@/lib/design/weather-palette";
import type { WeatherTheme } from "@/types/weather";

export type IconProps = {
  size?: number;
  className?: string;
  animated?: boolean;
};

function Svg({ size = 24, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/**
 * Continuous cubic Bezier cloud silhouette.
 * Spans x between 2.8 and 30.4, y between 6.2 and 24.0 with a flat baseline at y = 24.0,
 * a smaller left lobe, a secondary upper-left shoulder, a dominant center-right dome,
 * and a tangent right lobe. Zero internal overlapping primitives.
 */
export const CONTINUOUS_CLOUD_PATH =
  "M 8.0 24.0 " +
  "C 5.1 24.0 2.8 21.7 2.8 18.8 " +
  "C 2.8 16.3 4.5 14.2 6.9 13.7 " +
  "C 7.4 11.2 9.6 9.4 12.2 9.4 " +
  "C 12.8 9.4 13.4 9.5 14.0 9.7 " +
  "C 15.3 7.5 17.7 6.2 20.4 6.2 " +
  "C 24.5 6.2 27.8 9.5 27.8 13.6 " +
  "C 27.8 14.1 27.7 14.6 27.6 15.1 " +
  "C 29.3 15.9 30.4 17.6 30.4 19.6 " +
  "C 30.4 22.0 28.4 24.0 26.0 24.0 " +
  "Z";

/**
 * Sunny — Solid Golden Yellow with animated rotating rays.
 */
export function IconSun({ size, className, animated = true }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <circle cx="16" cy="16" r="6.8" fill={P.sun.fill} />
      <g className={animated ? "animate-sun-rays" : undefined} fill={P.sun.ray}>
        {/* Cardinal rays */}
        <rect x="14.75" y="2.0" width="2.5" height="4.4" rx="1.25" />
        <rect x="14.75" y="25.6" width="2.5" height="4.4" rx="1.25" />
        <rect x="2.0" y="14.75" width="4.4" height="2.5" rx="1.25" />
        <rect x="25.6" y="14.75" width="4.4" height="2.5" rx="1.25" />
        {/* Diagonal rays */}
        <rect x="14.75" y="2.0" width="2.5" height="4.4" rx="1.25" transform="rotate(45 16 16)" />
        <rect x="14.75" y="25.6" width="2.5" height="4.4" rx="1.25" transform="rotate(45 16 16)" />
        <rect x="14.75" y="2.0" width="2.5" height="4.4" rx="1.25" transform="rotate(-45 16 16)" />
        <rect x="14.75" y="25.6" width="2.5" height="4.4" rx="1.25" transform="rotate(-45 16 16)" />
      </g>
    </Svg>
  );
}

/**
 * Partly Cloudy — White Cloud and Upper-Left Golden Sun.
 * Sun sits in the upper-left negative space (cx=10.5, cy=11.2)
 * with a 2.8px negative-space knockout separating it from the foreground cloud.
 */
export function IconPartlyCloudy({ size, className, animated = true }: IconProps) {
  const maskId = useId();
  return (
    <Svg size={size} className={className}>
      <defs>
        <mask id={maskId}>
          <rect width="32" height="32" fill="white" />
          <g transform="translate(2.2, 3.2) scale(0.9)">
            <path
              d={CONTINUOUS_CLOUD_PATH}
              fill="black"
              stroke="black"
              strokeWidth="2.8"
              strokeLinejoin="round"
            />
          </g>
        </mask>
      </defs>

      {/* Secondary Layer: Upper-Left Golden Sun masked by cloud knockout */}
      <g mask={`url(#${maskId})`}>
        <circle cx="10.5" cy="11.2" r="4.8" fill={P.sun.fill} />
        <g fill={P.sun.ray}>
          <rect x="9.4" y="2.4" width="2.2" height="3.2" rx="1.1" />
          <rect x="9.4" y="2.4" width="2.2" height="3.2" rx="1.1" transform="rotate(-45 10.5 11.2)" />
          <rect x="9.4" y="2.4" width="2.2" height="3.2" rx="1.1" transform="rotate(45 10.5 11.2)" />
          <rect x="1.8" y="10.1" width="3.2" height="2.2" rx="1.1" />
          <rect x="9.4" y="2.4" width="2.2" height="3.2" rx="1.1" transform="rotate(-135 10.5 11.2)" />
        </g>
      </g>

      {/* Primary Layer: Foreground White Cloud */}
      <g className={animated ? "animate-cloud-float" : undefined}>
        <g transform="translate(2.2, 3.2) scale(0.9)">
          <path d={CONTINUOUS_CLOUD_PATH} fill={P.cloud.white} />
        </g>
      </g>
    </Svg>
  );
}

/**
 * Cloudy — Solid Continuous White Cloud with gentle vertical buoyancy.
 */
export function IconCloudy({ size, className, animated = true }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path
        d={CONTINUOUS_CLOUD_PATH}
        fill={P.cloud.white}
        transform="translate(0, 1.5)"
        className={animated ? "animate-cloud-float" : undefined}
      />
    </Svg>
  );
}

/**
 * Rain — White Cloud and 3 Staggered Slanted Drops.
 * Drops slant down-left at 20 degrees with micro-animation cascades.
 */
export function IconRain({ size, className, animated = true }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <g transform="translate(0, -3.2)">
        <path d={CONTINUOUS_CLOUD_PATH} fill={P.cloud.white} />
      </g>
      {/* Tertiary Layer: 3 staggered cyan drops */}
      <g fill={P.rain.drop}>
        <rect
          x="8.4"
          y="21.6"
          width="2.4"
          height="6.2"
          rx="1.2"
          transform="rotate(20 9.6 24.7)"
          className={animated ? "animate-rain-drop-1" : undefined}
        />
        <rect
          x="14.8"
          y="23.2"
          width="2.4"
          height="6.4"
          rx="1.2"
          transform="rotate(20 16.0 26.4)"
          className={animated ? "animate-rain-drop-2" : undefined}
        />
        <rect
          x="21.2"
          y="21.6"
          width="2.4"
          height="6.2"
          rx="1.2"
          transform="rotate(20 22.4 24.7)"
          className={animated ? "animate-rain-drop-3" : undefined}
        />
      </g>
    </Svg>
  );
}

/**
 * Thunderstorms — White Cloud, Negative-Space Knockout Bolt and Flanking Drops.
 */
export function IconThunder({ size, className, animated = true }: IconProps) {
  const maskId = useId();
  const boltPoints = "16.6,16.2 11.4,23.2 15.3,23.2 12.8,30.2 21.0,21.6 16.8,21.6";

  return (
    <Svg size={size} className={className}>
      <defs>
        <mask id={maskId}>
          <rect width="32" height="32" fill="white" />
          <polygon
            points={boltPoints}
            fill="black"
            stroke="black"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
        </mask>
      </defs>

      {/* Primary Layer: White Cloud with bolt knockout */}
      <g mask={`url(#${maskId})`} transform="translate(0, -3.5)">
        <path d={CONTINUOUS_CLOUD_PATH} fill={P.cloud.white} />
      </g>

      {/* Tertiary Layer: Flanking Cyan-Blue Drops */}
      <g fill={P.rain.drop}>
        <rect
          x="6.8"
          y="21.8"
          width="2.3"
          height="6.0"
          rx="1.15"
          transform="rotate(20 7.95 24.8)"
          className={animated ? "animate-rain-drop-1" : undefined}
        />
        <rect
          x="22.4"
          y="21.8"
          width="2.3"
          height="6.0"
          rx="1.15"
          transform="rotate(20 23.55 24.8)"
          className={animated ? "animate-rain-drop-3" : undefined}
        />
      </g>

      {/* Secondary Layer: Electric Yellow Lightning Bolt */}
      <polygon
        points={boltPoints}
        fill={P.lightning.bolt}
        className={animated ? "animate-lightning" : undefined}
      />
    </Svg>
  );
}

/**
 * Fog — White Cloud and Translucent Mist Strata.
 */
export function IconFog({ size, className, animated = true }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <g transform="translate(0, -4.5)">
        <path d={CONTINUOUS_CLOUD_PATH} fill={P.cloud.white} />
      </g>
      {/* Secondary Layer: Translucent white mist bars */}
      <g fill={P.cloud.white} className={animated ? "animate-wind" : undefined}>
        <rect x="3.5" y="21.2" width="25" height="2.5" rx="1.25" fillOpacity="0.72" />
        <rect x="5.5" y="25.8" width="21" height="2.5" rx="1.25" fillOpacity="0.48" />
      </g>
    </Svg>
  );
}

/**
 * Clear Night — Crescent Moon and Non-Colliding 4-Point Stars.
 */
export function IconMoon({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path
        d="M 13.2 5.2 A 10.5 10.5 0 1 0 21.2 22.8 A 8.6 8.6 0 0 1 13.2 5.2 Z"
        fill={P.moon.fill}
      />
      <g fill={P.cloud.white}>
        <path d="M 24.5 3.8 Q 24.5 7.3 28.0 7.3 Q 24.5 7.3 24.5 10.8 Q 24.5 7.3 21.0 7.3 Q 24.5 7.3 24.5 3.8 Z" />
        <path
          d="M 19.5 11.2 Q 19.5 13.2 21.5 13.2 Q 19.5 13.2 19.5 15.2 Q 19.5 13.2 17.5 13.2 Q 19.5 13.2 19.5 11.2 Z"
          fillOpacity="0.88"
        />
      </g>
    </Svg>
  );
}

/**
 * Haze — Clipped Upper Solar Dome and Staggered Mist Lines.
 */
export function IconHaze({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M 9.6 15.2 A 6.4 6.4 0 0 1 22.4 15.2 Z" fill={P.sun.fill} />
      <g fill={P.sun.ray}>
        <rect x="14.8" y="4.2" width="2.4" height="3.4" rx="1.2" />
        <rect x="14.8" y="4.2" width="2.4" height="3.4" rx="1.2" transform="rotate(-45 16 15.2)" />
        <rect x="14.8" y="4.2" width="2.4" height="3.4" rx="1.2" transform="rotate(45 16 15.2)" />
        <rect x="4.4" y="13.2" width="3.4" height="2.2" rx="1.1" />
        <rect x="24.2" y="13.2" width="3.4" height="2.2" rx="1.1" />
      </g>
      <g fill={P.cloud.white}>
        <rect x="3.0" y="17.2" width="23.5" height="2.3" rx="1.15" fillOpacity="0.78" />
        <rect x="5.5" y="21.6" width="23.5" height="2.3" rx="1.15" fillOpacity="0.60" />
        <rect x="4.0" y="26.0" width="19.0" height="2.3" rx="1.15" fillOpacity="0.42" />
      </g>
    </Svg>
  );
}

/**
 * Sunrise — Golden Sun on Horizon with Upward Stemmed Arrow.
 */
export function IconSunrise({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M 9.5 17.2 A 6.5 6.5 0 0 1 22.5 17.2 Z" fill={P.sun.fill} />
      <g fill={P.sun.ray}>
        <rect x="14.8" y="6.2" width="2.4" height="3.5" rx="1.2" />
        <rect x="14.8" y="6.2" width="2.4" height="3.5" rx="1.2" transform="rotate(-45 16 17.2)" />
        <rect x="14.8" y="6.2" width="2.4" height="3.5" rx="1.2" transform="rotate(45 16 17.2)" />
        <rect x="4.4" y="15.2" width="3.5" height="2.2" rx="1.1" />
        <rect x="24.1" y="15.2" width="3.5" height="2.2" rx="1.1" />
      </g>
      <rect x="3" y="19" width="26" height="2.4" rx="1.2" fill={P.cloud.white} />
      <path
        d="M 16 29.2 V 23.4 M 13.0 26.2 L 16 23.2 L 19.0 26.2"
        stroke={P.sun.ray}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/**
 * Sunset — Golden Sun on Horizon with Downward Stemmed Arrow.
 */
export function IconSunset({ size, className }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <path d="M 9.5 17.2 A 6.5 6.5 0 0 1 22.5 17.2 Z" fill={P.sun.fill} />
      <g fill={P.sun.ray}>
        <rect x="14.8" y="6.2" width="2.4" height="3.5" rx="1.2" />
        <rect x="14.8" y="6.2" width="2.4" height="3.5" rx="1.2" transform="rotate(-45 16 17.2)" />
        <rect x="14.8" y="6.2" width="2.4" height="3.5" rx="1.2" transform="rotate(45 16 17.2)" />
        <rect x="4.4" y="15.2" width="3.5" height="2.2" rx="1.1" />
        <rect x="24.1" y="15.2" width="3.5" height="2.2" rx="1.1" />
      </g>
      <rect x="3" y="19" width="26" height="2.4" rx="1.2" fill={P.cloud.white} />
      <path
        d="M 16 23.2 V 29.0 M 13.0 26.2 L 16 29.2 L 19.0 26.2"
        stroke={P.sun.ray}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/**
 * Windy — Continuous Spiral Hooks with Streamline Micro-Animations.
 */
export function IconWind({ size, className, animated = true }: IconProps) {
  return (
    <Svg size={size} className={className}>
      <g className={animated ? "animate-wind" : undefined}>
        <path
          d="M 3 11.5 H 18.5 A 3 3 0 1 0 15.5 8.5"
          stroke={P.cloud.white}
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 2 16 H 25.5 A 3.25 3.25 0 1 0 22.25 12.75"
          stroke={P.cloud.white}
          strokeOpacity="0.65"
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 5 20.5 H 20.5 A 3 3 0 1 1 17.5 23.5"
          stroke={P.cloud.white}
          strokeWidth="2.4"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    </Svg>
  );
}

const THEME_ICONS: Record<WeatherTheme, (props: IconProps) => ReactNode> = {
  clear: IconSun,
  partly_cloudy: IconPartlyCloudy,
  cloudy: IconCloudy,
  rain: IconRain,
  thunder: IconThunder,
  fog: IconFog,
  night: IconMoon,
};

export function WeatherThemeIcon({
  theme,
  size,
  className,
  animated,
}: IconProps & { theme: WeatherTheme }) {
  const Icon = THEME_ICONS[theme] ?? IconPartlyCloudy;
  return <Icon size={size} className={className} animated={animated} />;
}
