import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchOpenMeteoBundle } from "./open-meteo";
import { hoursAheadSummary } from "@/lib/design/context";
import { makeDistrict, makeHourlyPoints, makeWeatherBundle } from "@/lib/test-fixtures/weather-bundle";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 });
}

// Uganda local times ("YYYY-MM-DDTHH:mm", no offset — parseUgandaLocalTime
// treats these as Africa/Kampala local time).
const HOURLY_TIMES = Array.from({ length: 24 }, (_, h) => `2026-01-15T${String(h).padStart(2, "0")}:00`);
// UV is 0 at night, peaking at midday — the daily max (11) must not leak
// into the "current" reading at night.
const HOURLY_UV = HOURLY_TIMES.map((_, h) => (h >= 7 && h <= 17 ? Math.max(0, 11 - Math.abs(12 - h) * 2) : 0));

function forecastPayload(overrides: Partial<{ currentTime: string }> = {}) {
  return {
    timezone: "Africa/Kampala",
    current: {
      time: overrides.currentTime ?? "2026-01-15T20:00",
      temperature_2m: 22,
      relative_humidity_2m: 60,
      apparent_temperature: 23,
      dew_point_2m: 15,
      is_day: 0,
      precipitation: 0,
      weather_code: 0,
      cloud_cover: 10,
      surface_pressure: 1013,
      wind_speed_10m: 10,
      wind_direction_10m: 90,
      wind_gusts_10m: 15,
    },
    hourly: {
      time: HOURLY_TIMES,
      temperature_2m: HOURLY_TIMES.map(() => 22),
      precipitation_probability: HOURLY_TIMES.map(() => 5),
      weather_code: HOURLY_TIMES.map(() => 0),
      is_day: HOURLY_TIMES.map((_, h) => (h >= 7 && h <= 18 ? 1 : 0)),
      uv_index: HOURLY_UV,
      relative_humidity_2m: HOURLY_TIMES.map(() => 60),
      surface_pressure: HOURLY_TIMES.map(() => 1013),
      wind_speed_10m: HOURLY_TIMES.map(() => 10),
      apparent_temperature: HOURLY_TIMES.map(() => 23),
      dew_point_2m: HOURLY_TIMES.map(() => 15),
      wind_gusts_10m: HOURLY_TIMES.map(() => 15),
      wind_direction_10m: HOURLY_TIMES.map(() => 90),
    },
    daily: {
      time: ["2026-01-15"],
      weather_code: [0],
      temperature_2m_max: [28],
      temperature_2m_min: [18],
      sunrise: ["2026-01-15T06:50"],
      sunset: ["2026-01-15T18:58"],
      uv_index_max: [11],
      precipitation_sum: [0],
      precipitation_probability_max: [5],
    },
  };
}

describe("fetchOpenMeteoBundle", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the current hour's UV reading, not the day's peak, when it's night", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const href = url.toString();
        if (href.includes("air-quality")) return jsonResponse({ current: { pm2_5: 8, us_aqi: 30 } });
        return jsonResponse(forecastPayload({ currentTime: "2026-01-15T20:00" }));
      }),
    );

    const bundle = await fetchOpenMeteoBundle(makeDistrict(), new AbortController().signal);

    // At 20:00 the real UV should be 0, not the daily max of 11.
    expect(bundle.uvIndex).toBe(0);
  });

  it("uses the current hour's UV reading at midday, matching the hourly value there", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const href = url.toString();
        if (href.includes("air-quality")) return jsonResponse({ current: { pm2_5: 8, us_aqi: 30 } });
        return jsonResponse(forecastPayload({ currentTime: "2026-01-15T12:00" }));
      }),
    );

    const bundle = await fetchOpenMeteoBundle(makeDistrict(), new AbortController().signal);

    expect(bundle.uvIndex).toBe(HOURLY_UV[12]);
    expect(bundle.uvIndex).toBeGreaterThan(0);
  });

  it("keeps severity-appropriate air quality advice for Kampala instead of a fixed generic message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const href = url.toString();
        // A high PM2.5 reading -> "Unhealthy for Sensitive Groups" band.
        if (href.includes("air-quality")) return jsonResponse({ current: { pm2_5: 80, us_aqi: 150 } });
        return jsonResponse(forecastPayload());
      }),
    );

    const bundle = await fetchOpenMeteoBundle(
      makeDistrict({ slug: "kampala" }),
      new AbortController().signal,
    );

    expect(bundle.airQuality.category).toBe("Unhealthy for Sensitive Groups");
    // Regression test: this used to be fully replaced with a static
    // "similar to recent days" message that discarded the actionable
    // guidance for the actual severity.
    expect(bundle.airQuality.advice).toContain("reducing outdoor activity");
    expect(bundle.airQuality.advice).toContain("Kampala");
  });

  it("collects 24 hourly forecast points across two days along with sunrise and sunset markers", async () => {
    const twoDayHours = [
      ...Array.from({ length: 24 }, (_, h) => `2026-01-15T${String(h).padStart(2, "0")}:00`),
      ...Array.from({ length: 24 }, (_, h) => `2026-01-16T${String(h).padStart(2, "0")}:00`),
    ];
    const base = forecastPayload({ currentTime: "2026-01-15T12:00" });
    const twoDayPayload = {
      ...base,
      hourly: {
        time: twoDayHours,
        temperature_2m: twoDayHours.map(() => 24),
        precipitation_probability: twoDayHours.map(() => 10),
        weather_code: twoDayHours.map(() => 0),
        is_day: twoDayHours.map((_, idx) => {
          const h = idx % 24;
          return h >= 7 && h <= 18 ? 1 : 0;
        }),
        uv_index: twoDayHours.map(() => 4),
        relative_humidity_2m: twoDayHours.map(() => 60),
        surface_pressure: twoDayHours.map(() => 1013),
        wind_speed_10m: twoDayHours.map(() => 10),
        apparent_temperature: twoDayHours.map(() => 25),
        dew_point_2m: twoDayHours.map(() => 15),
        wind_gusts_10m: twoDayHours.map(() => 15),
        wind_direction_10m: twoDayHours.map(() => 90),
      },
      daily: {
        time: ["2026-01-15", "2026-01-16"],
        weather_code: [0, 0],
        temperature_2m_max: [28, 28],
        temperature_2m_min: [18, 18],
        sunrise: ["2026-01-15T06:50", "2026-01-16T06:50"],
        sunset: ["2026-01-15T18:58", "2026-01-16T18:58"],
        uv_index_max: [11, 11],
        precipitation_sum: [0, 0],
        precipitation_probability_max: [10, 10],
      },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        const href = url.toString();
        if (href.includes("air-quality")) return jsonResponse({ current: { pm2_5: 8, us_aqi: 30 } });
        return jsonResponse(twoDayPayload);
      }),
    );

    const bundle = await fetchOpenMeteoBundle(makeDistrict(), new AbortController().signal);
    const hourOnlyPoints = bundle.hourly.filter((point) => point.kind === "hour");

    expect(hourOnlyPoints).toHaveLength(24);
    expect(bundle.hourly.some((point) => point.kind === "sunset")).toBe(true);
    expect(bundle.hourly.some((point) => point.kind === "sunrise")).toBe(true);
  });

  it("scopes hoursAheadSummary to the next 12 hours so rain 16 hours away does not trigger an immediate rain warning", () => {
    const dryTwelveHoursThenRain = makeHourlyPoints(24).map((point, index) => ({
      ...point,
      rainChance: index >= 15 ? 80 : 10,
      theme: index >= 15 ? ("rain" as const) : ("clear" as const),
    }));

    const bundle = makeWeatherBundle({ hourly: dryTwelveHoursThenRain });
    expect(hoursAheadSummary(bundle)).toBe("Clear skies for the hours ahead.");
  });
});
