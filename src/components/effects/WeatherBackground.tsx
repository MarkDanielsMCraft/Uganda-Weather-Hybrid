import type { Region, WeatherTheme } from "@/types/weather";
import { WeatherSceneCanvas } from "./WeatherSceneCanvas";

/**
 * Top scrim, a thin readability aid only, not a dimmer. The hero sky
 * should stay fully visible behind the temperature text, not get washed
 * out by the scrim beneath it.
 */
const TOP_SCRIM: Record<WeatherTheme, [string, string, string]> = {
  clear: ["rgba(6, 16, 34, 0.48)", "rgba(6, 16, 34, 0.28)", "rgba(6, 16, 34, 0)"],
  partly_cloudy: ["rgba(6, 14, 30, 0.44)", "rgba(6, 14, 30, 0.25)", "rgba(6, 14, 30, 0)"],
  cloudy: ["rgba(10, 13, 18, 0.34)", "rgba(10, 13, 18, 0.16)", "rgba(10, 13, 18, 0)"],
  rain: ["rgba(4, 9, 16, 0.34)", "rgba(4, 9, 16, 0.16)", "rgba(4, 9, 16, 0)"],
  thunder: ["rgba(3, 4, 9, 0.36)", "rgba(3, 4, 9, 0.18)", "rgba(3, 4, 9, 0)"],
  fog: ["rgba(16, 19, 24, 0.36)", "rgba(16, 19, 24, 0.18)", "rgba(16, 19, 24, 0)"],
  night: ["rgba(6, 5, 16, 0.24)", "rgba(6, 5, 16, 0.06)", "rgba(6, 5, 16, 0)"],
};

const SCRIM_HEIGHT: Record<WeatherTheme, string> = {
  clear: "56%",
  partly_cloudy: "54%",
  cloudy: "42%",
  rain: "40%",
  thunder: "40%",
  fog: "42%",
  night: "26%",
};

export function WeatherBackground({
  theme,
  isDay = true,
  liteMode,
  rainIntensity = 0,
  windDegree = 90,
  moonIllumination = 49,
  moonPhase = "Last Quarter",
}: {
  theme: WeatherTheme;
  isDay?: boolean;
  region?: Region;
  liteMode?: boolean;
  rainIntensity?: number;
  windDegree?: number;
  moonIllumination?: number;
  moonPhase?: string;
}) {
  const scrimTheme = isDay ? theme : "night";
  const [top, mid, bottom] = TOP_SCRIM[scrimTheme];
  const scrimHeight = SCRIM_HEIGHT[scrimTheme] ?? "48%";

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <WeatherSceneCanvas
        theme={theme}
        isDay={isDay}
        liteMode={liteMode}
        rainIntensity={rainIntensity}
        windDegree={windDegree}
        moonIllumination={moonIllumination}
        moonPhase={moonPhase}
      />

      <div
        className="absolute inset-x-0 top-0"
        style={{
          height: scrimHeight,
          background: `linear-gradient(180deg, ${top} 0%, ${mid} 42%, ${bottom} 100%)`,
        }}
      />
    </div>
  );
}
