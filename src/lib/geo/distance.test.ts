import { describe, expect, it } from "vitest";
import { distanceKm, sortByDistance } from "./distance";

describe("distanceKm", () => {
  it("returns 0 for the same point", () => {
    expect(distanceKm({ lat: 0.3476, lon: 32.5825 }, { lat: 0.3476, lon: 32.5825 })).toBeCloseTo(0, 5);
  });

  it("returns a realistic distance between Kampala and Entebbe", () => {
    const kampala = { lat: 0.3476, lon: 32.5825 };
    const entebbe = { lat: 0.0512, lon: 32.4637 };
    const km = distanceKm(kampala, entebbe);
    expect(km).toBeGreaterThan(30);
    expect(km).toBeLessThan(45);
  });
});

describe("sortByDistance", () => {
  it("orders points nearest first without mutating the input", () => {
    const kampala = { lat: 0.3476, lon: 32.5825 };
    const points = [
      { key: "far", lat: 3.85, lon: 33.75 },
      { key: "near", lat: 0.0512, lon: 32.4637 },
    ];
    const sorted = sortByDistance(points, kampala);
    expect(sorted.map((p) => p.key)).toEqual(["near", "far"]);
    expect(points.map((p) => p.key)).toEqual(["far", "near"]);
  });
});
