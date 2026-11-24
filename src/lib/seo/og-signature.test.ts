import { afterEach, describe, expect, it, vi } from "vitest";
import { ogImageUrl } from "@/lib/seo/metadata";
import { signOgText } from "@/lib/seo/og-sign";
import { isSignedOgText } from "@/lib/seo/og-verify";

const SECRET = "test-og-secret-that-is-long-enough-000000";

describe("share image signatures", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts text the app signed", async () => {
    vi.stubEnv("OG_IMAGE_SECRET", SECRET);
    const sig = signOgText("Gulu weather", "Rain and wind for Gulu");
    expect(await isSignedOgText("Gulu weather", "Rain and wind for Gulu", sig)).toBe(true);
  });

  it("refuses a fake alert made by changing the words, as the attack pass did", async () => {
    vi.stubEnv("OG_IMAGE_SECRET", SECRET);
    const sig = signOgText("Gulu weather", "Rain and wind for Gulu");
    expect(await isSignedOgText("EVACUATE KAMPALA NOW", "Call 0772000000", sig)).toBe(false);
    expect(await isSignedOgText("EVACUATE KAMPALA NOW", "Call 0772000000", null)).toBe(false);
    expect(await isSignedOgText("Gulu weather", "Rain and wind for Gulu", "not-hex")).toBe(false);
  });

  it("draws no custom text at all when no secret is set", async () => {
    vi.stubEnv("OG_IMAGE_SECRET", "");
    expect(signOgText("Gulu weather", "x")).toBeNull();
    expect(await isSignedOgText("Gulu weather", "x", "a".repeat(64))).toBe(false);
  });

  it("puts a signature on the image links the app builds", () => {
    vi.stubEnv("OG_IMAGE_SECRET", SECRET);
    const url = new URL(ogImageUrl("https://hybrid.uganda-weather.com", "Gulu weather", "Rain & wind"));
    expect(url.searchParams.get("title")).toBe("Gulu weather");
    expect(url.searchParams.get("subtitle")).toBe("Rain & wind");
    expect(url.searchParams.get("sig")).toMatch(/^[0-9a-f]{64}$/);
  });
});
