import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchPirateWeatherBundle } from "./pirate-weather";
import { makeDistrict } from "@/lib/test-fixtures/weather-bundle";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 });
}

const SUNRISE_UNIX = Date.UTC(2026, 0, 15, 3, 50, 0) / 1000;
const SUNSET_UNIX = Date.UTC(2026, 0, 15, 15, 58, 0) / 1000;

function hourlyData(startUnix: number, hours = 24) {
  return Array.from({ length: hours }, (_, i) => ({
    time: startUnix + i * 3600,
    icon: "partly-cloudy-day",
    temperature: 22 + i,
    apparentTemperature: 23 + i,
    humidity: 0.6,
    pressure: 1013,
    windSpeed: 10,
    windGust: 15,
    windBearing: 90,
    visibility: 10,
    uvIndex: 4,
    precipIntensity: 0,
    precipProbability: 0.05,
  }));
}

function forecastPayload(overrides: Partial<{ currentTime: number; icon: string }> = {}) {
  const currentTime = overrides.currentTime ?? SUNRISE_UNIX + 5 * 3600; // midday
  return {
    timezone: "Africa/Kampala",
    currently: {
      time: currentTime,
      icon: overrides.icon ?? "partly-cloudy-day",
      temperature: 24,
      apparentTemperature: 25,
      humidity: 0.55,
      pressure: 1013,
      windSpeed: 12,
      windGust: 18,
      windBearing: 200,
      visibility: 10,
      uvIndex: 6,
      precipIntensity: 0,
      precipProbability: 0.1,
    },
    hourly: { data: hourlyData(currentTime) },
    daily: {
      data: [
        {
          time: SUNRISE_UNIX,
          icon: "partly-cloudy-day",
          temperatureHigh: 28,
          temperatureLow: 18,
          sunriseTime: SUNRISE_UNIX,
          sunsetTime: SUNSET_UNIX,
          precipProbability: 0.1,
        },
      ],
    },
  };
}

describe("fetchPirateWeatherBundle", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("throws when PIRATE_WEATHER_API_KEY is not configured", async () => {
    vi.stubEnv("PIRATE_WEATHER_API_KEY", "");
    await expect(
      fetchPirateWeatherBundle(makeDistrict(), new AbortController().signal),
    ).rejects.toThrow("PIRATE_WEATHER_API_KEY");
  });

  it("builds a valid bundle in Celsius/km-h units (ca units param) with at least 8 hourly points", async () => {
    vi.stubEnv("PIRATE_WEATHER_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        expect(url.toString()).toContain("units=ca");
        return jsonResponse(forecastPayload());
      }),
    );

    const bundle = await fetchPirateWeatherBundle(makeDistrict(), new AbortController().signal);

    expect(bundle.source).toBe("pirateweather.net");
    expect(bundle.temperature.celsius).toBe(24);
    expect(bundle.wind.speedKph).toBe(12);
    expect(bundle.hourly.filter((h) => h.kind === "hour").length).toBeGreaterThanOrEqual(8);
    expect(bundle.dailyForecast.length).toBeGreaterThan(0);
    expect(bundle.dailyForecast[0].day).toBe("Today");
  });

  it("marks isDay false and gives no air quality data (Pirate Weather has none)", async () => {
    vi.stubEnv("PIRATE_WEATHER_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(forecastPayload({ currentTime: SUNSET_UNIX + 4 * 3600, icon: "clear-night" })),
      ),
    );

    const bundle = await fetchPirateWeatherBundle(makeDistrict(), new AbortController().signal);

    expect(bundle.isDay).toBe(false);
    expect(bundle.airQuality.pm25).toBeUndefined();
    expect(bundle.airQuality.category).toBe("Good");
  });
});

/** Local midnight in Kampala (UTC+3) as a UNIX second. This is the shape
    Pirate Weather uses for `daily[].time`: their documented example,
    1749272400, is 12:00 a.m. in America/Chicago, the timezone that same
    response reports. */
function kampalaMidnight(isoDate: string) {
  return Date.parse(`${isoDate}T00:00:00+03:00`) / 1000;
}

function dailyPayload() {
  const noon = Date.parse("2026-09-02T12:00:00+03:00") / 1000;
  return {
    timezone: "Africa/Kampala",
    currently: {
      time: noon,
      icon: "partly-cloudy-day",
      temperature: 26.4,
      apparentTemperature: 28.1,
      // Fractions, per the published schema, not percentages.
      humidity: 0.88,
      precipProbability: 0.38,
      pressure: 1009.92,
      windSpeed: 7.42,
      windGust: 9.78,
      windBearing: 195,
      visibility: 13.62,
      uvIndex: 3,
      precipIntensity: 0,
    },
    hourly: { data: [] },
    daily: {
      data: [
        {
          time: kampalaMidnight("2026-09-02"),
          icon: "rain",
          temperatureHigh: 27.2,
          temperatureLow: 18.6,
          precipProbability: 0.49,
          sunriseTime: Date.parse("2026-09-02T06:45:00+03:00") / 1000,
          sunsetTime: Date.parse("2026-09-02T18:52:00+03:00") / 1000,
        },
        {
          time: kampalaMidnight("2026-09-03"),
          icon: "cloudy",
          temperatureHigh: 25.1,
          temperatureLow: 17.9,
          precipProbability: 0.1,
        },
      ],
    },
  };
}

describe("fetchPirateWeatherBundle daily dates and error statuses", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("dates each day by Kampala's calendar rather than the UTC one", async () => {
    // Regression test. `daily[].time` is local midnight, which at UTC+3 is
    // 21:00 the previous day in UTC, so reading the date off toISOString()
    // shifted every entry a day back while the weekday label beside it
    // stayed right. The fixture above never caught this because its daily
    // time is sunrise, not midnight.
    vi.stubEnv("PIRATE_WEATHER_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(dailyPayload())));

    const bundle = await fetchPirateWeatherBundle(makeDistrict(), new AbortController().signal);

    expect(bundle.dailyForecast.map((day) => day.date)).toEqual(["2026-09-02", "2026-09-03"]);
  });

  it("keeps the weekday label and the date pointing at the same day", async () => {
    vi.stubEnv("PIRATE_WEATHER_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(dailyPayload())));

    const bundle = await fetchPirateWeatherBundle(makeDistrict(), new AbortController().signal);
    const second = bundle.dailyForecast[1];

    const weekdayForThatDate = new Date(`${second.date}T12:00:00+03:00`).toLocaleDateString("en-UG", {
      weekday: "short",
      timeZone: "Africa/Kampala",
    });
    expect(second.day).toBe(weekdayForThatDate);
  });

  it("scales the schema's fractional fields into the percentages this app uses", async () => {
    vi.stubEnv("PIRATE_WEATHER_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(dailyPayload())));

    const bundle = await fetchPirateWeatherBundle(makeDistrict(), new AbortController().signal);

    expect(bundle.humidity).toBe(88);
    expect(bundle.dailyForecast[0].rainChance).toBe(49);
  });

  it("throws rather than parsing the body when the key is rejected", async () => {
    // 401 and 429 come back as text/html ("Kong Error ..."), not JSON, so
    // anything reading them as a bundle would produce nonsense numbers.
    vi.stubEnv("PIRATE_WEATHER_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Kong Error Invalid authentication credentials.", { status: 401 })),
    );

    await expect(
      fetchPirateWeatherBundle(makeDistrict(), new AbortController().signal),
    ).rejects.toThrow(/401/);
  });

  it("throws when the monthly quota is exhausted", async () => {
    vi.stubEnv("PIRATE_WEATHER_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Kong Error API rate limit exceeded.", { status: 429 })),
    );

    await expect(
      fetchPirateWeatherBundle(makeDistrict(), new AbortController().signal),
    ).rejects.toThrow(/429/);
  });
});
