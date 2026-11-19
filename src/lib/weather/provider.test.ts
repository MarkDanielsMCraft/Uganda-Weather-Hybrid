import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDistrict, makeWeatherBundle } from "@/lib/test-fixtures/weather-bundle";

const { fetchWeatherApiBundleMock, fetchOpenMeteoBundleMock, fetchPirateWeatherBundleMock } =
  vi.hoisted(() => ({
    fetchWeatherApiBundleMock: vi.fn(),
    fetchOpenMeteoBundleMock: vi.fn(),
    fetchPirateWeatherBundleMock: vi.fn(),
  }));

vi.mock("./weatherapi", () => ({
  fetchWeatherApiBundle: fetchWeatherApiBundleMock,
}));

vi.mock("./open-meteo", () => ({
  fetchOpenMeteoBundle: fetchOpenMeteoBundleMock,
}));

vi.mock("./pirate-weather", () => ({
  fetchPirateWeatherBundle: fetchPirateWeatherBundleMock,
}));

// Import after the mocks are registered so provider.ts picks them up.
const { getWeatherBundleForDistrict } = await import("./provider");

const district = makeDistrict();

/** The fixture ships an empty forecast, so build days explicitly wherever a
    test cares how many come back. */
function days(count: number, startDay = 0) {
  return Array.from({ length: count }, (_, index) => ({
    day: `D${startDay + index}`,
    date: `2026-01-${String(startDay + index + 1).padStart(2, "0")}`,
    high: 28,
    low: 18,
    icon: "",
    isToday: startDay + index === 0,
  }));
}
const originalKey = process.env.WEATHERAPI_KEY;
const originalPirateKey = process.env.PIRATE_WEATHER_API_KEY;

beforeEach(() => {
  fetchWeatherApiBundleMock.mockReset();
  fetchOpenMeteoBundleMock.mockReset();
  fetchPirateWeatherBundleMock.mockReset();
});

afterEach(() => {
  if (originalKey === undefined) delete process.env.WEATHERAPI_KEY;
  else process.env.WEATHERAPI_KEY = originalKey;

  if (originalPirateKey === undefined) delete process.env.PIRATE_WEATHER_API_KEY;
  else process.env.PIRATE_WEATHER_API_KEY = originalPirateKey;
});

describe("getWeatherBundleForDistrict fallback chain", () => {
  it("uses WeatherAPI when it succeeds and a key is configured", async () => {
    process.env.WEATHERAPI_KEY = "test-key";
    const bundle = makeWeatherBundle({ source: "weatherapi.com", dailyForecast: days(10) });
    fetchWeatherApiBundleMock.mockResolvedValue(bundle);

    const result = await getWeatherBundleForDistrict(district);

    expect(result.source).toBe("weatherapi.com");
    expect(fetchWeatherApiBundleMock).toHaveBeenCalledTimes(1);
    // A full length forecast needs no second provider.
    expect(fetchOpenMeteoBundleMock).not.toHaveBeenCalled();
  });

  it("tops the daily forecast up from Open-Meteo when WeatherAPI returns a short one", async () => {
    process.env.WEATHERAPI_KEY = "test-key";
    fetchWeatherApiBundleMock.mockResolvedValue(
      makeWeatherBundle({ source: "weatherapi.com", dailyForecast: days(3) }),
    );
    fetchOpenMeteoBundleMock.mockResolvedValue(
      makeWeatherBundle({ source: "open-meteo.com", dailyForecast: days(10) }),
    );

    const result = await getWeatherBundleForDistrict(district);

    expect(result.dailyForecast).toHaveLength(10);
    // The primary stays the source of truth for the days it did return.
    expect(result.dailyForecast.slice(0, 3).map((day) => day.date)).toEqual(
      days(3).map((day) => day.date),
    );
    // Only dates the primary was missing are appended, with no duplicates.
    expect(new Set(result.dailyForecast.map((day) => day.date)).size).toBe(10);
    expect(result.source).toBe("weatherapi.com");
  });

  it("refuses to serve synthetic weather in production when every provider fails", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.WEATHERAPI_KEY = "test-key";
    fetchWeatherApiBundleMock.mockRejectedValue(new Error("WeatherAPI down"));
    fetchOpenMeteoBundleMock.mockRejectedValue(new Error("Open-Meteo down"));

    try {
      await expect(getWeatherBundleForDistrict(district)).rejects.toThrow(
        /refusing to serve synthetic data/,
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("still falls back to the synthetic bundle outside production", async () => {
    process.env.WEATHERAPI_KEY = "test-key";
    fetchWeatherApiBundleMock.mockRejectedValue(new Error("WeatherAPI down"));
    fetchOpenMeteoBundleMock.mockRejectedValue(new Error("Open-Meteo down"));

    // Local development has no keys and often no network; the app still has to
    // run there.
    const result = await getWeatherBundleForDistrict(district);
    expect(result.source).toBe("demo-fallback");
  });

  it("skips the top up when the caller only needs current conditions", async () => {
    process.env.WEATHERAPI_KEY = "test-key";
    fetchWeatherApiBundleMock.mockResolvedValue(
      makeWeatherBundle({ source: "weatherapi.com", dailyForecast: days(3) }),
    );

    const result = await getWeatherBundleForDistrict(district, { fullForecast: false });

    // The fan out routes read only the temperature and icon, so a second
    // provider call here would be pure waste and extra rate limit pressure.
    expect(fetchOpenMeteoBundleMock).not.toHaveBeenCalled();
    expect(result.dailyForecast).toHaveLength(3);
  });

  it("keeps the short forecast when both top up providers fail", async () => {
    process.env.WEATHERAPI_KEY = "test-key";
    fetchWeatherApiBundleMock.mockResolvedValue(
      makeWeatherBundle({ source: "weatherapi.com", dailyForecast: days(3) }),
    );
    fetchOpenMeteoBundleMock.mockRejectedValue(new Error("Open-Meteo down"));

    const result = await getWeatherBundleForDistrict(district);

    expect(result.dailyForecast).toHaveLength(3);
    expect(result.source).toBe("weatherapi.com");
  });

  it("falls back to Pirate Weather for top up when Open-Meteo fails", async () => {
    process.env.WEATHERAPI_KEY = "test-key";
    process.env.PIRATE_WEATHER_API_KEY = "pirate-key";
    fetchWeatherApiBundleMock.mockResolvedValue(
      makeWeatherBundle({ source: "weatherapi.com", dailyForecast: days(3) }),
    );
    fetchOpenMeteoBundleMock.mockRejectedValue(new Error("Open-Meteo down"));
    fetchPirateWeatherBundleMock.mockResolvedValue(
      makeWeatherBundle({ source: "pirateweather.net", dailyForecast: days(10) }),
    );

    const result = await getWeatherBundleForDistrict(district);

    expect(result.dailyForecast).toHaveLength(10);
    expect(result.dailyForecast.slice(0, 3).map((day) => day.date)).toEqual(
      days(3).map((day) => day.date),
    );
    expect(result.source).toBe("weatherapi.com");
  });

  it("falls back to Open-Meteo when WeatherAPI throws", async () => {
    process.env.WEATHERAPI_KEY = "test-key";
    fetchWeatherApiBundleMock.mockRejectedValue(new Error("WeatherAPI 500"));
    fetchOpenMeteoBundleMock.mockResolvedValue(makeWeatherBundle({ source: "open-meteo.com" }));

    const result = await getWeatherBundleForDistrict(district);

    expect(result.source).toBe("open-meteo.com");
    expect(fetchWeatherApiBundleMock).toHaveBeenCalledTimes(1);
    expect(fetchOpenMeteoBundleMock).toHaveBeenCalledTimes(1);
  });

  it("skips WeatherAPI entirely when no key is configured", async () => {
    delete process.env.WEATHERAPI_KEY;
    fetchOpenMeteoBundleMock.mockResolvedValue(makeWeatherBundle({ source: "open-meteo.com" }));

    const result = await getWeatherBundleForDistrict(district);

    expect(result.source).toBe("open-meteo.com");
    expect(fetchWeatherApiBundleMock).not.toHaveBeenCalled();
    expect(fetchOpenMeteoBundleMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to a locally generated demo bundle when both providers fail", async () => {
    process.env.WEATHERAPI_KEY = "test-key";
    fetchWeatherApiBundleMock.mockRejectedValue(new Error("WeatherAPI down"));
    fetchOpenMeteoBundleMock.mockRejectedValue(new Error("Open-Meteo down"));

    const result = await getWeatherBundleForDistrict(district);

    // Demo mode must still produce a fully valid, self-consistent bundle —
    // this is the last line of defense keeping the app usable when both
    // upstream providers are down.
    expect(result.district.slug).toBe(district.slug);
    expect(result.source).toBe("demo-fallback");
    expect(Number.isFinite(result.temperature.celsius)).toBe(true);
    expect(result.hourly.filter((h) => h.kind === "hour").length).toBeGreaterThanOrEqual(8);
  });

  it("labels the demo bundle as plain 'demo' (not 'demo-fallback') when there was never a live provider to fall back from", async () => {
    delete process.env.WEATHERAPI_KEY;
    fetchOpenMeteoBundleMock.mockRejectedValue(new Error("Open-Meteo down"));

    const result = await getWeatherBundleForDistrict(district);

    expect(result.source).toBe("demo");
  });

  it("throws if even the demo bundle fails validation (e.g. a district-slug mismatch bug)", async () => {
    process.env.WEATHERAPI_KEY = "test-key";
    // A bundle for the wrong district should never silently pass through —
    // validateWeatherBundle must reject it rather than caching bad data.
    fetchWeatherApiBundleMock.mockResolvedValue(
      makeWeatherBundle({ district: makeDistrict({ slug: "not-the-requested-district" }) }),
    );

    await expect(getWeatherBundleForDistrict(district)).rejects.toThrow(/district slug mismatch/);
  });
});
