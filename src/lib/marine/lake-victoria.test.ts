import { describe, expect, it } from "vitest";
import { computeFishingSafety, lakeZoneForDistrict, referenceLakeDistrictSlug } from "./lake-victoria";
import { makeDistrict, makeWeatherBundle } from "@/lib/test-fixtures/weather-bundle";

describe("computeFishingSafety", () => {
  it("flags danger during a thunderstorm regardless of wind/waves", () => {
    const stormy = makeWeatherBundle({
      condition: { code: 1087, text: "Thundery outbreaks", icon: "", theme: "thunder" },
      wind: { speedKph: 5, gustKph: 8, direction: "N", degree: 0 },
    });
    expect(computeFishingSafety(stormy).level).toBe("danger");
  });

  it("flags danger when wind exceeds the danger threshold", () => {
    const windy = makeWeatherBundle({ wind: { speedKph: 45, gustKph: 55, direction: "E", degree: 90 } });
    expect(computeFishingSafety(windy).level).toBe("danger");
  });

  it("flags caution for moderate wind or low visibility, not danger", () => {
    const moderate = makeWeatherBundle({ wind: { speedKph: 28, gustKph: 30, direction: "E", degree: 90 } });
    expect(computeFishingSafety(moderate).level).toBe("caution");

    const hazy = makeWeatherBundle({ visibilityKm: 1 });
    expect(computeFishingSafety(hazy).level).toBe("caution");
  });

  it("reports safe for calm, clear conditions", () => {
    const calm = makeWeatherBundle({ wind: { speedKph: 8, gustKph: 10, direction: "S", degree: 180 } });
    expect(computeFishingSafety(calm).level).toBe("safe");
  });
});

describe("lakeZoneForDistrict", () => {
  it("routes Jinja to the eastern zone", () => {
    expect(lakeZoneForDistrict(makeDistrict({ slug: "jinja", region: "eastern" }))).toBe("eastern");
  });

  it("routes districts west of the lake by longitude to the western zone", () => {
    const western = makeDistrict({ slug: "masaka", region: "central", coordinates: { lat: -0.33, lon: 31.7 } });
    expect(lakeZoneForDistrict(western)).toBe("western");
  });

  it("defaults to the central zone otherwise", () => {
    const central = makeDistrict({ slug: "kalangala", region: "central", coordinates: { lat: -0.6, lon: 32.5 } });
    expect(lakeZoneForDistrict(central)).toBe("central");
  });
});

describe("referenceLakeDistrictSlug", () => {
  it("uses the district itself when it's already a lake-zone district", () => {
    const kalangala = makeDistrict({ slug: "kalangala", isLakeVictoriaZone: true });
    expect(referenceLakeDistrictSlug(kalangala)).toBe("kalangala");
  });

  it("falls back to the nearest canonical lake reference district otherwise", () => {
    const inlandEastern = makeDistrict({ slug: "mbale", region: "eastern", isLakeVictoriaZone: false });
    expect(referenceLakeDistrictSlug(inlandEastern)).toBe("jinja");
  });
});
