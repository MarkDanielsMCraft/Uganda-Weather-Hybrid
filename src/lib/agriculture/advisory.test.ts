import { describe, expect, it } from "vitest";
import { buildAgricultureAdvisory, ZONE_CROPS } from "./advisory";
import { makeWeatherBundle } from "@/lib/test-fixtures/weather-bundle";

describe("buildAgricultureAdvisory soil moisture", () => {
  it("reads upcoming rain from the forecast's rainChance, not temperature swing", () => {
    // Regression test: soilMoistureFromWeather used to check
    // `day.high - day.low > 8` (a temperature swing) for "upcoming rain",
    // which is unrelated to precipitation and often signals the opposite
    // (clear/dry days swing more than overcast/rainy ones).
    const dryTodayButRainSoon = makeWeatherBundle({
      precipitation: { mm: 0, chance: 10 },
      dailyForecast: [
        { day: "Today", high: 28, low: 20, icon: "", isToday: true, rainChance: 10 },
        { day: "Tomorrow", high: 27, low: 19, icon: "", isToday: false, rainChance: 75 },
      ],
    });
    expect(buildAgricultureAdvisory(dryTodayButRainSoon).soilMoisture.level).toBe("moderate");

    const dryWithBigSwingButNoRainComing = makeWeatherBundle({
      precipitation: { mm: 0, chance: 10 },
      dailyForecast: [
        { day: "Today", high: 30, low: 15, icon: "", isToday: true, rainChance: 5 },
        { day: "Tomorrow", high: 31, low: 14, icon: "", isToday: false, rainChance: 5 },
      ],
    });
    expect(buildAgricultureAdvisory(dryWithBigSwingButNoRainComing).soilMoisture.level).toBe("low");
  });

  it("reports high soil moisture after recent rain", () => {
    const wet = makeWeatherBundle({ precipitation: { mm: 6, chance: 80 } });
    expect(buildAgricultureAdvisory(wet).soilMoisture.level).toBe("high");
  });
});

describe("buildAgricultureAdvisory crop relevance", () => {
  it("advises on every crop the district's agro-zone actually grows, and nothing else", () => {
    // Regression test: buildCropAdvisories used to return a fixed 5-crop
    // "flagship" set for every district regardless of zone, e.g. a
    // "Coffee" advisory for Karamoja (sorghum/millet/cowpeas, no coffee).
    // It was then fixed to filter down to zone-relevant flagship crops
    // only, which meant Karamoja got zero advisories (none of the 5
    // flagship crops are grown there) instead of wrong ones. The full
    // fix covers every crop named in ZONE_CROPS, so Karamoja now gets
    // real advice for the crops it actually grows.
    const karamoja = makeWeatherBundle({
      district: {
        id: "abim",
        name: "Abim",
        slug: "abim",
        region: "northern",
        coordinates: { lat: 2.7, lon: 33.6 },
        rainfallPattern: "unimodal",
        agroZone: "karamoja",
        hazards: [],
      },
    });
    const advisory = buildAgricultureAdvisory(karamoja);
    expect(advisory.crops).toEqual(["Sorghum", "Millet", "Cowpeas"]);
    const ids = advisory.cropAdvisories.map((c) => c.id).sort();
    expect(ids).toEqual(["cowpeas", "millet", "sorghum"]);
  });

  it("covers all four banana/coffee zone crops, not just the original 5-crop flagship subset", () => {
    const kampala = makeWeatherBundle();
    const advisory = buildAgricultureAdvisory(kampala);
    const ids = advisory.cropAdvisories.map((c) => c.id).sort();
    expect(ids).toEqual(["banana", "beans", "coffee", "maize"]);
  });

  it("shows cotton advice only in cotton-growing zones", () => {
    const cottonZone = makeWeatherBundle({
      district: {
        id: "lira",
        name: "Lira",
        slug: "lira",
        region: "northern",
        coordinates: { lat: 2.24, lon: 32.9 },
        rainfallPattern: "unimodal",
        agroZone: "banana_millet_cotton",
        hazards: [],
      },
    });
    const advisory = buildAgricultureAdvisory(cottonZone);
    expect(advisory.cropAdvisories.some((c) => c.id === "cotton")).toBe(true);

    const nonCottonZone = makeWeatherBundle();
    const kampalaAdvisory = buildAgricultureAdvisory(nonCottonZone);
    expect(kampalaAdvisory.cropAdvisories.some((c) => c.id === "cotton")).toBe(false);
  });

  it("gives every crop in every agro-zone a real, non-empty advisory — full ZONE_CROPS coverage", () => {
    // Every zone crop (Coffee, Banana, Maize, Beans, Cotton, Millet,
    // Cassava, Sorghum, Cowpeas, Sesame, Rice, Groundnuts, Irish potato)
    // now has its own advisory function, not just the original 5-crop
    // "flagship" subset. This walks every zone in ZONE_CROPS and checks
    // nothing falls through with a missing or blank advisory.
    for (const [agroZone, crops] of Object.entries(ZONE_CROPS)) {
      const bundle = makeWeatherBundle({
        district: {
          id: agroZone,
          name: agroZone,
          slug: agroZone,
          region: "central",
          coordinates: { lat: 1, lon: 32 },
          rainfallPattern: "bimodal",
          agroZone,
          hazards: [],
        },
      });
      const advisory = buildAgricultureAdvisory(bundle);
      expect(advisory.cropAdvisories).toHaveLength(crops.length);
      for (const cropAdvisory of advisory.cropAdvisories) {
        expect(cropAdvisory.summary.length).toBeGreaterThan(0);
        expect(cropAdvisory.statusLabel.length).toBeGreaterThan(0);
      }
    }
  });
});
