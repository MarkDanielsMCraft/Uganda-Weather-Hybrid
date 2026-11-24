import { describe, expect, it } from "vitest";
import { buildSavedForecastBriefing } from "@/lib/ai/offline-briefing";
import { rejectCrossSiteRequest } from "@/lib/api/route-utils";
import { buildPlainTextAdvisorSms, toSmsSafeText } from "@/lib/places/sms-share";
import { makeHourlyPoints, makeWeatherBundle } from "@/lib/test-fixtures/weather-bundle";
import type { WeatherBundle } from "@/types/weather";

// Odd and broken input, as a hostile or careless caller might send. Nothing
// may crash, and no answer may contain NaN, undefined, or Infinity.

const BAD_TEXT = /NaN|undefined|Infinity|null/;

function brokenBundles(): Array<[string, WeatherBundle]> {
  const nanHours = makeHourlyPoints(8).map((p) => ({ ...p, rainChance: Number.NaN }));
  const hugeHours = makeHourlyPoints(8).map((p, i) => ({ ...p, rainChance: i === 2 ? 1e9 : 5 }));
  return [
    ["no hourly points", makeWeatherBundle({ hourly: [] })],
    ["rain chance is NaN", makeWeatherBundle({ hourly: nanHours })],
    ["huge rain chance", makeWeatherBundle({ hourly: hugeHours })],
    ["negative and NaN wind", makeWeatherBundle({ wind: { speedKph: -5, gustKph: Number.NaN, direction: "", degree: 0 } })],
    ["missing update time", makeWeatherBundle({ updatedAt: "not a date" })],
    ["daily chance is NaN", makeWeatherBundle({ precipitation: { mm: 0, chance: Number.NaN } })],
  ];
}

describe("offline summary under broken forecasts", () => {
  for (const [name, bundle] of brokenBundles()) {
    for (const language of ["en", "lg"] as const) {
      it(`does not crash or print junk when ${name} (${language})`, () => {
        const result = buildSavedForecastBriefing({ weather: bundle, audience: "fisher", language, notice: "offline" });
        expect(result.text.length).toBeGreaterThan(20);
        expect(result.text).not.toMatch(BAD_TEXT);
        expect(["go", "caution", "wait"]).toContain(result.verdict.level);
      });
    }
  }
});

describe("SMS builder under hostile replies", () => {
  it("handles emoji and other scripts with only basic SMS characters", () => {
    const sms = toSmsSafeText("Mvua 🌧️ كثيرة — 雨 Enkuba ŋŋ");
    expect([...sms].every((c) => c.charCodeAt(0) < 0x2000)).toBe(true);
    expect(sms).toContain("Enkuba ng'ng'");
  });

  it("caps a huge reply with no spaces at two SMS parts", () => {
    const sms = buildPlainTextAdvisorSms("Gulu", "x".repeat(10_000));
    expect(sms.length).toBeLessThanOrEqual(306);
  });

  it("never sends an empty message when the reply only has in app notes", () => {
    const sms = buildPlainTextAdvisorSms(
      "Gulu",
      "This phone cannot run the AI advisor without internet, so here is a summary of your saved forecast.",
    );
    expect(sms.trim().endsWith(":")).toBe(false);
  });
});

describe("same site check under odd headers", () => {
  const post = (headers: Record<string, string>) =>
    new Request("https://hybrid.uganda-weather.com/api/v1/voice/speak", { method: "POST", headers });

  it.each([
    [{ origin: "null", host: "hybrid.uganda-weather.com" }],
    [{ "sec-fetch-site": "none" }],
    [{ "sec-fetch-site": "CROSS-SITE" }],
    [{ origin: "https://hybrid.uganda-weather.com.evil.example", host: "hybrid.uganda-weather.com" }],
    [{ origin: "https://evil.example", host: "hybrid.uganda-weather.com", "x-forwarded-host": "evil.example" }],
  ])("refuses %o", (headers) => {
    const warn = console.warn;
    console.warn = () => {};
    expect(rejectCrossSiteRequest(post(headers), "voice")?.status).toBe(403);
    console.warn = warn;
  });

  it("still allows real same origin browser requests in any letter case", () => {
    expect(rejectCrossSiteRequest(post({ "sec-fetch-site": "Same-Origin" }), "voice")).toBeNull();
  });
});
