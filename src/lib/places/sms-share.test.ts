import { describe, expect, it } from "vitest";
import {
  buildPlainTextAdvisorSms,
  buildPlainTextWeatherSms,
  buildSmsHref,
  buildWhatsAppHref,
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
  it("builds a concise English plain-text weather summary with active safety note", () => {
    const text = buildPlainTextWeatherSms(SAMPLE_WEATHER, "en");
    expect(text).toContain("Uganda Weather Gulu: 32°C");
    expect(text).toContain("Rain 10%");
    expect(text).toContain("High UV sun protection");
  });

  it("builds a Luganda plain-text weather summary", () => {
    const text = buildPlainTextWeatherSms(SAMPLE_WEATHER, "lg");
    expect(text).toContain("Uganda Weather Gulu: 32°C");
    expect(text).toContain("Enkuba 10%");
    expect(text).toContain("Okwekuuma omusana ogw'amaanyi");
  });

  it("strips markdown and preserves the full Advisor reply text for SMS", () => {
    const longReply = "**Go ahead** and dry maize today. ".repeat(12).trim();
    const sms = buildPlainTextAdvisorSms("Kampala", longReply);
    expect(sms).not.toContain("**");
    expect(sms).toContain("Uganda Weather (Kampala): Go ahead and dry maize today.");
    expect(sms.endsWith("Go ahead and dry maize today.")).toBe(true);
  });

  it("encodes native sms: and WhatsApp hrefs safely", () => {
    const msg = "Uganda Weather Kampala: 26°C, Rain 20%.";
    expect(buildSmsHref(msg)).toBe(`sms:?body=${encodeURIComponent(msg)}`);
    expect(buildWhatsAppHref(msg)).toBe(`https://wa.me/?text=${encodeURIComponent(msg)}`);
  });
});
