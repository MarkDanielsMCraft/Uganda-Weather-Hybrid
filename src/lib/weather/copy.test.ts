import { describe, expect, it } from "vitest";
import { formatCondition, formatHighLow } from "./copy";

describe("formatCondition", () => {
  it("keeps Sunny (day) and Clear (night) distinct for the same underlying condition", () => {
    // Regression test: this used to collapse WeatherAPI's own
    // day/night-aware text ("Sunny" in daylight, "Clear" at night, same
    // condition code 1000) into a single always-"Clear" label — showing
    // "Clear" at noon with a sun icon next to it instead of "Sunny".
    expect(formatCondition("Sunny")).toBe("Sunny");
    expect(formatCondition("Clear")).toBe("Clear");
  });

  it("normalizes overcast/cloudy variants", () => {
    expect(formatCondition("Overcast")).toBe("Cloudy");
    expect(formatCondition("Cloudy")).toBe("Cloudy");
    expect(formatCondition("Mostly cloudy")).toBe("Mostly Cloudy");
  });

  it("maps dust/smoke conditions to Hazy — relevant for Uganda's dry-season haze", () => {
    expect(formatCondition("Smoky haze")).toBe("Hazy");
    expect(formatCondition("Haze")).toBe("Hazy");
  });

  it("maps thunderstorm variants, distinguishing possible vs actual", () => {
    expect(formatCondition("Thundery outbreaks possible")).toBe("Possible Thunderstorms");
    expect(formatCondition("Thunderstorm")).toBe("Thunderstorms");
  });

  it("does not have a snow/blizzard mapping — structurally impossible for any of Uganda's districts", () => {
    // No district this app forecasts for is anywhere near freezing, so
    // "blizzard"/"blowing snow" should never resolve to "Snow" even if a
    // provider sent one of those strings as a data anomaly.
    expect(formatCondition("Blizzard")).not.toBe("Snow");
    expect(formatCondition("Blowing snow")).not.toBe("Snow");
  });

  it("falls back to generic title case for unmapped text", () => {
    expect(formatCondition("")).toBe("Partly Cloudy");
    expect(formatCondition("some unusual provider string")).toBe("Some Unusual Provider String");
  });
});

describe("formatHighLow", () => {
  it("formats high/low with the degree symbol", () => {
    expect(formatHighLow(28, 18)).toBe("H:28°  L:18°");
  });
});
