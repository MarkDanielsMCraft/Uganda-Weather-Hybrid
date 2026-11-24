import { describe, expect, it } from "vitest";
import {
  buildPlainTextAdvisorSms,
  buildPlainTextWeatherSms,
  buildSmsHref,
  buildWhatsAppHref,
  toSmsSafeText,
} from "./sms-share";
import type { WeatherBundle } from "@/types/weather";

const SAMPLE_WEATHER: WeatherBundle = {
  district: {
    id: "gulu",
    name: "Gulu",
    slug: "gulu",
    region: "northern",
    coordinates: { lat: 2.7724, lon: 32.2881 },
    rainfallPattern: "unimodal",
    agroZone: "northern",
    hazards: ["drought"],
  },
  isDay: true,
  temperature: { celsius: 32, feelsLike: 33 },
  condition: { code: 0, text: "Clear", icon: "clear", theme: "clear" },
  precipitation: { mm: 0, chance: 10 },
  wind: { speedKph: 12, direction: "E", degree: 90, gustKph: 16 },
  humidity: 48,
  uvIndex: 9,
  pressureMb: 1010,
  visibilityKm: 10,
  daily: { high: 33, low: 20 },
  hourly: [],
  dailyForecast: [],
  astronomy: { sunrise: "6:45 AM", sunset: "6:55 PM", moonPhase: "Full", moonIllumination: 98 },
  airQuality: { aqi: 24, category: "Good", advice: "Good air" },
  alerts: [],
  updatedAt: new Date().toISOString(),
  source: "open-meteo",
  stale: false,
};

describe("sms-share", () => {
  it("builds a one SMS English weather summary with the active safety note", () => {
    const text = buildPlainTextWeatherSms(SAMPLE_WEATHER, "en");
    expect(text).toContain("Uganda Weather Gulu: 32C");
    expect(text).toContain("Rain 10%");
    expect(text).toContain("High UV sun protection");
    expect(text.length).toBeLessThanOrEqual(160);
    expect(toSmsSafeText(text)).toBe(text);
  });

  it("builds a Luganda weather summary using only basic SMS characters", () => {
    const text = buildPlainTextWeatherSms(SAMPLE_WEATHER, "lg");
    expect(text).toContain("Uganda Weather Gulu: 32C");
    expect(text).toContain("Enkuba 10%");
    expect(text).toContain("Okwekuuma omusana ogw'amaanyi");
    expect(toSmsSafeText(text)).toBe(text);
  });

  it("drops the safety note rather than going over one SMS", () => {
    const text = buildPlainTextWeatherSms(SAMPLE_WEATHER, "en", "x".repeat(200));
    expect(text).toBe("Uganda Weather Gulu: 32C, Clear, Rain 10%, Wind 12 km/h.");
  });

  it("converts characters that would make the SMS cost more", () => {
    expect(toSmsSafeText("24°C and “dry” – okukuŋŋaanya…")).toBe('24C and "dry", okukung\'ng\'aanya.');
  });

  it("strips markdown and keeps advisor replies within two SMS parts, ending on a sentence", () => {
    const longReply = "**Go ahead** and dry maize today. ".repeat(12).trim();
    const sms = buildPlainTextAdvisorSms("Kampala", longReply);
    expect(sms).not.toContain("**");
    expect(sms.startsWith("Uganda Weather (Kampala): Go ahead and dry maize today.")).toBe(true);
    expect(sms.length).toBeLessThanOrEqual(306);
    expect(sms.endsWith("today.")).toBe(true);
  });

  it("leaves out the in app notes of a saved forecast answer", () => {
    const reply = [
      "This phone cannot run the AI advisor without internet, so here is a summary of your saved forecast.",
      "Rain likely for the next few hours.",
      "Do not dry crops outside now.",
      "Saved forecast for Kampala, last updated 10:18 am. Made from the saved numbers only, without AI.",
    ].join("\n\n");
    const sms = buildPlainTextAdvisorSms("Kampala", reply);
    expect(sms).toBe(
      "Uganda Weather (Kampala): Rain likely for the next few hours. Do not dry crops outside now.",
    );
  });

  it("encodes sms: links that work on Android and iPhone, and WhatsApp links", () => {
    const msg = "Uganda Weather Kampala: 26C, Rain 20%.";
    expect(buildSmsHref(msg)).toBe(`sms:?&body=${encodeURIComponent(msg)}`);
    expect(buildWhatsAppHref(msg)).toBe(`https://wa.me/?text=${encodeURIComponent(msg)}`);
  });
});
