import { describe, expect, it } from "vitest";
import { getEquatorialSunPosition } from "./solar-ephemeris";

describe("solar ephemeris for equatorial Uganda", () => {
  it("computes night status for midnight EAT", () => {
    // 21:00 UTC = 00:00 EAT (Midnight)
    const midnight = new Date("2026-10-14T21:00:00Z");
    const pos = getEquatorialSunPosition(midnight);

    expect(pos.isDaylight).toBe(false);
    expect(pos.strength).toBe(0);
    expect(pos.elevationDeg).toBeLessThan(0);
  });

  it("computes steep sunrise around 6:45 AM EAT", () => {
    // 03:45 UTC = 06:45 EAT (Sunrise)
    const sunrise = new Date("2026-10-14T03:45:00Z");
    const pos = getEquatorialSunPosition(sunrise);

    expect(pos.isDaylight).toBe(true);
    expect(pos.x).toBeCloseTo(0.18, 1);
    expect(pos.y).toBeCloseTo(0.32, 1);
  });

  it("computes overhead zenith near solar noon (12:45 PM EAT)", () => {
    // 09:45 UTC = 12:45 EAT (Solar noon)
    const noon = new Date("2026-10-14T09:45:00Z");
    const pos = getEquatorialSunPosition(noon);

    expect(pos.isDaylight).toBe(true);
    expect(pos.x).toBeCloseTo(0.50, 1);
    expect(pos.y).toBeCloseTo(0.88, 1);
    expect(pos.elevationDeg).toBeGreaterThan(85);
    expect(pos.strength).toBeCloseTo(1, 1);
  });

  it("computes rapid sunset around 6:45 PM EAT", () => {
    // 15:45 UTC = 18:45 EAT (Sunset)
    const sunset = new Date("2026-10-14T15:45:00Z");
    const pos = getEquatorialSunPosition(sunset);

    expect(pos.isDaylight).toBe(true);
    expect(pos.x).toBeCloseTo(0.82, 1);
    expect(pos.y).toBeCloseTo(0.32, 1);
  });
});

