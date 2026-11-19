// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadWeatherCache, saveWeatherCache } from "./weather-cache";
import { makeDistrict, makeWeatherBundle } from "@/lib/test-fixtures/weather-bundle";

function response(slug: string) {
  return {
    data: makeWeatherBundle({
      district: makeDistrict({ slug }),
      dailyForecast: Array.from({ length: 10 }, (_, i) => ({
        day: `Day ${i}`,
        date: `2026-10-${20 + i}`,
        icon: "//cdn.weatherapi.com/day/113.png",
        theme: "clear" as const,
        isToday: i === 0,
        high: 28,
        low: 18,
        rainChance: 10,
      })),
    }),
    meta: { requestId: "r1", cachedAt: new Date().toISOString(), stale: false },
  };
}

describe("weather offline cache", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null for a district that was never cached", () => {
    expect(loadWeatherCache("nowhere")).toBeNull();
  });

  it("round-trips a saved entry and marks it stale on read", () => {
    saveWeatherCache("kampala", response("kampala"));
    const loaded = loadWeatherCache("kampala");

    expect(loaded).not.toBeNull();
    expect(loaded?.data.district.slug).toBe("kampala");
    // Cached data is inherently old by the time it's read back — both the
    // data and meta staleness flags must reflect that regardless of what
    // was originally saved.
    expect(loaded?.data.stale).toBe(true);
    expect(loaded?.meta.stale).toBe(true);
  });

  it("evicts the oldest entries once more than 12 districts are cached", () => {
    vi.useFakeTimers();
    const base = Date.now();
    for (let i = 0; i < 13; i += 1) {
      vi.setSystemTime(base + i * 1000);
      saveWeatherCache(`district-${i}`, response(`district-${i}`));
    }
    vi.useRealTimers();

    // The very first entry (oldest) should have been evicted.
    expect(loadWeatherCache("district-0")).toBeNull();
    // The most recent 12 should still be present.
    expect(loadWeatherCache("district-12")).not.toBeNull();
  });

  it("does not throw when localStorage.setItem fails (e.g. quota exceeded)", () => {
    const setItemSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("QuotaExceededError");
      });

    // This is the exact call site that runs synchronously right after a
    // successful weather fetch in useWeatherBundle — it must not throw,
    // or a full quota would turn a successful fetch into an apparent
    // failure.
    expect(() => saveWeatherCache("kampala", response("kampala"))).not.toThrow();

    setItemSpy.mockRestore();
  });

  it("recovers from corrupted JSON in localStorage instead of throwing", () => {
    localStorage.setItem("uw:weather-cache:v5", "{not valid json");
    expect(() => loadWeatherCache("kampala")).not.toThrow();
    expect(loadWeatherCache("kampala")).toBeNull();
  });

  it("does not persist incomplete daily forecast bundles (< 10 days)", () => {
    const incomplete = response("kampala");
    incomplete.data.dailyForecast = incomplete.data.dailyForecast.slice(0, 3);

    saveWeatherCache("kampala", incomplete);
    expect(loadWeatherCache("kampala")).toBeNull();
  });

  it("evicts and returns null when reading a stored entry with fewer than 10 forecast days", () => {
    const incomplete = response("kampala");
    incomplete.data.dailyForecast = incomplete.data.dailyForecast.slice(0, 3);

    // Force write incomplete entry directly into storage
    localStorage.setItem(
      "uw:weather-cache:v5",
      JSON.stringify({
        entries: {
          kampala: {
            slug: "kampala",
            savedAt: new Date().toISOString(),
            response: incomplete,
          },
        },
      }),
    );

    expect(loadWeatherCache("kampala")).toBeNull();
    // Verify it was evicted from localStorage
    const raw = localStorage.getItem("uw:weather-cache:v5");
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!).entries.kampala).toBeUndefined();
  });
});
