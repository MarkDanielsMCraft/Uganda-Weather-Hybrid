export type Region = "central" | "eastern" | "northern" | "western";

export interface DistrictCoordinates {
  lat: number;
  lon: number;
}

export interface District {
  id: string;
  name: string;
  slug: string;
  region: Region;
  coordinates: DistrictCoordinates;
  rainfallPattern: "bimodal" | "unimodal";
  agroZone?: string;
  hazards: string[];
  isCity?: boolean;
  isLakeVictoriaZone?: boolean;
  /** Generic lake-shore tag for lakes beyond Victoria — Victoria itself
      keeps using `isLakeVictoriaZone` (many existing call sites depend on
      it), this covers the newer lakes added on top of that pattern. */
  lakeZone?: "kyoga" | "albert" | "edward";
  popularRank?: number;
  population?: number;
  /** True when this is a village, parish, or town outside the district list. */
  isPlace?: boolean;
  placeLabel?: string;
  parentDistrictSlug?: string;
}

export type WeatherTheme =
  | "clear"
  | "partly_cloudy"
  | "cloudy"
  | "rain"
  | "thunder"
  | "fog"
  | "night";

export type AlertSeverity = "advisory" | "watch" | "warning" | "extreme";

export interface WeatherAlert {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  source: string;
  issuedAt: string;
  expiresAt?: string;
}

export interface HourlyPoint {
  time: string;
  label: string;
  temp: number;
  icon: string;
  theme?: WeatherTheme;
  isDay?: boolean;
  kind: "hour" | "sunset" | "sunrise";
  rainChance?: number;
  /** Per-hour metric values, for the hourly graphs each detail sheet
      shows (UV, Wind, Humidity, Pressure, Visibility) — optional since
      not every provider in the fallback chain returns hourly granularity
      for all of these; a tile's graph should degrade to the daily/current
      summary it already has when a given hour is missing a field. */
  uvIndex?: number;
  windSpeedKph?: number;
  humidity?: number;
  pressureMb?: number;
  visibilityKm?: number;
  feelsLike?: number;
  dewPointC?: number;
  gustKph?: number;
  windDegree?: number;
}

export interface DailyPoint {
  day: string;
  date?: string;
  high: number;
  low: number;
  icon: string;
  theme?: WeatherTheme;
  isToday: boolean;
  rainChance?: number;
  hours?: HourlyPoint[];
}

export interface Astronomy {
  sunrise: string;
  sunset: string;
  moonPhase: string;
  moonIllumination: number;
}

export interface AirQuality {
  aqi: number;
  category: string;
  advice: string;
  pm25?: number;
}

export interface ApiMeta {
  requestId: string;
  cachedAt: string;
  stale?: boolean;
}

export interface WeatherBundle {
  district: District;
  isDay: boolean;
  localTime?: string;
  timezone?: string;
  temperature: {
    celsius: number;
    feelsLike: number;
  };
  condition: {
    code: number;
    text: string;
    icon: string;
    theme: WeatherTheme;
  };
  wind: {
    speedKph: number;
    gustKph: number;
    direction: string;
    degree: number;
  };
  humidity: number;
  /** Real dew point from the provider, not derived — undefined only if a
      fallback provider genuinely doesn't return one, in which case
      callers should fall back to computing it (Magnus-Tetens) from
      temperature + humidity rather than leaving the UI blank. */
  dewPointC?: number;
  uvIndex: number;
  visibilityKm: number;
  pressureMb: number;
  precipitation: {
    mm: number;
    chance: number;
  };
  daily: {
    high: number;
    low: number;
  };
  hourly: HourlyPoint[];
  dailyForecast: DailyPoint[];
  astronomy: Astronomy;
  airQuality: AirQuality;
  alerts: WeatherAlert[];
  updatedAt: string;
  source: string;
  stale: boolean;
}

export interface LocationSummary {
  district: District;
  temperature: number;
  condition: string;
  icon: string;
  theme: WeatherTheme;
  high: number;
  low: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta: ApiMeta;
}
