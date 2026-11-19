import type { District, HourlyPoint, WeatherBundle } from "@/types/weather";

/** A minimal set of hourly points that satisfies validateWeatherBundle's
    "at least 8 hour-kind points" requirement. */
export function makeHourlyPoints(count = 10): HourlyPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    time: new Date(2026, 0, 1, i).toISOString(),
    label: i === 0 ? "Now" : `${i}:00`,
    temp: 20 + i,
    icon: "//cdn.weatherapi.com/day/113.png",
    kind: "hour" as const,
  }));
}

export function makeDistrict(overrides: Partial<District> = {}): District {
  return {
    id: "kampala",
    name: "Kampala",
    slug: "kampala",
    region: "central",
    coordinates: { lat: 0.3476, lon: 32.5825 },
    rainfallPattern: "bimodal",
    agroZone: "banana_coffee",
    hazards: [],
    isCity: true,
    ...overrides,
  };
}

export function makeWeatherBundle(overrides: Partial<WeatherBundle> = {}): WeatherBundle {
  return {
    district: makeDistrict(),
    isDay: true,
    temperature: { celsius: 24, feelsLike: 25 },
    condition: { code: 1000, text: "Clear", icon: "//cdn.weatherapi.com/day/113.png", theme: "clear" },
    wind: { speedKph: 10, gustKph: 16, direction: "SW", degree: 215 },
    humidity: 60,
    uvIndex: 5,
    visibilityKm: 10,
    pressureMb: 1013,
    precipitation: { mm: 0, chance: 5 },
    daily: { high: 28, low: 18 },
    hourly: makeHourlyPoints(),
    dailyForecast: [],
    astronomy: {
      sunrise: "6:50 AM",
      sunset: "6:58 PM",
      moonPhase: "Waxing Gibbous",
      moonIllumination: 60,
    },
    airQuality: { aqi: 42, category: "Good", advice: "Air quality is satisfactory." },
    alerts: [],
    updatedAt: new Date().toISOString(),
    source: "weatherapi.com",
    stale: false,
    ...overrides,
  };
}
