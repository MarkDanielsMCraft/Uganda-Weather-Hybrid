import { describe, expect, it } from "vitest";
import { getAllDistricts } from "@/lib/districts";
import {
  districtSearchDescription,
  districtSearchDescriptionLg,
  districtSearchTitle,
} from "@/lib/seo/district-content";

const districts = getAllDistricts();

describe("district search text", () => {
  it("gives every district its own description, in English and Luganda", () => {
    expect(new Set(districts.map(districtSearchDescription)).size).toBe(districts.length);
    expect(new Set(districts.map(districtSearchDescriptionLg)).size).toBe(districts.length);
  });

  it("keeps titles within 60 characters and descriptions within 155, so search results do not cut them", () => {
    for (const district of districts) {
      expect(`${districtSearchTitle(district)} | Uganda Weather`.length).toBeLessThanOrEqual(60);
      expect(districtSearchDescription(district).length).toBeLessThanOrEqual(155);
      expect(districtSearchDescriptionLg(district).length).toBeLessThanOrEqual(155);
    }
  });

  it("puts the place name first and never leaves English region words in Luganda", () => {
    for (const district of districts) {
      expect(districtSearchTitle(district).startsWith(district.name)).toBe(true);
      expect(districtSearchDescription(district).startsWith(district.name)).toBe(true);
      expect(districtSearchDescriptionLg(district)).not.toMatch(/\b(central|eastern|northern|western)\b/i);
    }
  });
});
