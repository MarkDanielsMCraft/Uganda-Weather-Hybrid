import { describe, expect, it } from "vitest";
import { makeWeatherBundle } from "@/lib/test-fixtures/weather-bundle";
import { normalizeLugandaForSpeech, numberToLugandaWords } from "./luganda-speech";
import {
  buildHomeWeatherNarration,
  buildLiteWeatherNarration,
  buildSectionNarration,
  buildSheetNarration,
  selectSpokenPayload,
} from "./narrator";

describe("narrator and Luganda speech normalizer", () => {
  it("uses Class 8 bi- numeral concords for hundreds and Class 3/4 mutwalo/mitwalo for ten-thousands", () => {
    expect(numberToLugandaWords(100)).toBe("kikumi");
    expect(numberToLugandaWords(200)).toBe("bikumi bibiri");
    expect(numberToLugandaWords(300)).toBe("bikumi bisatu");
    expect(numberToLugandaWords(400)).toBe("bikumi bina");
    expect(numberToLugandaWords(500)).toBe("bikumi bitaano");
    expect(numberToLugandaWords(245)).toBe("bikumi bibiri mu ana mu ttaano");
    expect(numberToLugandaWords(10_000)).toBe("mutwalo gumu");
    expect(numberToLugandaWords(356_500)).toBe(
      "mitwalo asatu mu etaano mu nkumi mukaaga mu bikumi bitaano",
    );
    expect(numberToLugandaWords(1_000_000)).toBe("kakadde kamu");
  });

  it("normalizes degrees, percentages, and wind speeds into natural spoken Luganda", () => {
    expect(normalizeLugandaForSpeech("Gulu City: 25°C, enkuba 80%, empewo 12 km/h")).toBe(
      "Ekibuga Gulu: ddiguli abiri mu ttaano, enkuba ebitundu kinaana ku kikumi, empewo kilomiita kkumi na bbiri buli ssaawa",
    );
  });

  it("normalizes evening Luganda clock strings, UI durations, prefix units, comma thousands, and English glosses", () => {
    expect(normalizeLugandaForSpeech("ku ssaawa 7:00 am oba 8:00 am")).toBe(
      "ku ssaawa emu eyokumakya oba ssaawa bbiri ezokumakya",
    );
    expect(normalizeLugandaForSpeech("12:48 ez'akawungeezi")).toBe(
      "ssaawa kkumi na bbiri n'eddakiika ana mu munaana ez'akawungeezi",
    );
    expect(normalizeLugandaForSpeech("ss. 12 ddak. 5")).toBe(
      "essaawa kkumi na bbiri n'eddakiika ttaano",
    );
    expect(normalizeLugandaForSpeech("1 mk ne 2 kr")).toBe(
      "ssaawa emu eyokumakya ne ssaawa bbiri ez'ekiro",
    );
    expect(normalizeLugandaForSpeech("18° / 26°")).toBe(
      "okuva ku ddiguli kkumi na munaana okutuuka ku ddiguli abiri mu mukaaga",
    );
    expect(normalizeLugandaForSpeech("-3°C")).toBe("ddiguli ssatu wansi wa zzeero");
    expect(normalizeLugandaForSpeech("milimiita 0.4")).toBe("milimiita zzeero n'akatundu nnya");
    expect(
      normalizeLugandaForSpeech(
        "Uganda eri ku layini ya Ekweeta (Equator), mita 2,607, hPa 1014, km/h 12, PM2.5 · µg/m³ 14, AQI 42 ku 150+",
      ),
    ).toBe(
      "Uganda eri ku layini ya Ekweeta, mita nkumi bbiri mu bikumi mukaaga mu musanvu, miliba lukumi mu kkumi na nnya, kilomiita kkumi na bbiri buli ssaawa, P M bbiri n'akatundu ttaano, mayikurogulaamu kkumi na nnya, AQI ana mu bbiri ku kikumi mu ataano n'okusoba",
    );
  });

  it("builds Home, Lite, agriculture, lake safety, alert, and forecast narrations without non-Luganda omume", () => {
    const nightBundle = makeWeatherBundle({ isDay: false });
    const home = buildHomeWeatherNarration(nightBundle, "Kampala");
    expect(home.en).toContain("Kampala");
    expect(home.en).toContain("Rain chance over the next 6 hours");
    expect(home.lg).toContain("Embeera y'obudde mu Kampala leero");
    expect(home.lg).toContain("obunnyogovu mu mpewo");
    expect(home.lg).not.toContain("omume");
    expect(home.lg).not.toContain("yanula");

    const lite = buildLiteWeatherNarration(nightBundle, "Kampala", {
      currentRainChance: 35,
      guidanceEn: "Calm evening expected.",
      guidanceLg: "Obudde bw'ekiro buteefu.",
    });
    expect(lite.en).toContain("Calm evening expected.");
    expect(lite.lg).toContain("Obudde bw'ekiro buteefu.");
    expect(lite.lg).toContain("Obunnyogovu mu mpewo");

    const ag = buildSheetNarration("agriculture", nightBundle, "Kampala");
    expect(ag.en).toContain("Farming advice for Kampala");
    expect(ag.lg).toContain("Amagezi ag'ebyobulimi mu Kampala");
    expect(ag.lg).toContain("omusulo gw'ekiro");
    expect(ag.lg).not.toContain("omume");

    const lake = buildSheetNarration("lake-victoria", nightBundle, "Kampala");
    expect(lake.en).toContain("Lake Victoria fishing safety");
    expect(lake.lg).toContain("Obukuumi bw'abavubi ku Nnyanja Nalubaale");

    const forecast = buildSheetNarration("daily-forecast", nightBundle, "Kampala");
    expect(forecast.en).toContain("Upcoming days forecast");
    expect(forecast.lg).toContain("Enteekateeka y'ennaku ezijja");

    expect(selectSpokenPayload(home, "lg")).toEqual({
      text: home.lg,
    });
    expect(selectSpokenPayload(home, "en")).toEqual({
      text: home.en,
    });
  });

  it("narrates About District, Legal sections, Averages, Site Health, Luganda feedback, and Conditions fallbacks", () => {
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

    const averages = buildSheetNarration("«r11» Ebipimo ebya bulijjo", bundle, "Kampala");
    expect(averages.lg).toContain("Ebipimo ebya bulijjo mu Kampala");

    const health = buildSheetNarration("«r12» Embeera y'omukutu", bundle, "Kampala");
    expect(health.lg).toContain("Embeera y'omukutu");

    const beta = buildSheetNarration("luganda-beta-feedback", bundle, "Kampala");
    expect(beta.lg).toContain("Okulongoosa Oluganda");

    const conditions = buildSheetNarration("«r13» Embeera y'obudde", bundle, "Kampala");
    expect(conditions.lg).toContain("liwulirwa");

    const wind = buildSheetNarration("wind", bundle, "Kampala");
    expect(wind.en).toContain(`from the ${bundle.wind.direction}`);
    expect(wind.lg).toContain("okuva mu");

    const aqi = buildSheetNarration("air-quality", bundle, "Kampala");
    expect(aqi.lg).toContain("empewo nnungi");

    expect(normalizeLugandaForSpeech("km/h9, mb883, km12")).toBe(
      "kilomiita mwenda buli ssaawa, miliba bikumi munaana mu kinaana mu ssatu, kilomiita kkumi na bbiri",
    );
  });
});
