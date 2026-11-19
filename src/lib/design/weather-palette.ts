import type { WeatherTheme } from "@/types/weather";

/**
 * Standard meteorological weather colors.
 * Sun: system yellow (#FFCC00). Rain: cyan-blue. Lightning: yellow on dark cloud.
 * Reference: WeatherAPI icon conventions, WMO station symbology.
 */
export const WEATHER_PALETTE = {
  sun: {
    fill: "#FFCC00",
    ray: "#FFB800",
    core: "#FFE566",
    glow: "#FF9500",
    wash: "rgba(255, 190, 40, 0.2)",
    bloomInner: [255, 220, 80] as const,
    bloomMid: [255, 195, 50] as const,
  },
  moon: {
    fill: "#E8EEF5",
    lit: "#F4F7FC",
    shadow: "#6A7E9A",
    halo: "rgba(200, 215, 255, 0.14)",
  },
  cloud: {
    white: "#FFFFFF",
    light: "#F4F7FA",
    grey: "#B8C4CE",
    dark: "#7A8898",
    storm: "#5A6478",
    night: "#4A5A72",
  },
  rain: {
    drop: "#5AC8FA",
    dropStorm: "#8CB4E6",
  },
  lightning: {
    bolt: "#FFD60A",
    flash: "rgba(200, 190, 255, 0.42)",
    glow: "rgba(255, 214, 10, 0.9)",
  },
  fog: {
    band: "#D0D8E0",
  },
  star: {
    cool: "#C8DCFF",
    warm: "#FFF8E8",
  },
} as const;

export const SKY_GRADIENTS: Record<WeatherTheme, [number, string][]> = {
  clear: [
    [0, "#1a5ca8"],
    [0.2, "#2e8fd4"],
    [0.45, "#42a8ec"],
    [0.7, "#3896dc"],
    [1, "#2a68a0"],
  ],
  partly_cloudy: [
    [0, "#1a3568"],
    [0.18, "#2a5898"],
    [0.42, "#4a78a8"],
    [0.68, "#987878"],
    [0.86, "#d8a088"],
    [1, "#e8b898"],
  ],
  cloudy: [
    [0, "#5c6670"],
    [0.38, "#7a848e"],
    [0.68, "#6e7882"],
    [1, "#1a1820"],
  ],
  rain: [
    [0, "#283848"],
    [0.35, "#3a4e62"],
    [0.65, "#2e4050"],
    [1, "#0a0810"],
  ],
  thunder: [
    [0, "#120e1c"],
    [0.35, "#2a2240"],
    [0.62, "#3d3260"],
    [1, "#06040a"],
  ],
  fog: [
    [0, "#8a929a"],
    [0.45, "#b8c0c8"],
    [0.72, "#90989e"],
    [1, "#2a2830"],
  ],
  night: [
    [0, "#1e1838"],
    [0.22, "#322a58"],
    [0.48, "#524878"],
    [0.72, "#8878a0"],
    [1, "#c8a090"],
  ],
};
