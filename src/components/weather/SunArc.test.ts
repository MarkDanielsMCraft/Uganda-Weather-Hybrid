import { describe, expect, it } from "vitest";
import { clockLabelToMinutes, formatMinutes } from "./SunArc";

describe("SunArc time helpers", () => {
  it("rounds total minutes before splitting hours and minutes", () => {
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(59.6)).toBe("1h 0m");
    expect(formatMinutes(119.6)).toBe("2h 0m");
    expect(formatMinutes(135)).toBe("2h 15m");
  });

  it("parses sunrise and sunset labels to minutes since midnight", () => {
    expect(clockLabelToMinutes("6:59 am")).toBe(419);
    expect(clockLabelToMinutes("6:59 pm")).toBe(1139);
    expect(clockLabelToMinutes("invalid")).toBeNull();
  });
});
