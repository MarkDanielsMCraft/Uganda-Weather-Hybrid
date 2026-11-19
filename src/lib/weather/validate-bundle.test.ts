import { describe, expect, it } from "vitest";
import { validateHourlyPoints, validateWeatherBundle } from "./validate-bundle";
import { makeWeatherBundle } from "@/lib/test-fixtures/weather-bundle";
import type { HourlyPoint } from "@/types/weather";

function makeHours(count: number, overrides: Partial<HourlyPoint> = {}): HourlyPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    time: new Date(2026, 0, 1, i).toISOString(),
    label: `${i}:00`,
    temp: 20 + i,
    icon: "//cdn.weatherapi.com/day/113.png",
    kind: "hour" as const,
    ...overrides,
  }));
}

describe("validateHourlyPoints", () => {
  it("accepts 8 or more well-formed hourly points", () => {
    expect(() => validateHourlyPoints(makeHours(8))).not.toThrow();
  });

  it("rejects fewer than 8 hourly points (sunset/sunrise markers don't count)", () => {
    const hours = [...makeHours(7), { time: "", label: "6:52 pm", temp: 0, icon: "", kind: "sunset" as const }];
    expect(() => validateHourlyPoints(hours)).toThrow(/at least 8 hourly points/);
  });

  it("rejects a non-finite temperature", () => {
    const hours = makeHours(8);
    hours[3].temp = NaN;
    expect(() => validateHourlyPoints(hours)).toThrow(/missing temperature/);
  });

  it("rejects a blank label", () => {
    const hours = makeHours(8);
    hours[0].label = "   ";
    expect(() => validateHourlyPoints(hours)).toThrow(/missing label/);
  });

  it("rejects a point with neither icon nor theme", () => {
    const hours = makeHours(8);
    hours[5].icon = "";
    hours[5].theme = undefined;
    expect(() => validateHourlyPoints(hours)).toThrow(/missing icon and theme/);
  });

  it("accepts a point with a theme but no icon", () => {
    const hours = makeHours(8);
    hours[5].icon = "";
    hours[5].theme = "clear";
    expect(() => validateHourlyPoints(hours)).not.toThrow();
  });
});

describe("validateWeatherBundle", () => {
  it("accepts a well-formed bundle", () => {
    const bundle = makeWeatherBundle({ hourly: makeHours(10) });
    expect(() => validateWeatherBundle(bundle, "kampala")).not.toThrow();
  });

  it("rejects a bundle for the wrong district (upstream/cache key mismatch)", () => {
    const bundle = makeWeatherBundle({ hourly: makeHours(10) });
    expect(() => validateWeatherBundle(bundle, "jinja")).toThrow(/district slug mismatch/);
  });

  it("rejects a non-finite current temperature", () => {
    const bundle = makeWeatherBundle({
      hourly: makeHours(10),
      temperature: { celsius: NaN, feelsLike: 20 },
    });
    expect(() => validateWeatherBundle(bundle)).toThrow(/missing current temperature/);
  });

  it("rejects a blank condition text", () => {
    const bundle = makeWeatherBundle({
      hourly: makeHours(10),
      condition: { code: 1000, text: "  ", icon: "", theme: "clear" },
    });
    expect(() => validateWeatherBundle(bundle)).toThrow(/missing condition text/);
  });
});
