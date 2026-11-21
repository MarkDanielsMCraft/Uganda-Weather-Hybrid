import { describe, expect, it } from "vitest";
import { makeWeatherBundle } from "@/lib/test-fixtures/weather-bundle";
import { normalizeLugandaForSpeech, numberToLugandaWords } from "./luganda-speech";
import {
  buildHomeWeatherNarration,
  buildSectionNarration,
  buildSheetNarration,
  selectSpokenPayload,
} from "./narrator";

describe("narrator and Munno Luganda speech normalizer", () => {
  it("uses Class 8 bi- numeral concords for hundreds (bikumi bibiri, bisatu, bina, bitaano)", () => {
    expect(numberToLugandaWords(100)).toBe("kikumi");
    expect(numberToLugandaWords(200)).toBe("bikumi bibiri");
    expect(numberToLugandaWords(300)).toBe("bikumi bisatu");
    expect(numberToLugandaWords(400)).toBe("bikumi bina");
    expect(numberToLugandaWords(500)).toBe("bikumi bitaano");
    expect(numberToLugandaWords(245)).toBe("bikumi bibiri mu ana mu ttaano");
  });

  it("normalizes degrees, percentages, and wind speeds into natural spoken Luganda", () => {
    expect(normalizeLugandaForSpeech("Gulu City: 25°C, enkuba 80%, empewo 12 km/h")).toBe(
      "Ekibuga Gulu: ddiguli abiri mu ttaano, enkuba ebitundu kinaana ku kikumi, empewo kilomiita kkumi na bbiri buli ssaawa",
    );
  });

  it("normalizes English AM/PM times, compact Luganda times, degree ranges, negative degrees, and decimals into authentic Luganda", () => {
    expect(normalizeLugandaForSpeech("ku ssaawa 7:00 am oba 8:00 am")).toBe(
      "ku ssaawa emu eyokumakya oba ssaawa bbiri ezokumakya",
    );
    expect(normalizeLugandaForSpeech("1 mk ne 2 kr")).toBe(
      "ssaawa emu eyokumakya ne ssaawa bbiri ez'ekiro",
    );
    expect(normalizeLugandaForSpeech("18° / 26°")).toBe(
      "okuva ku ddiguli kkumi na munaana okutuuka ku ddiguli abiri mu mukaaga",
    );
    expect(normalizeLugandaForSpeech("-3°C")).toBe("ddiguli ssatu wansi wa zzeero");
    expect(normalizeLugandaForSpeech("milimiita 0.4")).toBe("milimiita zzeero n'akatundu nnya");
  });

  it("builds comprehensive home, agriculture, lake safety, alert, and forecast narrations in English and Luganda", () => {
    const bundle = makeWeatherBundle();
    const home = buildHomeWeatherNarration(bundle, "Kampala");
    expect(home.en).toContain("Kampala");
    expect(home.en).toContain("Rain chance over the next 6 hours");
    expect(home.lg).toContain("Embeera y'obudde mu Kampala leero");

    const ag = buildSheetNarration("agriculture", bundle, "Kampala");
    expect(ag.en).toContain("Farming advice for Kampala");
    expect(ag.lg).toContain("Amagezi ag'ebyobulimi mu Kampala");

    const lake = buildSheetNarration("lake-victoria", bundle, "Kampala");
    expect(lake.en).toContain("Lake Victoria fishing safety");
    expect(lake.lg).toContain("Obukuumi bw'abavubi ku Nnyanja Nalubaale");

    const forecast = buildSheetNarration("daily-forecast", bundle, "Kampala");
    expect(forecast.en).toContain("Upcoming days forecast");
    expect(forecast.lg).toContain("Enteekateeka y'ennaku ezijja");

    expect(selectSpokenPayload(home, "lg")).toEqual({
      text: home.lg,
    });
    expect(selectSpokenPayload(home, "en")).toEqual({
      text: home.en,
    });
  });

  it("narrates About District, Legal sections (Disclaimer, Privacy, Terms, Cookies, Attribution), and localized Luganda sheet titles", () => {
    const bundle = makeWeatherBundle();

    const about = buildSectionNarration("about-district", bundle.district);
    expect(about).not.toBeNull();
    expect(about!.en).toContain(`About ${bundle.district.name} weather`);
    expect(about!.lg).toContain(`Ebikwata ku mbeera y'obudde mu ${bundle.district.name}`);

    const disclaimer = buildSectionNarration("disclaimer");
    expect(disclaimer!.en).toContain("UNMA");
    expect(disclaimer!.lg).toContain("UNMA");

    const privacy = buildSectionNarration("/privacy");
    expect(privacy!.en).toContain("Privacy");
    expect(privacy!.lg).toContain("Eby'ekyama");

    const agLgTitle = buildSheetNarration("«r14» Amagezi ag'ebyobulimi", bundle, "Kampala");
    expect(agLgTitle.lg).toContain("Amagezi ag'ebyobulimi mu Kampala");

    const pressureLgTitle = buildSheetNarration("«r15» Obuzito bw'empewo", bundle, "Kampala");
    expect(pressureLgTitle.en).toContain("Atmospheric pressure in Kampala");
    expect(pressureLgTitle.lg).toContain("Obuzito bw'empewo mu Kampala");

    const uvLgTitle = buildSheetNarration("«r16» Amaanyi g'omusana", bundle, "Kampala");
    expect(uvLgTitle.en).toContain("UV index in Kampala");
    expect(uvLgTitle.lg).toContain("Amaanyi g'omusana mu Kampala");
  });
});
