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

function target(query: string) {
  return resolveWeatherTarget(new URLSearchParams(query));
}

const REAL = "place=village-101&name=Kireka&lat=0.3460&lon=32.6480&label=Kira%2C%20Wakiso";

describe("resolveWeatherTarget cache keys", () => {
  it("gives the same key to the same real place", () => {
    const a = target(REAL);
    const b = target(REAL);
    expect(a.ok && b.ok && a.cacheKey === b.cacheKey).toBe(true);
  });

  it("keeps a request with a made up name out of the real visitors' entry", () => {
    const real = target(REAL);
    const planted = target(REAL.replace("name=Kireka", "name=Wrong%20Place"));
    expect(real.ok && planted.ok).toBe(true);
    if (real.ok && planted.ok) expect(planted.cacheKey).not.toBe(real.cacheKey);
  });

  it("keeps a request with a moved point out of the real visitors' entry", () => {
    const real = target(REAL);
    const moved = target(REAL.replace("lat=0.3460", "lat=-3.9000"));
    if (real.ok && moved.ok) expect(moved.cacheKey).not.toBe(real.cacheKey);
  });

  it("refuses a label with a phone number, as the attack pass sent it", () => {
    const result = target(
      "place=pentest-key-1&name=POISONED%20NAME&lat=-3.9&lon=29.1&label=Fake%20label%20call%200772000000",
    );
    expect(result.ok).toBe(false);
  });

  it("refuses names with links, emails, or markup", () => {
    for (const name of ["www.scam.ug", "help%40scam.ug", "%3Cscript%3E", "call%20https%3A%2F%2Fx.ug"]) {
      expect(target(`place=village-1&name=${name}&lat=0.3&lon=32.5`).ok).toBe(false);
    }
  });

  it("still accepts real place names with apostrophes and brackets", () => {
    expect(target("place=village-2&name=Ng%27ombe&lat=0.3&lon=32.5").ok).toBe(true);
    expect(target("place=airport-ebb&name=Entebbe%20(EBB)&lat=0.04&lon=32.44").ok).toBe(true);
  });
});
