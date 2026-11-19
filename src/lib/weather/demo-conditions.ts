import type { WeatherTheme } from "@/types/weather";

export interface DemoCondition {
  code: number;
  text: string;
  icon: string;
  theme: WeatherTheme;
}

/** One scene per popular district so demo mode shows every weather type */
export const DEMO_CONDITIONS: DemoCondition[] = [
  {
    code: 1000,
    text: "Clear",
    icon: "https://cdn.weatherapi.com/weather/64x64/day/113.png",
    theme: "clear",
  },
  {
    code: 1003,
    text: "Partly Cloudy",
    icon: "https://cdn.weatherapi.com/weather/64x64/day/116.png",
    theme: "partly_cloudy",
  },
  {
    code: 1006,
    text: "Cloudy",
    icon: "https://cdn.weatherapi.com/weather/64x64/day/119.png",
    theme: "cloudy",
  },
  {
    code: 1180,
    text: "Light Rain",
    icon: "https://cdn.weatherapi.com/weather/64x64/day/296.png",
    theme: "rain",
  },
  {
    code: 1087,
    text: "Thunderstorms",
    icon: "https://cdn.weatherapi.com/weather/64x64/day/200.png",
    theme: "thunder",
  },
  {
    code: 1030,
    text: "Fog",
    icon: "https://cdn.weatherapi.com/weather/64x64/day/143.png",
    theme: "fog",
  },
  {
    code: 1006,
    text: "Mostly Cloudy",
    icon: "https://cdn.weatherapi.com/weather/64x64/night/119.png",
    theme: "night",
  },
];

/** Pick a distinct demo scene per district in the sidebar */
export const DEMO_SLUG_TO_INDEX: Record<string, number> = {
  kampala: 0,
  wakiso: 1,
  jinja: 2,
  mbarara: 3,
  gulu: 4,
  kalangala: 5,
  moroto: 6,
  bulambuli: 3,
};

export function getDemoConditionForDistrict(slug: string): DemoCondition {
  const index = DEMO_SLUG_TO_INDEX[slug] ?? slug.length % DEMO_CONDITIONS.length;
  return DEMO_CONDITIONS[index] ?? DEMO_CONDITIONS[0];
}

export const DEMO_SCENE_HINT =
  "Sample scenes: Kampala clear, Wakiso clouds, Mbarara rain, Gulu storms, Moroto night";
