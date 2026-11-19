import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BRAND_GREEN,
  MARK_COLORS,
  MASKABLE_BACKGROUND,
  renderMarkSvg,
  UGANDA_OUTLINE_PATH,
} from "@/lib/design/brand-mark";

/** Icon files are served straight from disk, so they cannot read a CSS
    custom property and have to carry the mark as literals. These tests are
    what stops those copies drifting from the definition every other
    surface renders from. */

const PLAIN_ICONS = ["src/app/icon.svg", "public/icons/icon-192.svg", "public/icons/icon-512.svg"];

const read = (path: string) => readFileSync(path, "utf8");

describe("brand mark", () => {
  it.each(PLAIN_ICONS)("%s is the mark with no background", (path) => {
    expect(read(path)).toBe(renderMarkSvg());
  });

  it("the maskable icon is the same mark on a tile, inset into the safe zone", () => {
    expect(read("public/icons/icon-maskable-512.svg")).toBe(
      renderMarkSvg({ background: MASKABLE_BACKGROUND, scale: 0.78 }),
    );
  });

  it("the land matches the brand green declared in globals.css", () => {
    const css = read("src/app/globals.css");
    const token = /--color-brand-green:\s*(#[0-9a-fA-F]{3,8})\s*;/.exec(css);
    expect(token, "--color-brand-green is not declared in globals.css").not.toBeNull();
    expect(token?.[1].toLowerCase()).toBe(BRAND_GREEN.toLowerCase());
    expect(MARK_COLORS.land).toBe(BRAND_GREEN);
  });

  it("the sun and the rain keep the forecast colours, not the brand ones", () => {
    // Weather colours are read from the meteorological palette. If the mark
    // ever hardcodes them, they can drift away from the forecast the app
    // draws right next to the logo.
    expect(MARK_COLORS.sun).not.toBe(BRAND_GREEN);
    expect(MARK_COLORS.rain).not.toBe(BRAND_GREEN);
  });

  it("keeps the whole mark inside the viewBox", () => {
    const coordinates = UGANDA_OUTLINE_PATH.match(/-?\d+(?:\.\d+)?/g) ?? [];
    expect(coordinates.length).toBeGreaterThan(0);
    for (const value of coordinates) {
      expect(Number(value)).toBeGreaterThanOrEqual(0);
      expect(Number(value)).toBeLessThanOrEqual(512);
    }
  });
});
