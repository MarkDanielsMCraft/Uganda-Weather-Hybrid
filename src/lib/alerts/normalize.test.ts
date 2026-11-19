import { describe, expect, it } from "vitest";
import {
  isAlertActive,
  mapAlertSeverity,
  normalizeWeatherApiAlerts,
  prepareAlerts,
  sortAlertsBySeverity,
} from "./normalize";
import type { WeatherAlert } from "@/types/weather";

describe("mapAlertSeverity", () => {
  it("maps extreme/severe/warning/watch keywords case-insensitively", () => {
    expect(mapAlertSeverity("Extreme")).toBe("extreme");
    expect(mapAlertSeverity("SEVERE thunderstorm")).toBe("warning");
    expect(mapAlertSeverity("Flood Warning")).toBe("warning");
    expect(mapAlertSeverity("Wind watch")).toBe("watch");
  });

  it("defaults to advisory for anything unrecognized", () => {
    expect(mapAlertSeverity("informational notice")).toBe("advisory");
  });
});

function alert(overrides: Partial<WeatherAlert> = {}): WeatherAlert {
  return {
    id: "1",
    title: "Test alert",
    description: "desc",
    severity: "advisory",
    source: "WeatherAPI",
    issuedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("isAlertActive", () => {
  it("is active when there's no expiry", () => {
    expect(isAlertActive(alert({ expiresAt: undefined }))).toBe(true);
  });

  it("is active before expiry and inactive after", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    expect(isAlertActive(alert({ expiresAt: "2026-01-01T13:00:00Z" }), now)).toBe(true);
    expect(isAlertActive(alert({ expiresAt: "2026-01-01T11:00:00Z" }), now)).toBe(false);
  });
});

describe("sortAlertsBySeverity", () => {
  it("orders extreme > warning > watch > advisory", () => {
    const sorted = sortAlertsBySeverity([
      alert({ id: "a", severity: "advisory" }),
      alert({ id: "e", severity: "extreme" }),
      alert({ id: "wa", severity: "watch" }),
      alert({ id: "wr", severity: "warning" }),
    ]);
    expect(sorted.map((a) => a.id)).toEqual(["e", "wr", "wa", "a"]);
  });

  it("breaks ties by most recently issued first", () => {
    const sorted = sortAlertsBySeverity([
      alert({ id: "old", severity: "warning", issuedAt: "2026-01-01T00:00:00Z" }),
      alert({ id: "new", severity: "warning", issuedAt: "2026-01-02T00:00:00Z" }),
    ]);
    expect(sorted.map((a) => a.id)).toEqual(["new", "old"]);
  });
});

describe("prepareAlerts", () => {
  it("drops expired alerts and de-dupes by title+issuedAt", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    const issuedAt = "2026-01-01T10:00:00Z";
    const result = prepareAlerts(
      [
        alert({ id: "1", title: "Flood", issuedAt, expiresAt: "2026-01-01T11:00:00Z" }), // expired
        alert({ id: "2", title: "Storm", issuedAt, severity: "warning" }),
        alert({ id: "3", title: "Storm", issuedAt, severity: "warning" }), // duplicate of 2
      ],
      now,
    );
    expect(result.map((a) => a.id)).toEqual(["2"]);
  });
});

describe("normalizeWeatherApiAlerts", () => {
  it("returns an empty array when there's no raw alert data", () => {
    expect(normalizeWeatherApiAlerts("kampala", undefined)).toEqual([]);
  });

  it("normalizes a single alert object into an array", () => {
    const result = normalizeWeatherApiAlerts("kampala", {
      headline: "Heavy Rain Warning",
      severity: "severe",
      effective: "2026-01-01T00:00:00Z",
      expires: "2026-01-02T00:00:00Z",
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      title: "Heavy Rain Warning",
      severity: "warning",
      source: "WeatherAPI",
    });
  });

  it("falls back to a generic title and advisory description when fields are missing", () => {
    const result = normalizeWeatherApiAlerts("kampala", [{}]);
    expect(result[0].title).toBe("Weather Alert");
    expect(result[0].description).toBe("Monitor local conditions.");
    expect(result[0].severity).toBe("advisory");
  });
});
