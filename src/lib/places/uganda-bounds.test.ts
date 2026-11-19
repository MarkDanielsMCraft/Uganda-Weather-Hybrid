import { describe, expect, it } from "vitest";
import { isWithinUganda } from "./uganda-bounds";

describe("isWithinUganda", () => {
  it("accepts coordinates inside Uganda", () => {
    // Kampala
    expect(isWithinUganda(0.3476, 32.5825)).toBe(true);
    // Koboko (far north-west)
    expect(isWithinUganda(3.41, 30.96)).toBe(true);
  });

  it("rejects coordinates outside Uganda", () => {
    // Augsburg, Germany — the fix that crashed the page
    expect(isWithinUganda(48.3447, 10.942)).toBe(false);
    // Nairobi, Kenya (just east of the eastern bound)
    expect(isWithinUganda(-1.2921, 36.8219)).toBe(false);
  });

  it("rejects non-finite coordinates", () => {
    expect(isWithinUganda(Number.NaN, 32)).toBe(false);
    expect(isWithinUganda(0, Number.POSITIVE_INFINITY)).toBe(false);
  });
});
