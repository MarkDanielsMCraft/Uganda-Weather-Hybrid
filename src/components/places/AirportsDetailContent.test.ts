import { describe, expect, it } from "vitest";
import { windLine, type MetarReport } from "./AirportsDetailContent";

function mockMetar(overrides: Partial<MetarReport> = {}): MetarReport {
  return {
    icaoId: "HUEN",
    name: "Entebbe",
    rawOb: "HUEN 120000Z VRB05KT 9999 SCT020 24/19 Q1015",
    reportTime: "2026-11-12T00:00:00Z",
    tempC: 24,
    dewpointC: 19,
    windDirDeg: 180,
    windSpeedKt: 5,
    visibility: "10+",
    altimeterHpa: 1015,
    flightCategory: "VFR",
    ...overrides,
  };
}

describe("windLine", () => {
  it("keeps the production English output for variable wind direction (VRB)", () => {
    expect(windLine(mockMetar({ windDirDeg: "VRB", windSpeedKt: 5 }))).toBe("5 kt");
  });

  it("handles calm and missing wind speed", () => {
    expect(windLine(mockMetar({ windSpeedKt: 0 }))).toBe("Calm");
    expect(windLine(mockMetar({ windSpeedKt: null }))).toBe("Calm or not reported");
  });

  it("formats directional wind speed", () => {
    expect(windLine(mockMetar({ windDirDeg: 90, windSpeedKt: 12 }))).toBe("E at 12 kt");
  });
});
