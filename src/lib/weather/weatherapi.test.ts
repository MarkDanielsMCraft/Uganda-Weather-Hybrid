import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWeatherApiBundle } from "./weatherapi";
import { makeDistrict } from "@/lib/test-fixtures/weather-bundle";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 });
}

function forecastDay(date: string) {
  const hours = Array.from({ length: 24 }, (_, h) => ({
    time: `${date} ${String(h).padStart(2, "0")}:00`,
    temp_c: 22,
    feelslike_c: 23,
    dewpoint_c: 15,
    is_day: h >= 7 && h <= 18 ? 1 : 0,
    chance_of_rain: 5,
    condition: { code: 1000, icon: "//cdn.weatherapi.com/day/113.png" },
    uv: h >= 7 && h <= 18 ? 6 : 0,
    humidity: 60,
    wind_kph: 10,
    gust_kph: 16,
    wind_degree: 215,
    vis_km: 10,
    pressure_mb: 1013,
  }));

  return {
    date,
    day: {
      maxtemp_c: 28,
      mintemp_c: 18,
      daily_chance_of_rain: 5,
      condition: { code: 1000, text: "Clear", icon: "//cdn.weatherapi.com/day/113.png" },
    },
    astro: {
      sunrise: "06:50 AM",
      sunset: "06:58 PM",
      moon_phase: "Waxing Gibbous",
      moon_illumination: "60",
    },
    hour: hours,
  };
}

function payload(overrides: Partial<{ pm25: number; lastUpdated: string }> = {}) {
  return {
    location: { name: "Kampala", region: "Central", localtime: "2026-01-15 12:00", tz_id: "Africa/Kampala" },
    current: {
      temp_c: 24,
      feelslike_c: 25,
      dewpoint_c: 16,
      condition: { code: 1000, text: "Sunny", icon: "//cdn.weatherapi.com/day/113.png" },
      wind_kph: 10,
      gust_kph: 16,
      wind_dir: "SW",
      wind_degree: 215,
      humidity: 60,
      uv: 6,
      precip_mm: 0,
      vis_km: 10,
      pressure_mb: 1013,
      last_updated: overrides.lastUpdated ?? "2026-01-15 12:00",
      is_day: 1,
      air_quality: { pm2_5: overrides.pm25 ?? 8 },
    },
    forecast: { forecastday: [forecastDay("2026-01-15")] },
  };
}

describe("fetchWeatherApiBundle", () => {
  beforeEach(() => {
    vi.stubEnv("WEATHERAPI_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("keeps severity-appropriate air quality advice for Kampala instead of a fixed generic message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(payload({ pm25: 80 }))));

    const bundle = await fetchWeatherApiBundle(makeDistrict({ slug: "kampala" }));

    expect(bundle.airQuality.category).toBe("Unhealthy for Sensitive Groups");
    expect(bundle.airQuality.advice).toContain("reducing outdoor activity");
    expect(bundle.airQuality.advice).toContain("Kampala");
  });

  it("leaves non-Kampala advice untouched", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(payload({ pm25: 80 }))));

    const bundle = await fetchWeatherApiBundle(makeDistrict({ slug: "jinja" }));

    expect(bundle.airQuality.advice).toBe("Consider reducing outdoor activity if you are sensitive.");
  });

  it("inserts both sunrise and sunset markers into the 24-hour hourly strip across two forecast days", async () => {
    const twoDayPayload = {
      ...payload({ lastUpdated: "2026-01-15 02:00" }),
      location: { name: "Kampala", region: "Central", localtime: "2026-01-15 02:00", tz_id: "Africa/Kampala" },
      forecast: {
        forecastday: [forecastDay("2026-01-15"), forecastDay("2026-01-16")],
      },
    };
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(twoDayPayload)));

    const bundle = await fetchWeatherApiBundle(makeDistrict({ slug: "kampala" }));
    const sunrisePoint = bundle.hourly.find((point) => point.kind === "sunrise");
    const sunsetPoint = bundle.hourly.find((point) => point.kind === "sunset");

    expect(sunrisePoint).toBeDefined();
    expect(sunrisePoint?.label).toBe("6:50 am");
    expect(sunsetPoint).toBeDefined();
    expect(sunsetPoint?.label).toBe("6:58 pm");
  });
});
