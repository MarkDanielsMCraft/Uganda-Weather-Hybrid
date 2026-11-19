import { describe, expect, it } from "vitest";
import { aqiBandForValue } from "./index";

describe("aqiBandForValue", () => {
  it("picks the band whose range contains the AQI value", () => {
    expect(aqiBandForValue(0).label).toBe("Good");
    expect(aqiBandForValue(50).label).toBe("Good");
    expect(aqiBandForValue(51).label).toBe("Moderate");
    expect(aqiBandForValue(150).label).toBe("Unhealthy for Sensitive Groups");
    expect(aqiBandForValue(200).label).toBe("Unhealthy");
  });

  it("falls back to the worst band for values beyond the defined range", () => {
    expect(aqiBandForValue(500).label).toBe("Very Unhealthy");
  });
});
