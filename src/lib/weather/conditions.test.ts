import { describe, expect, it } from "vitest";
import {
  conditionCodeToTheme,
  isAtmosphericVisibility,
  sceneThemeFor,
  shouldDrawFogLayer,
  shouldDrawNightSky,
  shouldDrawSun,
} from "./conditions";

describe("conditionCodeToTheme", () => {
  it("maps thunderstorm codes to thunder regardless of day/night", () => {
    expect(conditionCodeToTheme(1087, true)).toBe("thunder");
    expect(conditionCodeToTheme(1273, false)).toBe("thunder");
  });

  it("maps rain codes to rain", () => {
    expect(conditionCodeToTheme(1063, true)).toBe("rain");
    expect(conditionCodeToTheme(1180, true)).toBe("rain");
  });

  it("maps fog/mist/haze codes to fog", () => {
    expect(conditionCodeToTheme(1030, true)).toBe("fog");
    expect(conditionCodeToTheme(1135, true)).toBe("fog");
    expect(conditionCodeToTheme(1147, true)).toBe("fog");
  });

  it("falls back to night for any non-storm/rain/fog code after sunset", () => {
    expect(conditionCodeToTheme(1000, false)).toBe("night");
    expect(conditionCodeToTheme(1003, false)).toBe("night");
  });

  it("maps clear-sky code 1000 to clear during the day", () => {
    expect(conditionCodeToTheme(1000, true)).toBe("clear");
  });

  it("maps 1003 to partly_cloudy and 1006/1009 to cloudy during the day", () => {
    expect(conditionCodeToTheme(1003, true)).toBe("partly_cloudy");
    expect(conditionCodeToTheme(1006, true)).toBe("cloudy");
    expect(conditionCodeToTheme(1009, true)).toBe("cloudy");
  });

  it("defaults unrecognized daytime codes to partly_cloudy", () => {
    expect(conditionCodeToTheme(9999, true)).toBe("partly_cloudy");
  });
});

describe("isAtmosphericVisibility", () => {
  it("covers the WeatherAPI 1030-1049 mist/fog/haze/dust range", () => {
    expect(isAtmosphericVisibility(1030)).toBe(true);
    expect(isAtmosphericVisibility(1049)).toBe(true);
    expect(isAtmosphericVisibility(1029)).toBe(false);
    expect(isAtmosphericVisibility(1050)).toBe(false);
  });

  it("includes the smoky-haze codes 1135 and 1147", () => {
    expect(isAtmosphericVisibility(1135)).toBe(true);
    expect(isAtmosphericVisibility(1147)).toBe(true);
  });
});

describe("sceneThemeFor", () => {
  it("uses the night scene after sunset for calm conditions", () => {
    expect(sceneThemeFor("clear", false)).toBe("night");
    expect(sceneThemeFor("partly_cloudy", false)).toBe("night");
  });

  it("keeps rain/thunder scenes at night instead of forcing a night sky", () => {
    expect(sceneThemeFor("rain", false)).toBe("rain");
    expect(sceneThemeFor("thunder", false)).toBe("thunder");
  });

  it("passes the theme through unchanged during the day", () => {
    expect(sceneThemeFor("cloudy", true)).toBe("cloudy");
  });
});

describe("shouldDrawSun / shouldDrawNightSky / shouldDrawFogLayer", () => {
  it("only draws the sun during the day for clear/partly_cloudy/fog", () => {
    expect(shouldDrawSun("clear", true)).toBe(true);
    expect(shouldDrawSun("clear", false)).toBe(false);
    expect(shouldDrawSun("rain", true)).toBe(false);
  });

  it("draws the night sky for the night theme or whenever sun is down", () => {
    expect(shouldDrawNightSky("night", true)).toBe(true);
    expect(shouldDrawNightSky("clear", false)).toBe(true);
    expect(shouldDrawNightSky("rain", false)).toBe(true);
    expect(shouldDrawNightSky("thunder", false)).toBe(true);
  });

  it("only draws the fog layer for the fog theme", () => {
    expect(shouldDrawFogLayer("fog")).toBe(true);
    expect(shouldDrawFogLayer("cloudy")).toBe(false);
  });
});
