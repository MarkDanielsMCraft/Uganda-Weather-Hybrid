import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPageMetadata, OG_IMAGE_PATH } from "@/lib/seo/metadata";

describe("link preview picture", () => {
  it("is the same fixed picture on every page, whatever the page title", () => {
    const a = buildPageMetadata({ title: "Gulu Weather", description: "x", path: "/district/gulu" });
    const b = buildPageMetadata({ title: "EVACUATE NOW", description: "y", path: "/lg" });
    const imageOf = (m: typeof a) => JSON.stringify(m.openGraph?.images);
    expect(imageOf(a)).toBe(imageOf(b));
    expect(imageOf(a)).toContain(OG_IMAGE_PATH);
    expect(JSON.stringify(a.twitter?.images)).toContain(OG_IMAGE_PATH);
  });

  it("exists in the public folder", () => {
    expect(existsSync(join(process.cwd(), "public", OG_IMAGE_PATH))).toBe(true);
  });
});
