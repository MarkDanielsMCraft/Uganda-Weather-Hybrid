import { describe, expect, it } from "vitest";
import { findNearestDistrict, getAllDistricts, getDistrictBySlug, searchDistricts } from "./index";

describe("getDistrictBySlug / getAllDistricts", () => {
  it("finds a known district by slug", () => {
    expect(getDistrictBySlug("kampala")?.name).toBe("Kampala");
  });

  it("returns undefined for an unknown slug", () => {
    expect(getDistrictBySlug("not-a-real-district")).toBeUndefined();
  });

  it("loads all 152 Uganda districts", () => {
    expect(getAllDistricts().length).toBe(152);
  });

  it("filters by region", () => {
    const central = getAllDistricts("central");
    expect(central.length).toBeGreaterThan(0);
    expect(central.every((d) => d.region === "central")).toBe(true);
  });
});

describe("searchDistricts", () => {
  it("returns nothing for a query shorter than 2 characters", () => {
    expect(searchDistricts("k")).toEqual([]);
  });

  it("ranks an exact name match above a prefix or substring match", () => {
    const results = searchDistricts("Kabale");
    expect(results[0].name).toBe("Kabale");
    expect(results[0].matchScore).toBe(100);
  });

  it("prefers the City variant when a district has both, even though the plain name was the exact match", () => {
    // "Jinja" (exact match, score 100) and "Jinja City" (prefix match,
    // score 80) both exist; the dedup step prefers the City entry for
    // display, so the surfaced result keeps that entry's own score.
    const results = searchDistricts("Jinja");
    expect(results[0].name).toBe("Jinja City");
    expect(results[0].matchScore).toBe(80);
  });

  it("de-duplicates a district and its city variant, preferring the city", () => {
    const results = searchDistricts("Mbarara");
    const names = results.map((r) => r.name);
    // Only one "Mbarara"-ish entry should win the dedup, not both
    // "Mbarara" and "Mbarara City" separately.
    const mbararaEntries = names.filter((n) => n.replace(/\s+City$/i, "") === "Mbarara");
    expect(mbararaEntries.length).toBe(1);
  });

  it("respects the result limit", () => {
    const results = searchDistricts("ka", 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });
});

describe("findNearestDistrict", () => {
  it("finds Kampala for coordinates right on top of it", () => {
    expect(findNearestDistrict(0.3476, 32.5825).slug).toBe("kampala");
  });

  it("returns the closest district for an arbitrary coordinate", () => {
    // Somewhere in the Kalangala islands on Lake Victoria.
    const nearest = findNearestDistrict(-0.63, 32.39);
    expect(nearest.region).toBe("central");
  });
});
