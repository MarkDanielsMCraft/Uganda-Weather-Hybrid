import { describe, expect, it } from "vitest";
import {
  AdvisorRequestInputSchema,
  buildAdvisorSystemInstruction,
  buildWeatherContextPrompt,
  classifyAdvisorLocation,
} from "@/lib/ai/advisor-prompt";
import { makeWeatherBundle } from "@/lib/test-fixtures/weather-bundle";

describe("advisor-prompt", () => {
  it("builds audience, orthography, language-switch, and off-topic handling instructions", () => {
    const farmerEn = buildAdvisorSystemInstruction("farmer", "en");
    expect(farmerEn).toContain("farmers in Uganda");
    expect(farmerEn).toContain("plain, simple, everyday English");
    expect(farmerEn).toContain("clearly unrelated to weather");
    expect(farmerEn).toContain("Treat ANY question about hours");

    const fisherLg = buildAdvisorSystemInstruction("fisher", "lg");
    expect(fisherLg).toContain("lake safety");
    expect(fisherLg).toContain("Empandiika y'Oluganda Entongole");
    expect(fisherLg).toContain("Gyebaleko");
    expect(fisherLg).toContain("Essaawa ki ezisinga obulungi leero?");
    expect(fisherLg).toContain("earlier messages in the conversation history were written in English");
  });

  it("grounds context prompt in district weather, alerts, history, and cache freshness", () => {
    const weather = makeWeatherBundle({
      stale: true,
      alerts: [
        {
          id: "a1",
          title: "Heavy rain warning",
          description: "Expect heavy afternoon storms.",
          severity: "warning",
          source: "UNMA",
          issuedAt: "2026-11-19T06:00:00Z",
        },
      ],
    });

    const prompt = buildWeatherContextPrompt(
      weather,
      "mountain_park",
      "en",
      "Is the afternoon trail safe?",
      [{ role: "user", text: "Hello" }],
    );

    expect(prompt).toContain("Location: Kampala");
    expect(prompt).toContain("Location type:");
    expect(prompt).toContain("°C");
    expect(prompt).toContain("Cached offline forecast");
    expect(prompt).toContain("WARNING: Heavy rain warning");
    expect(prompt).toContain("Recent conversation:");
    expect(prompt).toContain("User: Hello");
    expect(prompt).toContain("<user_question>Is the afternoon trail safe?</user_question>");
  });

  it("classifies national parks, mountain peaks, airports, villages, and GPS locations separately from districts", () => {
    const base = makeWeatherBundle().district;

    expect(
      classifyAdvisorLocation({ ...base, name: "Mount Elgon", slug: "mount-elgon", isPlace: true, parentDistrictSlug: "mbale" }),
    ).toMatchObject({ kind: "national_park", typeLabel: "National Park (NOT a district)" });

    expect(
      classifyAdvisorLocation({ ...base, name: "Wagagai Peak", slug: "wagagai-peak", isPlace: true, parentDistrictSlug: "kapchorwa" }),
    ).toMatchObject({ kind: "mountain_peak", typeLabel: "Mountain peak (NOT a district)" });

    expect(
      classifyAdvisorLocation({ ...base, name: "Entebbe International Airport", slug: "entebbe-airport", isPlace: true, parentDistrictSlug: "entebbe" }),
    ).toMatchObject({ kind: "airport", typeLabel: "Airport (NOT a district)" });

    expect(
      classifyAdvisorLocation({ ...base, name: "Your location", slug: "gps-0.31-32.58", isPlace: true, placeLabel: "Near Kampala", parentDistrictSlug: "kampala" }),
    ).toMatchObject({ kind: "gps_location" });

    expect(
      classifyAdvisorLocation({ ...base, name: "Kibinge", slug: "kibinge-0.14-31.60", isPlace: true, parentDistrictSlug: "bukomansimbi" }),
    ).toMatchObject({ kind: "village_or_town", typeLabel: "Village, parish, or town (NOT a district)" });

    expect(
      classifyAdvisorLocation({ ...base, name: "Gulu", slug: "gulu", isPlace: false, isCity: false }),
    ).toMatchObject({ kind: "district", typeLabel: "District" });
  });

  it("rejects overly long custom questions via Zod", () => {
    const result = AdvisorRequestInputSchema.safeParse({
      audience: "general",
      language: "en",
      customQuestion: "a".repeat(241),
    });
    expect(result.success).toBe(false);
  });
});
