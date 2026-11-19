import { describe, expect, it } from "vitest";
import { getDistrictBySlug } from "@/lib/districts";
import { buildDistrictContent } from "@/lib/seo/district-content";
import { getWeatherProviderInfo } from "@/lib/weather/source";
import { en } from "./dictionaries/en";
import { lg } from "./dictionaries/lg";
import { formatDistrictPhrase } from "./index";
import { interpolate } from "./interpolate";
import { getDictionary } from "./useTranslation";

describe("i18n dictionary system", () => {
  it("has exact matching structure and keys between English and Luganda", () => {
    function getDeepKeys(obj: Record<string, unknown>, prefix = ""): string[] {
      return Object.keys(obj).flatMap((key) => {
        const val = obj[key];
        const next = prefix ? `${prefix}.${key}` : key;
        if (typeof val === "object" && val !== null) {
          return getDeepKeys(val as Record<string, unknown>, next);
        }
        return [next];
      });
    }

    const enKeys = getDeepKeys(en as unknown as Record<string, unknown>).sort();
    const lgKeys = getDeepKeys(lg as unknown as Record<string, unknown>).sort();

    expect(lgKeys).toEqual(enKeys);
  });

  it("ensures all translation values are non-empty strings", () => {
    function assertNonEmpty(obj: Record<string, unknown>, path = "") {
      for (const [key, val] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        if (typeof val === "object" && val !== null) {
          assertNonEmpty(val as Record<string, unknown>, currentPath);
        } else {
          expect(typeof val, `${currentPath} must be a string`).toBe("string");
          expect((val as string).trim().length, `${currentPath} must not be empty`).toBeGreaterThan(0);
        }
      }
    }

    assertNonEmpty(en as unknown as Record<string, unknown>);
    assertNonEmpty(lg as unknown as Record<string, unknown>);
  });

  it("verifies compliance with copy style (no em dashes, en dashes, arrows, or emojis)", () => {
    const forbidden = [
      { re: /—/, label: "em dash" },
      { re: /–/, label: "en dash" },
      { re: /[←→⇐⇒⬅➡]/, label: "arrow character" },
      { re: /[✓✗★☆⚠✅❌🚨⏳🎉🔥👍💡]/u, label: "decorative symbol or emoji" },
    ];

    function checkForbidden(obj: Record<string, unknown>, path = "") {
      for (const [key, val] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        if (typeof val === "object" && val !== null) {
          checkForbidden(val as Record<string, unknown>, currentPath);
        } else if (typeof val === "string") {
          for (const { re, label } of forbidden) {
            expect(re.test(val), `${currentPath} contains forbidden ${label}: "${val}"`).toBe(false);
          }
        }
      }
    }

    checkForbidden(en as unknown as Record<string, unknown>);
    checkForbidden(lg as unknown as Record<string, unknown>);
  });

  it("correctly interpolates dynamic template variables", () => {
    expect(interpolate("Feels Like {temp}°", { temp: 26 })).toBe("Feels Like 26°");
    expect(interpolate("Ewulirwa nga {temp}°", { temp: 24 })).toBe("Ewulirwa nga 24°");
    expect(interpolate("Ennaku {count} ezijja", { count: 10 })).toBe("Ennaku 10 ezijja");
    // Missing param retains token safely without throwing
    expect(interpolate("Ewulirwa nga {temp}°")).toBe("Ewulirwa nga {temp}°");
  });

  it("returns authentic Luganda meteorological terms", () => {
    const lgDict = getDictionary("lg");
    expect(lgDict.conditions.overcast).toBe("Ekiddedde");
    expect(lgDict.conditions.cloudy).toBe("Ekiddedde");
    expect(lgDict.conditions.drizzle).toBe("Obukubakuba");
    expect(lgDict.conditions.hail).toBe("Enkuba y'omuzira");
    expect(lgDict.conditions.hazy).toBe("Olukungu");
    expect(lgDict.conditions.fog).toBe("Olufu");
    expect(lgDict.marine.lakeVictoria).toBe("Ennyanja Nalubaale");
    expect(lgDict.marine.lakeAlbert).toBe("Ennyanja Mwitanzige");
    expect(lgDict.agriculture.title).toBe("Amagezi ag'ebyobulimi");
    expect(lgDict.legal.attribution).toContain("Si mukutu mutongole ogwa UNMA");
    expect(lgDict.agriculture.cropNames.coffee).toBe("Emmwanyi");
    expect(lgDict.agriculture.cropNames.cowpeas).toBe("Empindi");
    expect(lgDict.agriculture.cropNames.groundnuts).toBe("Ebinyeebwa");
    expect(lgDict.common.weekdayInitials[1]).toBe("Okb");
    expect(lgDict.metrics.feelsLike).toBe("Liwulirwa nga {temp}°");
    expect(lgDict.navigation.pageTitles["/privacy"]).toBe("Eby'ekyama");
  });

  it("localizes provider metadata and district reference copy for Luganda", () => {
    const provider = getWeatherProviderInfo("weatherapi.com", "lg");
    expect(provider.shortLabel).toBe("WeatherAPI");
    expect(provider.description).toContain("Amawulire amatereevu");

    const kampala = getDistrictBySlug("kampala");
    expect(kampala).toBeDefined();
    const contentLg = buildDistrictContent(kampala!, "lg");
    expect(contentLg.intro).toContain("Kampala");
    expect(contentLg.intro).toContain("Masekkati");
    expect(contentLg.intro).toContain("disitulikiti ya Kampala");
    const cityContentLg = buildDistrictContent({ ...kampala!, isCity: true, isLakeVictoriaZone: true }, "lg");
    expect(cityContentLg.intro).toContain("kibuga ekisangibwa");
    expect(cityContentLg.intro).toContain("ekibuga Kampala");
    expect(cityContentLg.seasons).toContain("Kampala kirina");
    expect(cityContentLg.lake).toContain("Kampala kiriraanye");
    expect(cityContentLg.faq[3].answer).toContain("Guno si mukutu mutongole ogwa UNMA.");
    expect(contentLg.seasons).toContain("Mugulansigo");
  });

  it("formats Luganda locative phrases cleanly for GPS Your location", () => {
    const lgDict = getDictionary("lg");
    expect(formatDistrictPhrase(lgDict.common.clockInDistrict, "Your location", lgDict, "lg")).toBe(
      " mu kifo w'oli",
    );
    expect(formatDistrictPhrase(lgDict.common.nearDistrict, "Your location", lgDict, "lg")).toBe(
      "Okumpi n'ekifo w'oli",
    );
    expect(
      formatDistrictPhrase(lgDict.sheets.sunset.defaultHeadline, "Ekifo w'oli", lgDict, "lg"),
    ).toBe("Okuvaayo n'okugwa kw'enjuba biraga entandikwa n'enkomerero y'emisana mu kifo w'oli.");
    expect(formatDistrictPhrase(lgDict.common.clockInDistrict, "Kampala", lgDict, "lg")).toBe(
      " e Kampala",
    );
  });
});
