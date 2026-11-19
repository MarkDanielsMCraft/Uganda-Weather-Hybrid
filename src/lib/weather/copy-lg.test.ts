import { describe, expect, it } from "vitest";
import {
  formatAgroZoneLg,
  formatConditionLg,
  formatCropStatusLg,
  formatDayLg,
  formatDayPrepositionLg,
  formatFeelsLikeFooterLg,
  formatFeelsLikeLg,
  formatFullDateLg,
  formatHighLowLg,
  formatHumidityFooterLg,
  formatMarineSafetyLg,
  formatMonthYearLg,
  formatMoonPhaseLg,
  formatPrecipitationFooterLg,
  formatPressureFooterLg,
  formatSeasonLabelLg,
  formatSeasonPhaseLg,
  formatShortDateLg,
  formatSoilMoistureLg,
  formatUvFooterLg,
  formatUvLabelLg,
  formatVisibilityFooterLg,
  formatWeekdayInitialLg,
  formatWindDirectionLg,
  formatWindFooterLg,
  hoursAheadSummaryLg,
  wmoLabelLg,
} from "./copy-lg";
import type { WeatherBundle } from "@/types/weather";

describe("Luganda weather copy formatters", () => {
  it("formats conditions into authentic native Luganda terms", () => {
    expect(formatConditionLg("Clear", true)).toBe("Omusana");
    expect(formatConditionLg("Clear", false)).toBe("Butangaavu");
    expect(formatConditionLg("Sunny")).toBe("Omusana");
    expect(formatConditionLg("Mostly Clear")).toBe("Butangaavu okusinga");
    expect(formatConditionLg("Partly Cloudy")).toBe("Ekiddedde ekitono");
    expect(formatConditionLg("Cloudy")).toBe("Ekiddedde");
    expect(formatConditionLg("Overcast")).toBe("Ekiddedde");
    expect(formatConditionLg("Light Drizzle")).toBe("Obukubakuba");
    expect(formatConditionLg("Drizzle")).toBe("Obukubakuba");
    expect(formatConditionLg("Heavy Drizzle")).toBe("Obukubakuba obungi");
    expect(formatConditionLg("Light Rain")).toBe("Enkuba etonnyako");
    expect(formatConditionLg("Rain")).toBe("Enkuba");
    expect(formatConditionLg("Heavy Rain")).toBe("Enkuba ey'amaanyi");
    expect(formatConditionLg("Rain Showers")).toBe("Enkuba ey'amatondo");
    expect(formatConditionLg("Chance of Rain")).toBe("Enkuba esuubirwa");
    expect(formatConditionLg("Possible Thunderstorms")).toBe("Kibuyaga asuubirwa");
    expect(formatConditionLg("Thunderstorms")).toBe("Kibuyaga n'eraddu");
    expect(formatConditionLg("Fog")).toBe("Olufu");
    expect(formatConditionLg("Hazy")).toBe("Olukungu");
    expect(formatConditionLg("Thunderstorm with hail")).toBe("Enkuba y'omuzira");
  });

  it("maps WMO numerical codes to authentic Luganda", () => {
    expect(wmoLabelLg(0, true)).toBe("Omusana");
    expect(wmoLabelLg(0, false)).toBe("Butangaavu");
    expect(wmoLabelLg(2)).toBe("Ekiddedde ekitono");
    expect(wmoLabelLg(3)).toBe("Ekiddedde");
    expect(wmoLabelLg(45)).toBe("Olufu");
    expect(wmoLabelLg(51)).toBe("Obukubakuba");
    expect(wmoLabelLg(61)).toBe("Enkuba etonnyako");
    expect(wmoLabelLg(63)).toBe("Enkuba");
    expect(wmoLabelLg(65)).toBe("Enkuba ey'amaanyi");
    expect(wmoLabelLg(80)).toBe("Enkuba ey'amatondo");
    expect(wmoLabelLg(95)).toBe("Kibuyaga n'eraddu");
    expect(wmoLabelLg(96)).toBe("Enkuba y'omuzira");
  });

  it("formats day names according to standard Luganda weekday rules", () => {
    expect(formatDayLg("Today")).toBe("Leero");
    expect(formatDayLg("Tomorrow")).toBe("Enkya");
    expect(formatDayLg("Mon")).toBe("Bbalaza");
    expect(formatDayLg("Tue")).toBe("Olwokubiri");
    expect(formatDayLg("Wed")).toBe("Olwokusatu");
    expect(formatDayLg("Thu")).toBe("Olwokuna");
    expect(formatDayLg("Fri")).toBe("Olwokutaano");
    expect(formatDayLg("Sat")).toBe("Olwomukaaga");
    expect(formatDayLg("Sun")).toBe("Ssande");
  });

  it("formats high-low and feels-like temperature metrics", () => {
    expect(formatHighLowLg(28, 19)).toBe("Waggulu: 28°  Wansi: 19°");
    expect(formatFeelsLikeLg(26)).toBe("Liwulirwa nga 26°");
  });

  it("formats widget footers and descriptions in authentic Luganda", () => {
    expect(formatFeelsLikeFooterLg(0)).toBe("Liringana n'ebbugumu eririwo ddala kati.");
    expect(formatFeelsLikeFooterLg(2)).toBe("Liwulirwa nga lyeyongeddeko 2° olw'obunnyogovu mu mpewo.");
    expect(formatFeelsLikeFooterLg(-3)).toBe("Liwulirwa nga likendeddeko 3° olw'empewo.");

    expect(formatHumidityFooterLg(80, 21)).toBe(
      "Empewo ezitowa olw'obunnyogovu bungi. Ekipimo ky'omume kiri ku 21°.",
    );
    expect(formatHumidityFooterLg(30, 14)).toBe(
      "Empewo nkalu. Nywa amazzi ng'oli ebweru. Ekipimo ky'omume kiri ku 14°.",
    );
    expect(formatHumidityFooterLg(50, 18)).toBe("Ekipimo ky'omume kiri ku 18° mu kaseera kano.");

    expect(formatUvFooterLg(1)).toBe(
      "Omusana teguli gw'amaanyi mu kiseera ky'olunaku ekisigaddeyo.",
    );
    expect(formatUvFooterLg(8)).toBe("Kozesa ekisiikirize mu ssaawa ez'omusana omungi.");
    expect(formatUvLabelLg(2)).toBe("Wansi");
    expect(formatUvLabelLg(4)).toBe("Wakati");
    expect(formatUvLabelLg(6)).toBe("Waggulu");
    expect(formatUvLabelLg(9)).toBe("Waggulu nnyo");
    expect(formatUvLabelLg(11)).toBe("Kya bulabe nnyo");

    expect(formatVisibilityFooterLg(16)).toBe(
      "Olaba bulungi ddala okwetooloola disitulikiti yonna.",
    );
    expect(formatVisibilityFooterLg(10)).toBe(
      "Olaba bulungi mu kutambula n'emirimu gy'ebweru.",
    );
    expect(formatVisibilityFooterLg(5)).toBe("Okulaba kukendedde. Weegendereze ku nguudo.");

    expect(formatPressureFooterLg(2)).toBe(
      "mb +2 bw'ogeraageranya n'ekipimo eky'oku nnyanja.",
    );
    expect(formatPrecipitationFooterLg(0, 10)).toBe("Tewali nkuba esuubirwa leero.");
    expect(formatPrecipitationFooterLg(5, 75)).toBe(
      "Omukisa gw'enkuba okutonnya mu bubaka buno guli 75%.",
    );

    expect(formatWindFooterLg("E", 90)).toBe("Eva mu buvanjuba ku diguli 90°.");

    const safe = formatMarineSafetyLg({ label: "Safe for small craft", summary: "Calm water." });
    expect(safe.label).toBe("Tewali mutawaana eri amaato");

    const caution = formatMarineSafetyLg({ label: "Caution advised", summary: "Choppy." });
    expect(caution.label).toBe("Weegendereze ku nnyanja");

    const danger = formatMarineSafetyLg({ label: "Danger for small craft", summary: "Rough." });
    expect(danger.label).toBe("Kabi kanene eri amaato amatono");
  });

  it("formats dates, compass directions, moon phases, and agricultural terms in authentic Luganda", () => {
    expect(formatFullDateLg("2026-04-06")).toBe("Bbalaza, 6 Kafuumuulampawu 2026");
    expect(formatMonthYearLg(2026, 0)).toBe("Gatonnya 2026");
    expect(formatShortDateLg(new Date("2026-12-01T00:00:00Z"))).toBe("Okb, 1 Ntenvu");
    expect(formatWeekdayInitialLg("2026-04-05")).toBe("Ssa");
    expect(formatDayPrepositionLg("Today")).toBe("Leero");
    expect(formatDayPrepositionLg("Tomorrow", false)).toBe("enkya");
    expect(formatDayPrepositionLg("Tue")).toBe("Ku Lwokubiri");
    expect(formatDayPrepositionLg("Thu", false)).toBe("ku Lwokuna");
    expect(formatMoonPhaseLg("New Moon")).toBe("Omwezi omuggya");
    expect(formatMoonPhaseLg("Waning Gibbous")).toBe("Ogutandise okukendeera");
    expect(formatMoonPhaseLg("Full Moon")).toBe("Omwezi ogwijjudde");

    expect(formatWindDirectionLg("N")).toBe("Mambuka");
    expect(formatWindDirectionLg("SSE")).toBe("Maserengeta ga buvanjuba");
    expect(formatWindDirectionLg("W")).toBe("Bugwanjuba");

    expect(formatSeasonLabelLg("First rains season")).toBe(
      "Enkuba esooka (Mugulansigo okutuuka mu Muzigo)",
    );
    expect(formatSeasonLabelLg("Dry season")).toBe(
      "Ekiseera ky'ekyeya (Ssebaaseka okutuuka mu Muwakanya)",
    );
    expect(formatSeasonPhaseLg("planting_time")).toBe("Ekiseera ky'okusiga");
    expect(formatSoilMoistureLg("low", "Low")).toBe("Matono");
    expect(formatSoilMoistureLg("moderate", "Moderate")).toBe("Ga kigero");
    expect(formatSoilMoistureLg("high", "High")).toBe("Mangi");
    expect(formatCropStatusLg("good", "Good")).toBe("Kirungi");
    expect(formatAgroZoneLg("banana_coffee", "Banana Coffee")).toBe(
      "Ekitundu ky'amatooke n'emmwanyi",
    );
    expect(formatAgroZoneLg("lake_victoria_basin", "Lake Victoria Basin")).toBe(
      "Ekitundu ky'Ennyanja Nalubaale",
    );
  });

  it("formats hours ahead summary in authentic Luganda", () => {
    const mockWeather = {
      wind: { gustKph: 20 },
      hourly: [],
      condition: { text: "Cloudy", theme: "cloudy" },
      precipitation: { mm: 0 },
      dailyForecast: [],
    } as unknown as WeatherBundle;

    expect(hoursAheadSummaryLg(mockWeather)).toBe("Ebire mu kiseera ky'olunaku ekisigaddeyo.");
  });
});
