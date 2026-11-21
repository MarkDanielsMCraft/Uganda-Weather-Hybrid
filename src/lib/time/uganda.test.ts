import { describe, expect, it } from "vitest";
import {
  formatClockLabelForLanguage,
  formatDurationForLanguage,
  formatLugandaClockParts,
  formatUgandaClock,
  formatUgandaDateTime,
  formatUgandaTimeLabel,
  lugandaTimeParts,
  parseClockLabelTo24h,
} from "./uganda";

describe("Luganda clock and time helpers", () => {
  it("converts 24-hour Uganda time to traditional 6-hour-shifted Luganda hours and periods", () => {
    // 7:00 AM -> 1 o'clock in morning -> eyokumakya
    expect(lugandaTimeParts(7, 0)).toMatchObject({
      lugandaHour: 1,
      connector: "ey'",
      genitivePeriod: "eyokumakya",
      period: "eyokumakya",
      shortPeriod: "mk",
    });

    // 1:00 PM -> 7 o'clock in afternoon -> ezomuttuntu
    expect(lugandaTimeParts(13, 30)).toMatchObject({
      lugandaHour: 7,
      connector: "ez'",
      genitivePeriod: "ezomuttuntu",
      period: "ezomuttuntu",
      shortPeriod: "tt",
    });

    // 6:15 PM -> 12 evening -> ez'akawungeezi
    expect(lugandaTimeParts(18, 15)).toMatchObject({
      lugandaHour: 12,
      connector: "ez'",
      genitivePeriod: "ez'akawungeezi",
      period: "ez'akawungeezi",
      shortPeriod: "kw",
    });

    // 2:00 AM -> 8 deep night -> ezomuttumbi
    expect(lugandaTimeParts(2, 0)).toMatchObject({
      lugandaHour: 8,
      connector: "ez'",
      genitivePeriod: "ezomuttumbi",
      period: "ezomuttumbi",
      shortPeriod: "tb",
    });
  });

  it("formats compact and medium Luganda clock labels", () => {
    expect(formatLugandaClockParts(7, 0, "compact")).toBe("1 mk");
    expect(formatLugandaClockParts(7, 45, "compact")).toBe("1:45 mk");
    expect(formatLugandaClockParts(7, 5, "medium")).toBe("1:05 eyokumakya");
    expect(formatLugandaClockParts(20, 30, "medium")).toBe("2:30 ez'ekiro");
    expect(formatLugandaClockParts(16, 0, "medium", 9)).toBe("10:00:09 ez'olweggulo");
  });

  it("parses clock labels and adapts display formatting by language", () => {
    expect(parseClockLabelTo24h("6:59 am")).toEqual({ hour24: 6, minute: 59 });
    expect(parseClockLabelTo24h("6:59 pm")).toEqual({ hour24: 18, minute: 59 });
    expect(parseClockLabelTo24h("14:00")).toEqual({ hour24: 14, minute: 0 });
    expect(parseClockLabelTo24h("Now")).toBeNull();

    expect(formatClockLabelForLanguage("3 pm", "en")).toBe("3 pm");
    expect(formatClockLabelForLanguage("Now", "en")).toBe("Now");
    expect(formatClockLabelForLanguage("3 pm", "lg", "compact")).toBe("9 tt");
    expect(formatClockLabelForLanguage("7:05 am", "lg", "medium")).toBe("1:05 eyokumakya");
    expect(formatClockLabelForLanguage("Now", "lg", "compact")).toBe("Kati");
  });

  it("formats durations, live Kampala clock, and weather timestamps in Luganda", () => {
    expect(formatDurationForLanguage(45, "en")).toBe("45m");
    expect(formatDurationForLanguage(45, "lg")).toBe("ddak. 45");
    expect(formatDurationForLanguage(135, "en")).toBe("2h 15m");
    expect(formatDurationForLanguage(135, "lg")).toBe("ss. 2 ddak. 15");
    expect(formatDurationForLanguage(119.6, "en")).toBe("2h 0m");
    expect(formatDurationForLanguage(119.6, "lg")).toBe("ss. 2 ddak. 0");

    // 2026-04-06T07:05:12+03:00 -> Bbalaza, 1:05:12 eyokumakya in Kampala
    const instant = new Date("2026-04-06T07:05:12+03:00");
    expect(formatUgandaClock(instant, true, "lg")).toBe("1:05:12 eyokumakya");
    expect(formatUgandaTimeLabel("2026-04-06 15:00", "lg")).toBe("9 tt");
    expect(
      formatUgandaDateTime(
        instant,
        { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
        "lg",
      ),
    ).toBe("6 Kafuumuulampawu, 1:05 eyokumakya");
    expect(
      formatUgandaDateTime(
        instant,
        { weekday: "long", month: "short", day: "numeric", year: "numeric" },
        "lg",
      ),
    ).toBe("Bbalaza, 6 Kafuumuulampawu 2026");
    expect(formatUgandaDateTime(instant, { weekday: "short" }, "lg")).toBe("Bba");
    expect(formatUgandaDateTime(instant, { year: "numeric" }, "lg")).toBe("2026");
    expect(formatUgandaDateTime(instant, {}, "lg")).toBe(
      "6 Kafuumuulampawu 2026, 1:05 eyokumakya",
    );
    expect(
      formatUgandaDateTime(instant, { dateStyle: "medium", timeStyle: "short" }, "lg"),
    ).toBe("6 Kafuumuulampawu 2026, 1:05 eyokumakya");
  });
});
