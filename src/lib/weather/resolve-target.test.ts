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
      expect(result.isPlace).toBe(true);
      expect(result.district.name).toBe("Kyaziiza");
      expect(result.cacheKey).toContain("place-point:0.34:32.58");
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

  it("gives made up names at the same point one shared saved copy, so they cannot add paid calls", () => {
    const real = target(REAL);
    const renamed = target(REAL.replace("name=Kireka", "name=Wrong%20Place"));
    expect(real.ok && renamed.ok).toBe(true);
    if (real.ok && renamed.ok) expect(renamed.cacheKey).toBe(real.cacheKey);
  });

  it("shows each visitor only the name they asked for, never one from the saved copy", async () => {
    const { withRequestedPlace } = await import("@/lib/weather/resolve-target");
    const real = target(REAL);
    const renamed = target(REAL.replace("name=Kireka", "name=Wrong%20Place"));
    if (!real.ok || !renamed.ok) throw new Error("both should resolve");
    const savedByOtherVisitor = { district: renamed.district, rain: 40 };
    const shown = withRequestedPlace(savedByOtherVisitor, real);
    expect(shown.district.name).toBe("Kireka");
    expect(shown.rain).toBe(40);
    const partial = withRequestedPlace({ district: { slug: "x", name: "Wrong Place", region: "central" } }, real);
    expect(partial.district.name).toBe("Kireka");
  });

  it("keeps a request with a moved point out of the real visitors' entry", () => {
    const real = target(REAL);
    const moved = target(REAL.replace("lat=0.3460", "lat=-3.9000"));
    if (real.ok && moved.ok) expect(moved.cacheKey).not.toBe(real.cacheKey);
  });

  it("replaces planted names and drops planted labels, as both attack passes sent them", () => {
    const planted = [
      "place=pentest-key-1&name=POISONED%20NAME&lat=-3.9&lon=29.1&label=Fake%20label%20call%200772000000",
      "place=x8&name=Kampala%20FLOOD%20ALERT%20send%20mobile%20money%20to%20O77Two%20scam-help.com&lat=0.31&lon=32.58",
      `place=x9&name=${encodeURIComponent("ｈｔｔｐｓ：／／ｓｃａｍ．ｃｏｍ Call O77I２３")}&lat=0.31&lon=32.58`,
      "place=x10&name=www.scam.ug&lat=0.3&lon=32.5",
      "place=x11&name=help%40scam.ug&lat=0.3&lon=32.5",
      "place=x12&name=%3Cscript%3E&lat=0.3&lon=32.5",
    ];
    for (const query of planted) {
      const result = target(query);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      const shown = `${result.district.name} ${result.district.placeLabel ?? ""}`;
      expect(shown).not.toMatch(/call|money|scam|www|@|<|07|ｈ/i);
    }
  });

  it("refuses place keys the app never makes", () => {
    expect(target("place=%3Cimg%20src%3Dx%3E&name=Kireka&lat=0.3&lon=32.5").ok).toBe(false);
  });

  it("still accepts real place names with apostrophes and brackets", () => {
    expect(target("place=village-2&name=Ng%27ombe&lat=0.3&lon=32.5").ok).toBe(true);
    expect(target("place=airport-ebb&name=Entebbe%20(EBB)&lat=0.04&lon=32.44").ok).toBe(true);
  });
});
