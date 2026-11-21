import { describe, expect, it } from "vitest";
import { buildCommunitySafetyAlerts } from "./community-safety";
import type { WeatherBundle } from "@/types/weather";

function makeBundle(overrides: Partial<WeatherBundle> = {}): WeatherBundle {
  return {
    district: {
      id: "kampala",
      name: "Kampala",
      slug: "kampala",
      region: "central",
      coordinates: { lat: 0.3476, lon: 32.5825 },
      rainfallPattern: "bimodal",
      agroZone: "banana_coffee",
      hazards: ["flood"],
    },
    isDay: true,
    temperature: { celsius: 26, feelsLike: 27 },
    condition: { code: 1, text: "Partly cloudy", icon: "partly-cloudy", theme: "partly_cloudy" },
    precipitation: { mm: 0, chance: 20 },
    wind: { speedKph: 10, direction: "SE", degree: 135, gustKph: 14 },
    humidity: 65,
    uvIndex: 6,
    pressureMb: 1012,
    visibilityKm: 10,
    daily: { high: 28, low: 19 },
    hourly: [],
    dailyForecast: [
      { day: "Today", high: 28, low: 19, icon: "partly-cloudy", isToday: true, rainChance: 20 },
      { day: "Tue", high: 28, low: 19, icon: "partly-cloudy", isToday: false, rainChance: 25 },
      { day: "Wed", high: 27, low: 18, icon: "partly-cloudy", isToday: false, rainChance: 20 },
    ],
    astronomy: { sunrise: "6:45 AM", sunset: "6:52 PM", moonPhase: "Waxing", moonIllumination: 50 },
    airQuality: { aqi: 30, category: "Good", advice: "Clean air" },
    alerts: [],
    updatedAt: new Date().toISOString(),
    source: "open-meteo",
    stale: false,
    ...overrides,
  };
}

describe("buildCommunitySafetyAlerts", () => {
  it("returns high UV protection alert during daytime when UV >= 8", () => {
    const bundle = makeBundle({ isDay: true, uvIndex: 11 });
    const enAlerts = buildCommunitySafetyAlerts(bundle, "en");
    expect(enAlerts.some((a) => a.id === "uv_protection" && a.level === "warning")).toBe(true);
    expect(enAlerts[0]?.summary).toContain("albinism");

    const lgAlerts = buildCommunitySafetyAlerts(bundle, "lg");
    expect(lgAlerts.some((a) => a.id === "uv_protection")).toBe(true);
    expect(lgAlerts[0]?.summary).toContain("albinism");
  });

  it("does not emit high UV alert at night", () => {
    const bundle = makeBundle({ isDay: false, uvIndex: 10 });
    const alerts = buildCommunitySafetyAlerts(bundle, "en");
    expect(alerts.some((a) => a.id === "uv_protection")).toBe(false);
  });

  it("emits pastoral heat and water watch for Karamoja during hot dry spells", () => {
    const bundle = makeBundle({
      district: {
        id: "moroto",
        name: "Moroto",
        slug: "moroto",
        region: "northern",
        coordinates: { lat: 2.5345, lon: 34.6666 },
        rainfallPattern: "unimodal",
        agroZone: "karamoja",
        hazards: ["drought"],
      },
      temperature: { celsius: 34, feelsLike: 35 },
      dailyForecast: [
        { day: "Today", high: 35, low: 22, icon: "clear", isToday: true, rainChance: 5 },
        { day: "Tue", high: 35, low: 22, icon: "clear", isToday: false, rainChance: 5 },
        { day: "Wed", high: 36, low: 23, icon: "clear", isToday: false, rainChance: 10 },
      ],
    });
    const alerts = buildCommunitySafetyAlerts(bundle, "en");
    const pastoral = alerts.find((a) => a.id === "pastoral_heat");
    expect(pastoral).toBeDefined();
    expect(pastoral?.level).toBe("warning");
    expect(pastoral?.summary).toContain("Moroto");
  });

  it("emits 72-hour landslide watch for mountain districts with repeated rain", () => {
    const bundle = makeBundle({
      district: {
        id: "bududa",
        name: "Bududa",
        slug: "bududa",
        region: "eastern",
        coordinates: { lat: 1.0028, lon: 34.3318 },
        rainfallPattern: "bimodal",
        agroZone: "mountain",
        hazards: ["landslide"],
      },
      precipitation: { mm: 14, chance: 80 },
      dailyForecast: [
        { day: "Today", high: 23, low: 15, icon: "rain", isToday: true, rainChance: 80 },
        { day: "Tue", high: 22, low: 15, icon: "rain", isToday: false, rainChance: 85 },
        { day: "Wed", high: 22, low: 14, icon: "rain", isToday: false, rainChance: 75 },
      ],
    });
    const alerts = buildCommunitySafetyAlerts(bundle, "en");
    const landslide = alerts.find((a) => a.id === "mountain_landslide");
    expect(landslide).toBeDefined();
    expect(landslide?.level).toBe("warning");
    expect(landslide?.summary).toContain("72 hours");
  });
});
