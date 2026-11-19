import { describe, expect, it } from "vitest";
import { degreesToCompass, visibilityKmFromWmo, wmoLabel, wmoToWeatherApiCode } from "./wmo";

describe("wmoLabel", () => {
  it("labels WMO code 0 (clear sky) as Sunny by day and Clear by night", () => {
    // Regression test, mirroring the same fix in copy.ts's
    // formatCondition: the Open-Meteo fallback path had no day/night
    // distinction at all for this condition.
    expect(wmoLabel(0, true)).toBe("Sunny");
    expect(wmoLabel(0, false)).toBe("Clear");
  });

  it("defaults to day (Sunny) when isDay is omitted", () => {
    expect(wmoLabel(0)).toBe("Sunny");
  });

  it("labels other codes the same regardless of day/night", () => {
    expect(wmoLabel(3, true)).toBe("Cloudy");
    expect(wmoLabel(3, false)).toBe("Cloudy");
    expect(wmoLabel(95, true)).toBe("Thunderstorms");
  });

  it("falls back to Partly Cloudy for an unrecognized code", () => {
    expect(wmoLabel(9999)).toBe("Partly Cloudy");
  });
});

describe("wmoToWeatherApiCode", () => {
  it("maps clear sky to WeatherAPI's clear code", () => {
    expect(wmoToWeatherApiCode(0)).toBe(1000);
  });

  it("maps thunderstorm codes to WeatherAPI thunder codes", () => {
    expect(wmoToWeatherApiCode(95)).toBe(1087);
    expect(wmoToWeatherApiCode(99)).toBe(1282);
  });
});

describe("degreesToCompass", () => {
  it("maps cardinal degrees to compass points", () => {
    expect(degreesToCompass(0)).toBe("N");
    expect(degreesToCompass(90)).toBe("E");
    expect(degreesToCompass(180)).toBe("S");
    expect(degreesToCompass(270)).toBe("W");
  });
});

describe("visibilityKmFromWmo", () => {
  it("reports low visibility for fog codes", () => {
    expect(visibilityKmFromWmo(45)).toBeLessThan(visibilityKmFromWmo(0));
  });
});
