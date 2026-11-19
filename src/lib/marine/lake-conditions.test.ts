import { describe, expect, it } from "vitest";
import {
  ALBERT_CONFIG,
  buildLakeConditions,
  KYOGA_CONFIG,
  referenceLakeDistrictSlug,
} from "./lake-conditions";
import { makeDistrict, makeWeatherBundle } from "@/lib/test-fixtures/weather-bundle";

describe("referenceLakeDistrictSlug (generic)", () => {
  it("uses the district itself when it's already a shoreline district", () => {
    const buliisa = makeDistrict({ slug: "buliisa" });
    expect(referenceLakeDistrictSlug(buliisa, ALBERT_CONFIG)).toBe("buliisa");
  });

  it("falls back to the lake's reference district otherwise", () => {
    const inland = makeDistrict({ slug: "mbale" });
    expect(referenceLakeDistrictSlug(inland, KYOGA_CONFIG)).toBe("amolatar");
  });
});

describe("buildLakeConditions (generic)", () => {
  it("computes real conditions from the weather bundle for any lake config", () => {
    const weather = makeWeatherBundle({
      district: makeDistrict({ slug: "buliisa" }),
      wind: { speedKph: 10, gustKph: 14, direction: "S", degree: 180 },
      temperature: { celsius: 26, feelsLike: 26 },
    });
    const conditions = buildLakeConditions(weather, ALBERT_CONFIG);
    expect(conditions.zoneLabel).toBe("Lake Albert");
    expect(conditions.fishingSafety.level).toBe("safe");
    expect(conditions.waterTempC).toBeGreaterThanOrEqual(22);
  });
});
