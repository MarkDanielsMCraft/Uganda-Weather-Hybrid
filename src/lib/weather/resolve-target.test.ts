import { describe, expect, it } from "vitest";
import { resolveWeatherTarget } from "./resolve-target";

describe("resolveWeatherTarget", () => {
  it("resolves a known district slug", () => {
    const result = resolveWeatherTarget(new URLSearchParams({ district: "kampala" }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.district.slug).toBe("kampala");
      expect(result.cacheKey).toBe("ug:weather:kampala:bundle:v6");
    }
  });

  it("prefers a place (lat/lon) over a district when both are present", () => {
    const result = resolveWeatherTarget(
      new URLSearchParams({
        district: "kampala",
        place: "kyaziiza",
        name: "Kyaziiza",
        lat: "0.34",
        lon: "32.58",
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cacheKey).toContain("kyaziiza");
    }
  });

  it("returns NOT_FOUND for a well-formed but unknown district slug", () => {
    const result = resolveWeatherTarget(new URLSearchParams({ district: "not-a-real-place" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_FOUND");
  });

  it("returns BAD_REQUEST when neither a district nor a place is given", () => {
    const result = resolveWeatherTarget(new URLSearchParams());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("BAD_REQUEST");
  });

  it("returns BAD_REQUEST for a malformed district slug (uppercase/spaces)", () => {
    const result = resolveWeatherTarget(new URLSearchParams({ district: "Not Valid!" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("BAD_REQUEST");
  });
});
