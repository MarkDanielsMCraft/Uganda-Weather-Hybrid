import { describe, expect, it } from "vitest";
import { resolveWeatherTheme, themeFromIconUrl } from "./theme-from-icon";

describe("themeFromIconUrl", () => {
  it("defaults to partly_cloudy by day / night by night when the icon is empty", () => {
    expect(themeFromIconUrl("", true)).toBe("partly_cloudy");
    expect(themeFromIconUrl("", false)).toBe("night");
  });

  it("maps fog/mist codes regardless of day/night", () => {
    expect(themeFromIconUrl("//cdn.weatherapi.com/day/149.png")).toBe("fog");
    expect(themeFromIconUrl("//cdn.weatherapi.com/night/143.png")).toBe("fog");
  });

  it("maps the clear-sky icon to clear only during the day", () => {
    expect(themeFromIconUrl("//cdn.weatherapi.com/day/113.png", true)).toBe("clear");
  });

  it("maps the clear-sky night icon to night", () => {
    expect(themeFromIconUrl("//cdn.weatherapi.com/night/113.png", false)).toBe("night");
  });

  it("maps thunder codes to thunder", () => {
    expect(themeFromIconUrl("//cdn.weatherapi.com/day/200.png")).toBe("thunder");
  });

  it("maps rain codes to rain", () => {
    expect(themeFromIconUrl("//cdn.weatherapi.com/day/296.png")).toBe("rain");
  });
});

describe("resolveWeatherTheme", () => {
  it("prefers the WeatherAPI condition code over everything else when present", () => {
    expect(resolveWeatherTheme("clear", "//cdn.weatherapi.com/day/296.png", 1087, true)).toBe(
      "thunder",
    );
  });

  it("falls back to the explicit theme when there's no code", () => {
    expect(resolveWeatherTheme("cloudy", "", undefined, true)).toBe("cloudy");
  });

  it("falls back to inferring from the icon URL when neither code nor theme is given", () => {
    expect(resolveWeatherTheme(undefined, "//cdn.weatherapi.com/day/113.png", undefined, true)).toBe(
      "clear",
    );
  });
});
