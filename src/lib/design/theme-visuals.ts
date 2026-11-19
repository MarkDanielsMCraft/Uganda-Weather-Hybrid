import type { WeatherTheme } from "@/types/weather";
import { SKY_GRADIENTS } from "./weather-palette";

function gradientFromStops(stops: [number, string][]) {
  return `linear-gradient(180deg, ${stops.map(([stop, color]) => `${color} ${Math.round(stop * 100)}%`).join(", ")})`;
}

/** Sidebar tile gradients — matched to canvas sky per theme */
export const THEME_TILE: Record<WeatherTheme, { gradient: string; accent: string }> = {
  clear: {
    gradient: gradientFromStops(SKY_GRADIENTS.clear),
    accent: "#5aa8e8",
  },
  partly_cloudy: {
    gradient: gradientFromStops(SKY_GRADIENTS.partly_cloudy),
    accent: "#6a9ec8",
  },
  cloudy: {
    gradient: gradientFromStops(SKY_GRADIENTS.cloudy),
    accent: "#8a939c",
  },
  rain: {
    gradient: gradientFromStops(SKY_GRADIENTS.rain),
    accent: "#5a7a9a",
  },
  thunder: {
    gradient: gradientFromStops(SKY_GRADIENTS.thunder),
    accent: "#8a78b8",
  },
  fog: {
    gradient: gradientFromStops(SKY_GRADIENTS.fog),
    accent: "#b0b8c0",
  },
  night: {
    gradient: gradientFromStops(SKY_GRADIENTS.night),
    accent: "#6a88b8",
  },
};

export function themeTileStyle(theme: WeatherTheme) {
  return THEME_TILE[theme] ?? THEME_TILE.partly_cloudy;
}
